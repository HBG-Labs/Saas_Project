-- =============================================================================
-- Organisations et appartenance — racine du multi-tenant
-- =============================================================================
-- Toute donnée du module professionnel porte un `organization_id`. Cette
-- colonne est la frontière : l'étanchéité entre entreprises se joue
-- intégralement sur elle.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LE PIÈGE : LA RÉCURSION DES POLICIES
--
-- La policy naturelle sur `organization_members` s'énonce « je vois les membres
-- des organisations dont je suis membre ». Écrite littéralement :
--
--     using (organization_id in (select organization_id
--                                from organization_members
--                                where user_id = auth.uid()))
--
-- ...elle interroge `organization_members`, ce qui réévalue la même policy, qui
-- interroge à nouveau la table. PostgreSQL détecte la boucle et rejette toute
-- requête avec l'erreur 42P17 « infinite recursion detected in policy ».
--
-- La parade est `app.current_org_role()` : SECURITY DEFINER, elle s'exécute
-- avec les droits du propriétaire de la fonction et contourne donc la RLS de
-- façon contrôlée. Le contournement est SÛR parce que la fonction ne renvoie
-- jamais de données : seulement le rôle de l'appelant, déduit de `auth.uid()`
-- qu'aucun client ne peut falsifier.
--
-- TOUTES les tables des migrations suivantes s'appuient sur ce mécanisme.
-- ─────────────────────────────────────────────────────────────────────────────
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'organization_status') then
    create type public.organization_status as enum ('active', 'suspended', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'invitation_status') then
    create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------
create table if not exists public.organizations (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name           text not null check (char_length(name) between 2 and 120),

  -- Identité commerciale et légale. Nullables : une organisation doit pouvoir
  -- être créée en trois champs, puis complétée. Exiger le SIRET à l'inscription
  -- ferait abandonner la moitié des essais.
  legal_name     text,
  logo_url       text,
  registration_number text,              -- SIRET / SIREN / équivalent étranger
  vat_number     text,
  email          text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone          text,
  address_line1  text,
  address_line2  text,
  postal_code    text,
  city           text,
  country        text default 'FR' check (country is null or char_length(country) = 2),

  status         public.organization_status not null default 'active',

  -- Créateur conservé pour la traçabilité. `on delete set null` et non
  -- `cascade` : la suppression d'un compte utilisateur ne doit jamais entraîner
  -- celle d'une entreprise et de ses interventions.
  created_by     uuid references auth.users (id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.organizations is
  'Tenant racine. Toute donnée du module professionnel référence cette table par organization_id.';

-- Extensibilité §5 : plusieurs établissements viendront comme table fille
-- `establishments (organization_id, ...)`, sans toucher à ce schéma.

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- organization_members
-- -----------------------------------------------------------------------------
create table if not exists public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            public.org_role not null default 'employee',
  status          public.member_status not null default 'active',

  job_title       text,
  phone           text,

  invited_by      uuid references auth.users (id) on delete set null,
  joined_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Un utilisateur ne peut occuper qu'un seul rôle par organisation. Sans cette
  -- contrainte, deux lignes concurrentes rendraient la réponse de
  -- `current_org_role()` non déterministe — donc l'autorisation imprévisible.
  unique (organization_id, user_id)
);

comment on table public.organization_members is
  'Appartenance utilisateur ↔ organisation. Un utilisateur peut appartenir à plusieurs organisations, avec un rôle distinct dans chacune.';

-- L'unique ci-dessus indexe (organization_id, user_id). La requête inverse
-- — « les organisations de l'utilisateur X », exécutée à chaque chargement —
-- a besoin de son propre index.
create index if not exists organization_members_user_idx
  on public.organization_members (user_id)
  where status = 'active';

create index if not exists organization_members_org_role_idx
  on public.organization_members (organization_id, role)
  where status = 'active';

drop trigger if exists organization_members_set_updated_at on public.organization_members;
create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- organization_invitations
-- -----------------------------------------------------------------------------
create table if not exists public.organization_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role            public.org_role not null default 'technician',
  status          public.invitation_status not null default 'pending',

  -- Secret d'acceptation. `default gen_random_uuid()` plutôt qu'une valeur
  -- fournie par le client : un jeton choisi par l'appelant serait devinable.
  token           uuid not null default gen_random_uuid(),

  invited_by      uuid references auth.users (id) on delete set null,
  expires_at      timestamptz not null default (now() + interval '7 days'),
  accepted_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- Une seule invitation en attente par adresse et par organisation : sans cette
-- contrainte, relancer une invitation en créerait une seconde valide, et
-- révoquer la première ne fermerait pas l'accès.
create unique index if not exists organization_invitations_pending_idx
  on public.organization_invitations (organization_id, lower(email))
  where status = 'pending';

create index if not exists organization_invitations_token_idx
  on public.organization_invitations (token)
  where status = 'pending';

-- =============================================================================
-- FONCTIONS D'AUTORISATION — le cœur de l'isolation
-- =============================================================================

-- Rôle de l'utilisateur courant dans une organisation. `null` s'il n'en est pas
-- membre actif.
create or replace function app.current_org_role(p_organization_id uuid)
returns public.org_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.organization_members m
  where m.organization_id = p_organization_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1;
$$;

comment on function app.current_org_role(uuid) is
  'SECURITY DEFINER : contourne la RLS de organization_members pour briser la récursion des policies. Ne renvoie jamais de données, seulement le rôle de l''appelant.';

create or replace function app.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.current_org_role(p_organization_id) is not null;
$$;

-- Contrôle unifié : membre actif ET rôle porteur de la permission.
create or replace function app.has_org_permission(p_organization_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.role_has_permission(app.current_org_role(p_organization_id), p_permission);
$$;

-- Organisations de l'utilisateur courant. Utilisée par les policies des tables
-- filles pour éviter un appel de fonction par ligne : `organization_id in
-- (select app.my_organization_ids())` s'évalue une seule fois par requête.
create or replace function app.my_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
  from public.organization_members m
  where m.user_id = (select auth.uid())
    and m.status = 'active';
$$;

revoke all on function app.current_org_role(uuid) from public, anon;
revoke all on function app.is_org_member(uuid) from public, anon;
revoke all on function app.has_org_permission(uuid, text) from public, anon;
revoke all on function app.my_organization_ids() from public, anon;

grant execute on function app.current_org_role(uuid) to authenticated;
grant execute on function app.is_org_member(uuid) to authenticated;
grant execute on function app.has_org_permission(uuid, text) to authenticated;
grant execute on function app.my_organization_ids() to authenticated;

-- =============================================================================
-- GARDE-FOUS D'INTÉGRITÉ
-- =============================================================================

-- Le créateur devient propriétaire, automatiquement et indissociablement.
-- Laisser le client insérer sa propre ligne `owner` ouvrirait une fenêtre :
-- entre la création de l'organisation et celle du membership, l'organisation
-- n'aurait aucun propriétaire — et n'importe qui pourrait s'y déclarer.
create or replace function app.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.organization_members (organization_id, user_id, role, status, joined_at)
    values (new.id, new.created_by, 'owner', 'active', now())
    on conflict (organization_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_create_owner on public.organizations;
create trigger organizations_create_owner
  after insert on public.organizations
  for each row execute function app.handle_new_organization();

-- Une organisation sans propriétaire est orpheline : personne ne peut plus la
-- facturer, la configurer ni la supprimer. Ce trigger rend l'état impossible,
-- que la tentative vienne d'une rétrogradation, d'une suspension ou d'une
-- suppression.
create or replace function app.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining integer;
begin
  -- Ne se déclenche que si la ligne concernée EST un propriétaire actif.
  -- `new` est NULL sur DELETE : on distingue explicitement les deux cas plutôt
  -- que d'utiliser coalesce(), dont le type de retour est indéterminé sur des
  -- enregistrements composites.
  if old.role <> 'owner' or old.status <> 'active' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  -- Sortie anticipée : la mise à jour ne touche ni le rôle ni le statut.
  if tg_op = 'UPDATE' and new.role = 'owner' and new.status = 'active' then
    return new;
  end if;

  select count(*) into v_remaining
  from public.organization_members
  where organization_id = old.organization_id
    and role = 'owner'
    and status = 'active'
    and id <> old.id;

  if v_remaining = 0 then
    raise exception
      'Impossible de retirer le dernier propriétaire de l''organisation. Nommez d''abord un autre propriétaire.'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists organization_members_protect_last_owner on public.organization_members;
create trigger organization_members_protect_last_owner
  before update or delete on public.organization_members
  for each row execute function app.protect_last_owner();

-- Élévation de privilège : sans ce garde-fou, un admin disposant de
-- `member.update_role` pourrait se promouvoir owner, ou promouvoir un complice.
-- La règle est double : on ne modifie jamais son propre rôle, et seul un owner
-- peut créer un owner.
create or replace function app.prevent_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  -- `service_role` (tâches serveur, migrations) n'a pas d'auth.uid() : on ne
  -- lui applique pas une règle pensée pour les sessions utilisateur.
  if v_actor is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.user_id = v_actor and new.role is distinct from old.role then
    raise exception 'Vous ne pouvez pas modifier votre propre rôle.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Nomination d'un propriétaire : réservée aux propriétaires en place.
  --
  -- L'exception est le BOOTSTRAP. À la création d'une organisation, le trigger
  -- `handle_new_organization` insère la toute première ligne `owner` alors que
  -- l'appelant n'est encore membre de rien : `current_org_role()` renvoie NULL
  -- et la règle refuserait la création. On autorise donc explicitement le cas
  -- « aucun propriétaire actif n'existe encore », qui ne peut se produire qu'à
  -- cet instant — la policy `organizations_insert_self` ayant déjà imposé
  -- created_by = auth.uid().
  if new.role = 'owner' and (tg_op = 'INSERT' or old.role is distinct from 'owner') then
    if exists (
      select 1
      from public.organization_members m
      where m.organization_id = new.organization_id
        and m.role = 'owner'
        and m.status = 'active'
        and m.id <> new.id
    ) and app.current_org_role(new.organization_id) is distinct from 'owner' then
      raise exception 'Seul un propriétaire peut nommer un autre propriétaire.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists organization_members_prevent_escalation on public.organization_members;
create trigger organization_members_prevent_escalation
  before insert or update on public.organization_members
  for each row execute function app.prevent_privilege_escalation();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.organizations           enable row level security;
alter table public.organization_members    enable row level security;
alter table public.organization_invitations enable row level security;

-- ------------------------------------------------------------- organizations
drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member"
  on public.organizations for select
  to authenticated
  using (id in (select app.my_organization_ids()));

-- Tout utilisateur authentifié peut créer SON organisation, et uniquement en
-- s'en déclarant créateur. `created_by` forcé à `auth.uid()` : sans ce
-- `with check`, on pourrait attribuer la propriété à un tiers.
drop policy if exists "organizations_insert_self" on public.organizations;
create policy "organizations_insert_self"
  on public.organizations for insert
  to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "organizations_update_permitted" on public.organizations;
create policy "organizations_update_permitted"
  on public.organizations for update
  to authenticated
  using ((select app.has_org_permission(id, 'organization.update')))
  with check ((select app.has_org_permission(id, 'organization.update')));

drop policy if exists "organizations_delete_owner" on public.organizations;
create policy "organizations_delete_owner"
  on public.organizations for delete
  to authenticated
  using ((select app.has_org_permission(id, 'organization.delete')));

-- -------------------------------------------------------- organization_members
-- Tout membre voit ses collègues : c'est nécessaire pour affecter une mission
-- ou composer une équipe. Le périmètre reste borné à l'organisation.
drop policy if exists "organization_members_select_same_org" on public.organization_members;
create policy "organization_members_select_same_org"
  on public.organization_members for select
  to authenticated
  using (organization_id in (select app.my_organization_ids()));

drop policy if exists "organization_members_insert_permitted" on public.organization_members;
create policy "organization_members_insert_permitted"
  on public.organization_members for insert
  to authenticated
  with check ((select app.has_org_permission(organization_id, 'member.invite')));

drop policy if exists "organization_members_update_permitted" on public.organization_members;
create policy "organization_members_update_permitted"
  on public.organization_members for update
  to authenticated
  using ((select app.has_org_permission(organization_id, 'member.update_role')))
  with check ((select app.has_org_permission(organization_id, 'member.update_role')));

drop policy if exists "organization_members_delete_permitted" on public.organization_members;
create policy "organization_members_delete_permitted"
  on public.organization_members for delete
  to authenticated
  using ((select app.has_org_permission(organization_id, 'member.remove')));

-- --------------------------------------------------- organization_invitations
-- Deux profils de lecture : les gestionnaires de l'organisation, et l'invité
-- lui-même qui doit pouvoir consulter l'invitation reçue avant d'avoir un
-- quelconque rôle.
drop policy if exists "organization_invitations_select" on public.organization_invitations;
create policy "organization_invitations_select"
  on public.organization_invitations for select
  to authenticated
  using (
    (select app.has_org_permission(organization_id, 'member.invite'))
    or lower(email) = lower((select auth.jwt() ->> 'email'))
  );

drop policy if exists "organization_invitations_insert" on public.organization_invitations;
create policy "organization_invitations_insert"
  on public.organization_invitations for insert
  to authenticated
  with check ((select app.has_org_permission(organization_id, 'member.invite')));

drop policy if exists "organization_invitations_update" on public.organization_invitations;
create policy "organization_invitations_update"
  on public.organization_invitations for update
  to authenticated
  using ((select app.has_org_permission(organization_id, 'member.invite')))
  with check ((select app.has_org_permission(organization_id, 'member.invite')));

drop policy if exists "organization_invitations_delete" on public.organization_invitations;
create policy "organization_invitations_delete"
  on public.organization_invitations for delete
  to authenticated
  using ((select app.has_org_permission(organization_id, 'member.invite')));

-- -----------------------------------------------------------------------------
-- Acceptation d'une invitation
-- -----------------------------------------------------------------------------
-- Passe par une fonction et non par un INSERT client : accepter une invitation
-- exige d'écrire dans `organization_members`, ce que l'invité n'a précisément
-- pas le droit de faire — il n'est pas encore membre. SECURITY DEFINER résout
-- la contradiction en vérifiant elle-même les trois conditions (jeton valide,
-- non expiré, adresse correspondante).
create or replace function public.accept_organization_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.organization_invitations;
  v_user_id    uuid := (select auth.uid());
  v_email      text := lower((select auth.jwt() ->> 'email'));
begin
  if v_user_id is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invitation
  from public.organization_invitations
  where token = p_token and status = 'pending'
  for update;

  if not found then
    raise exception 'Invitation introuvable ou déjà utilisée.' using errcode = 'no_data_found';
  end if;

  if v_invitation.expires_at < now() then
    update public.organization_invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'Cette invitation a expiré.' using errcode = 'check_violation';
  end if;

  -- L'invitation est nominative : le jeton seul ne suffit pas, sinon un lien
  -- transféré ouvrirait l'organisation à n'importe qui.
  if lower(v_invitation.email) <> v_email then
    raise exception 'Cette invitation ne correspond pas à votre adresse e-mail.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.organization_members (organization_id, user_id, role, status, invited_by, joined_at)
  values (v_invitation.organization_id, v_user_id, v_invitation.role, 'active', v_invitation.invited_by, now())
  on conflict (organization_id, user_id) do update
    set status = 'active', joined_at = coalesce(public.organization_members.joined_at, now());

  update public.organization_invitations
  set status = 'accepted', accepted_at = now()
  where id = v_invitation.id;

  return v_invitation.organization_id;
end;
$$;

revoke all on function public.accept_organization_invitation(uuid) from public, anon;
grant execute on function public.accept_organization_invitation(uuid) to authenticated;

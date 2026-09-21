-- =============================================================================
-- Le dictionnaire d'organisation pour la transcription
-- =============================================================================
--
-- Phase 6 du chantier « reconnaissance vocale » (ordre validé le 21/09/2026).
--
-- CE QUE C'EST
--
-- Les mots que le moteur de transcription doit connaître pour CETTE
-- entreprise : ses clients, ses sites, ses techniciens, ses communes, ses
-- références de matériel, ses termes techniques à elle. Ils s'ajoutent, en
-- tête, au glossaire du secteur (phase 5) dans la phrase de contexte envoyée
-- au fournisseur — pour les organisations en `stt_engine = 'v2'` seulement.
--
-- MINIMISATION, ISOLATION
--
-- Un terme, un type, une source — rien d'autre. Pas d'adresse, pas de numéro,
-- pas de montant. Le dictionnaire d'une organisation n'est jamais lu pour une
-- autre : RLS par organisation, et le worker lit par `organization_id`
-- explicite. Un terme se supprime. La suggestion automatique propose des NOMS
-- déjà présents dans les données de l'organisation (clients, sites,
-- matériel, membres actifs, communes) ; rien n'entre sans un geste de qui
-- gère le Workspace.
--
-- Qui gère : `workspace.manage` (chef d'équipe et au-dessus). Tout membre lit.
-- =============================================================================

create table public.organization_vocabulary (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  term             text not null,
  type             text not null default 'autre'
                     check (type in ('client', 'site', 'materiel', 'technique', 'personne', 'lieu', 'autre')),
  source           text not null default 'manuel' check (source in ('auto', 'manuel')),
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint organization_vocabulary_term_length check (length(btrim(term)) between 2 and 80),
  -- Un terme est un mot ou un nom, pas une phrase ni un numéro.
  constraint organization_vocabulary_term_shape check (term !~ '[\n\r\t]' and term !~ '^\d+$')
);

comment on table public.organization_vocabulary is
  'Termes propres à une organisation (clients, sites, techniciens, communes, matériel, technique) transmis au moteur de transcription en v2. Isolé par organisation.';

-- Un même terme une seule fois par organisation, quelle que soit la casse.
create unique index organization_vocabulary_unique_idx
  on public.organization_vocabulary (organization_id, lower(btrim(term)));
create index organization_vocabulary_org_type_idx on public.organization_vocabulary (organization_id, type);

create trigger organization_vocabulary_set_updated_at
  before update on public.organization_vocabulary
  for each row execute function public.set_updated_at();

/** Plafond par organisation : au-delà, le prompt n'oriente plus rien. */
create or replace function app.guard_organization_vocabulary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v int;
begin
  new.term := btrim(new.term);
  if tg_op = 'INSERT' then
    new.created_by := coalesce((select auth.uid()), new.created_by);
    select count(*) into v from public.organization_vocabulary where organization_id = new.organization_id;
    if v >= 500 then
      raise exception 'Le dictionnaire est plein (500 termes) : retirez des termes avant d''en ajouter.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app.guard_organization_vocabulary() from public, anon, authenticated;

create trigger organization_vocabulary_guard
  before insert or update on public.organization_vocabulary
  for each row execute function app.guard_organization_vocabulary();

-- -----------------------------------------------------------------------------
-- Droits
-- -----------------------------------------------------------------------------
alter table public.organization_vocabulary enable row level security;
revoke all on table public.organization_vocabulary from public, anon, authenticated;
grant select, insert, delete on public.organization_vocabulary to authenticated;
grant update (term, type) on public.organization_vocabulary to authenticated;
-- Le worker lit, par organisation, jamais tout.
grant select on public.organization_vocabulary to service_role;

create policy organization_vocabulary_select on public.organization_vocabulary for select to authenticated
  using ((select app.is_org_member(organization_id)));
create policy organization_vocabulary_insert on public.organization_vocabulary for insert to authenticated
  with check ((select app.has_org_permission(organization_id, 'workspace.manage')));
create policy organization_vocabulary_update on public.organization_vocabulary for update to authenticated
  using ((select app.has_org_permission(organization_id, 'workspace.manage')))
  with check ((select app.has_org_permission(organization_id, 'workspace.manage')));
create policy organization_vocabulary_delete on public.organization_vocabulary for delete to authenticated
  using ((select app.has_org_permission(organization_id, 'workspace.manage')));

-- -----------------------------------------------------------------------------
-- La suggestion : des noms déjà dans les données de l'organisation
-- -----------------------------------------------------------------------------
-- `security invoker` : la personne ne se voit proposer que ce que sa RLS lui
-- montre (clients, sites, matériel, membres). Rien n'est écrit : proposer
-- n'est pas ajouter. Les termes déjà au dictionnaire sont marqués.
create or replace function public.suggest_organization_vocabulary(p_organization_id uuid)
returns table (term text, type text, already_present boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with candidats as (
    select btrim(c.name) as term, 'client'::text as type
    from public.customers c
    where c.organization_id = p_organization_id and c.status = 'active'
    union
    select btrim(s.name), 'site'
    from public.sites s
    where s.organization_id = p_organization_id and s.status = 'active'
    union
    select btrim(e.name), 'materiel'
    from public.equipment e
    where e.organization_id = p_organization_id
    union
    select btrim(p.display_name), 'personne'
    from public.organization_members m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_organization_id and m.status = 'active' and p.display_name is not null
    union
    select btrim(x.city), 'lieu'
    from (
      select c.city from public.customers c where c.organization_id = p_organization_id and c.city is not null
      union
      select s.city from public.sites s where s.organization_id = p_organization_id and s.city is not null
    ) x
  )
  select k.term, k.type,
         exists (select 1 from public.organization_vocabulary v
                 where v.organization_id = p_organization_id and lower(btrim(v.term)) = lower(k.term)) as already_present
  from candidats k
  where k.term is not null and length(k.term) between 2 and 80 and k.term !~ '^\d+$'
    and app.is_org_member(p_organization_id)
  order by k.type, k.term;
$$;

revoke all on function public.suggest_organization_vocabulary(uuid) from public, anon;
grant execute on function public.suggest_organization_vocabulary(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Auto-vérification
-- -----------------------------------------------------------------------------
do $$
declare v int;
begin
  select count(*) into v from pg_policy p join pg_class c on c.oid = p.polrelid where c.relname = 'organization_vocabulary';
  if v <> 4 then raise exception '% politique(s) RLS au lieu de 4.', v; end if;
end $$;

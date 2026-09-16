-- =============================================================================
-- Administration plateforme — un second primitif d'autorisation, séparé du RBAC tenant
-- =============================================================================
--
-- POURQUOI CE N'EST PAS UNE EXTENSION DE `role_permissions`
--
-- `app.has_org_permission(organization_id, permission)` (20260808100200) exige
-- structurellement un `organization_id` : c'est vrai de `role_permissions`,
-- d'`org_role`, et de toute policy qui s'en sert. Prospect Radar n'appartient
-- à AUCUNE organisation cliente — ni aujourd'hui, ni demain, par construction :
-- une organisation cliente ne doit jamais pouvoir y accéder, même en devenant
-- propriétaire de sa propre organisation. Réutiliser le RBAC tenant y ferait
-- nécessairement fuiter un chemin d'accès. D'où un primitif frère, pas un
-- prolongement : mêmes idées (table, pas enum ; matrice permission ; fonction
-- `security definer` pour l'utiliser dans des policies), zéro dépendance
-- croisée avec `organizations`/`organization_members`.
--
-- POURQUOI DEUX TABLES PLUTÔT QU'UNE SEULE AVEC UN TABLEAU DE PERMISSIONS
--
-- Même raisonnement que `role_permissions` face à un enum : une ligne
-- s'ajoute, un tableau se réécrit. `platform_admin_permissions` accueille
-- líb rement de futures permissions (`prospecting.export`, `billing.internal_view`,
-- peu importe) sans jamais toucher `platform_admins`.
--
-- POURQUOI CES DEUX TABLES VIVENT DANS `public`, PAS DANS `app`
--
-- `app` n'est pas exposé par PostgREST (`schemas = ["public","graphql_public"]`
-- dans supabase/config.toml) : un `grant execute ... to authenticated` sur une
-- fonction `app.*` la rend utilisable DEPUIS une policy ou un déclencheur, pas
-- appelable par `supabase.rpc()` depuis le navigateur. Le frontend a pourtant
-- besoin de savoir si LA SESSION COURANTE est administrateur, pour n'afficher
-- le lien de navigation qu'à qui doit le voir — exactement le rôle que joue
-- `organization_members` pour le RBAC tenant. La policy ci-dessous n'ouvre
-- QUE la ligne de l'appelant : jamais la liste des administrateurs.
-- =============================================================================

create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  -- Traçabilité humaine de l'attribution : jamais un champ technique.
  note       text
);

comment on table public.platform_admins is
  'Administrateurs de la plateforme REZO360 (interne, hors tout tenant). '
  'Alimentée exclusivement par migration ou par un futur outil d''administration — jamais par le client.';

alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from public, anon, authenticated;
grant select on table public.platform_admins to authenticated;

-- Un utilisateur ne voit QUE s'il figure lui-même dans la table — jamais la
-- liste. C'est suffisant pour piloter l'affichage d'un lien de navigation, et
-- ça n'expose rien de plus qu'un « oui/non » sur sa propre session.
create policy "platform_admins_select_self"
  on public.platform_admins for select
  to authenticated
  using (user_id = auth.uid());

create table public.platform_admin_permissions (
  user_id    uuid not null references public.platform_admins (user_id) on delete cascade,
  permission text not null check (permission ~ '^[a-z_]+\.[a-z_]+$'),
  primary key (user_id, permission)
);

comment on table public.platform_admin_permissions is
  'Matrice utilisateur → permission plateforme. Même convention que role_permissions : '
  'une permission de trop ne se remarque jamais, une permission manquante se remarque tout de suite.';

alter table public.platform_admin_permissions enable row level security;
revoke all on table public.platform_admin_permissions from public, anon, authenticated;
grant select on table public.platform_admin_permissions to authenticated;

create policy "platform_admin_permissions_select_self"
  on public.platform_admin_permissions for select
  to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Fonctions d'autorisation — utilisées PAR les policies des tables Prospect Radar
-- -----------------------------------------------------------------------------
create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

revoke all on function app.is_platform_admin() from public, anon;
grant execute on function app.is_platform_admin() to authenticated;

create or replace function app.has_platform_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admin_permissions
    where user_id = (select auth.uid()) and permission = p_permission
  );
$$;

revoke all on function app.has_platform_permission(text) from public, anon;
grant execute on function app.has_platform_permission(text) to authenticated;

comment on function app.has_platform_permission(text) is
  'Contrôle d''une permission plateforme (prospecting.view, prospecting.manage…). '
  'Sans lien avec app.has_org_permission : aucune organisation n''intervient jamais ici.';

-- -----------------------------------------------------------------------------
-- Attribution du premier administrateur — RÉSOLUE, jamais un UUID en dur
-- -----------------------------------------------------------------------------
-- Le compte a été créé de façon contrôlée, hors de cette migration (aucun mot
-- de passe ni hash ne doit figurer dans un historique versionné). Cette
-- migration se contente de retrouver son user_id par e-mail AU MOMENT DE SON
-- application, et échoue bruyamment s'il n'existe pas — plutôt que de
-- continuer en silence sans administrateur, ce qui laisserait Prospect Radar
-- inaccessible sans que rien ne le signale.
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = 'contact@rezo360.fr';

  if v_user_id is null then
    raise exception
      'contact@rezo360.fr est introuvable dans auth.users. '
      'Créez ce compte avant d''appliquer cette migration — voir la documentation de Prospect Radar.'
      using errcode = 'foreign_key_violation';
  end if;

  insert into public.platform_admins (user_id, granted_by, note)
  values (v_user_id, v_user_id, 'Premier administrateur plateforme — attribution initiale, Phase 2 Prospect Radar.')
  on conflict (user_id) do nothing;

  insert into public.platform_admin_permissions (user_id, permission)
  values (v_user_id, 'prospecting.view'), (v_user_id, 'prospecting.manage')
  on conflict (user_id, permission) do nothing;
end
$$;

-- Contrôle : sans administrateur après cette migration, tout le module serait
-- construit sans que personne ne puisse jamais l'atteindre.
do $$
begin
  if not exists (select 1 from public.platform_admins) then
    raise exception 'Aucun platform_admin après migration : vérifier l''attribution ci-dessus.';
  end if;
end
$$;

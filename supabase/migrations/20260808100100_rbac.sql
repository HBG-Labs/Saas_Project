-- =============================================================================
-- Socle RBAC — schéma privé `app`, rôles et matrice de permissions
-- =============================================================================
-- Cette migration ne crée AUCUNE table métier. Elle pose le vocabulaire dont
-- toutes les suivantes dépendent : le schéma privé, les énumérations et la
-- matrice rôle → permission.
--
-- POURQUOI UN SCHÉMA `app` SÉPARÉ
-- PostgREST expose automatiquement le schéma `public`. Une fonction qui décide
-- des droits n'a rien à faire dans une API publique : la placer dans `app`,
-- non exposé, la rend inappelable depuis le navigateur tout en restant
-- utilisable par les policies.
--
-- POURQUOI UNE TABLE ET NON UN `case` DANS UNE FONCTION
-- Le §12 du cahier des charges demande de pouvoir affiner les permissions plus
-- tard. Avec une matrice en dur, ajouter un rôle est un déploiement ; avec une
-- table, c'est une ligne. La contrepartie — un accès table dans le chemin des
-- policies — est neutralisée par le cache décrit plus bas.
-- =============================================================================

create schema if not exists app;

-- `app` n'est PAS exposé par PostgREST : aucune de ces fonctions n'est
-- appelable depuis le client, même authentifié.
revoke all on schema app from public;
grant usage on schema app to authenticated, anon, service_role;

-- -----------------------------------------------------------------------------
-- Énumérations
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'org_role') then
    -- Hiérarchie décroissante de privilèges. L'ordre de déclaration est
    -- significatif : il permet les comparaisons `>=` sur l'enum.
    create type public.org_role as enum (
      'owner',        -- contrôle total, y compris facturation et suppression
      'admin',        -- gestion des membres, équipes, missions
      'manager',      -- gestion des équipes et missions, contrôle des CR
      'team_leader',  -- pilotage de SES équipes
      'technician',   -- exécution de SES missions
      'employee'      -- consultation restreinte
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'member_status') then
    create type public.member_status as enum ('invited', 'active', 'suspended', 'removed');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Matrice des permissions
-- -----------------------------------------------------------------------------
-- Convention de nommage : `<ressource>.<action>`. Les permissions sont des
-- `text` et non un enum : un enum imposerait `ALTER TYPE` — donc un verrou —
-- à chaque nouvelle capacité, alors que la contrainte d'intégrité utile est
-- déjà assurée par la clé primaire composite.
create table if not exists public.role_permissions (
  role       public.org_role not null,
  permission text not null check (permission ~ '^[a-z_]+\.[a-z_]+$'),
  primary key (role, permission)
);

comment on table public.role_permissions is
  'Matrice rôle → permission. Source de vérité de l''autorisation, reflétée en TypeScript par src/features/organizations/rbac.ts (égalité vérifiée par test).';

alter table public.role_permissions enable row level security;

-- Lecture seule pour les utilisateurs connectés : le frontend doit pouvoir
-- masquer les actions interdites. Cacher la matrice n'apporterait rien —
-- l'autorisation réelle est appliquée par les policies, pas par l'UI.
-- Aucune policy d'écriture : la matrice s'administre par migration.
drop policy if exists "role_permissions_select" on public.role_permissions;
create policy "role_permissions_select"
  on public.role_permissions for select
  to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- Seed de la matrice
-- -----------------------------------------------------------------------------
-- ⚠️ CONTREPARTIE SQL DE src/features/organizations/rbac.ts.
-- `rbac.test.ts` lit ce fichier et compare paire par paire.
--
-- Principe du moindre privilège : chaque ligne doit pouvoir être justifiée.
-- En cas de doute, on ne l'ajoute pas — une permission manquante se remarque,
-- une permission de trop ne se remarque jamais.
-- -----------------------------------------------------------------------------
delete from public.role_permissions;

insert into public.role_permissions (role, permission) values
  -- ---------------------------------------------------------------- owner
  ('owner', 'organization.view'),
  ('owner', 'organization.update'),
  ('owner', 'organization.delete'),
  ('owner', 'billing.view'),
  ('owner', 'billing.manage'),
  ('owner', 'member.view'),
  ('owner', 'member.invite'),
  ('owner', 'member.update_role'),
  ('owner', 'member.remove'),
  ('owner', 'team.view'),
  ('owner', 'team.create'),
  ('owner', 'team.update'),
  ('owner', 'team.delete'),
  ('owner', 'team.assign_member'),
  ('owner', 'mission.view_all'),
  ('owner', 'mission.create'),
  ('owner', 'mission.update'),
  ('owner', 'mission.delete'),
  ('owner', 'mission.assign'),
  ('owner', 'mission.cancel'),
  ('owner', 'intervention.view_all'),
  ('owner', 'intervention.review'),
  ('owner', 'audit.view'),
  ('owner', 'statistics.view'),

  -- ---------------------------------------------------------------- admin
  -- Tout sauf la suppression de l'organisation et la gestion de la
  -- facturation : ce sont des actes de propriété, pas d'administration.
  ('admin', 'organization.view'),
  ('admin', 'organization.update'),
  ('admin', 'billing.view'),
  ('admin', 'member.view'),
  ('admin', 'member.invite'),
  ('admin', 'member.update_role'),
  ('admin', 'member.remove'),
  ('admin', 'team.view'),
  ('admin', 'team.create'),
  ('admin', 'team.update'),
  ('admin', 'team.delete'),
  ('admin', 'team.assign_member'),
  ('admin', 'mission.view_all'),
  ('admin', 'mission.create'),
  ('admin', 'mission.update'),
  ('admin', 'mission.delete'),
  ('admin', 'mission.assign'),
  ('admin', 'mission.cancel'),
  ('admin', 'intervention.view_all'),
  ('admin', 'intervention.review'),
  ('admin', 'audit.view'),
  ('admin', 'statistics.view'),

  -- -------------------------------------------------------------- manager
  -- Pilote l'activité terrain. Ne touche ni aux rôles, ni à la facturation,
  -- ni aux paramètres de l'organisation.
  ('manager', 'organization.view'),
  ('manager', 'member.view'),
  ('manager', 'team.view'),
  ('manager', 'team.create'),
  ('manager', 'team.update'),
  ('manager', 'team.assign_member'),
  ('manager', 'mission.view_all'),
  ('manager', 'mission.create'),
  ('manager', 'mission.update'),
  ('manager', 'mission.assign'),
  ('manager', 'mission.cancel'),
  ('manager', 'intervention.view_all'),
  ('manager', 'intervention.review'),
  ('manager', 'statistics.view'),

  -- ---------------------------------------------------------- team_leader
  -- `mission.view_all` est ABSENT volontairement : le chef d'équipe voit les
  -- missions de SES équipes, ce que la policy détermine par appartenance, pas
  -- par permission globale.
  ('team_leader', 'organization.view'),
  ('team_leader', 'member.view'),
  ('team_leader', 'team.view'),
  ('team_leader', 'team.assign_member'),
  ('team_leader', 'mission.create'),
  ('team_leader', 'mission.update'),
  ('team_leader', 'mission.assign'),
  ('team_leader', 'intervention.review'),
  ('team_leader', 'statistics.view'),

  -- ----------------------------------------------------------- technician
  -- Aucune permission de contrôle. `intervention.review` est absent : c'est la
  -- traduction de l'exigence « un technicien ne valide jamais une intervention
  -- qu'il a réalisée » — ici il n'en valide aucune.
  ('technician', 'organization.view'),
  ('technician', 'team.view'),
  ('technician', 'member.view'),

  -- ------------------------------------------------------------- employee
  -- Le strict minimum permettant d'exister dans l'organisation.
  ('employee', 'organization.view'),
  ('employee', 'member.view');

-- -----------------------------------------------------------------------------
-- Cache de la matrice
-- -----------------------------------------------------------------------------
-- Les policies interrogent les permissions à chaque ligne évaluée. Sans cache,
-- lister 500 missions déclencherait 500 lectures de `role_permissions`.
--
-- La matrice ne change qu'au déploiement : une vue matérialisée agrégée en
-- tableau réduit le contrôle à une recherche dans un `text[]` en mémoire.
drop materialized view if exists app.role_permission_cache;
create materialized view app.role_permission_cache as
select role, array_agg(permission order by permission) as permissions
from public.role_permissions
group by role;

create unique index if not exists role_permission_cache_role_idx
  on app.role_permission_cache (role);

-- -----------------------------------------------------------------------------
-- Contrôle d'une permission pour un rôle
-- -----------------------------------------------------------------------------
-- `stable` : le résultat ne change pas dans une même requête, Postgres peut
-- donc mettre en cache l'appel. `set search_path = ''` : obligatoire sur toute
-- fonction privilégiée, sous peine de détournement par un schéma malveillant
-- placé en tête de chemin.
create or replace function app.role_has_permission(p_role public.org_role, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p_permission = any (c.permissions)
     from app.role_permission_cache c
     where c.role = p_role),
    false
  );
$$;

revoke all on function app.role_has_permission(public.org_role, text) from public, anon;
grant execute on function app.role_has_permission(public.org_role, text) to authenticated;

-- Rafraîchit le cache après modification de la matrice. À appeler en fin de
-- toute migration qui touche `role_permissions`.
create or replace function app.refresh_role_permission_cache()
returns void
language sql
security definer
set search_path = ''
as $$
  refresh materialized view concurrently app.role_permission_cache;
$$;

revoke all on function app.refresh_role_permission_cache() from public, anon, authenticated;

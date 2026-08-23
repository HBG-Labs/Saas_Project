-- =============================================================================
-- Durcissement du volet Administration & Persistance des Préférences
-- =============================================================================
--
-- 1. `organizations.default_vat_rate` : taux de TVA par défaut centralisé
-- 2. `public.user_preferences` : préférences de notifications et cartographie
-- 3. Policy `organization_members_update_self` : auto-édition du poste et contact
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. organizations : default_vat_rate
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists default_vat_rate numeric(5, 2) default 20.00 check (default_vat_rate >= 0 and default_vat_rate <= 100);

comment on column public.organizations.default_vat_rate is
  'Taux de TVA par défaut (%) appliqué aux nouveaux devis et chiffrages de l''entreprise.';

-- -----------------------------------------------------------------------------
-- 2. user_preferences : persistance des alertes et options cockpit
-- -----------------------------------------------------------------------------
create table if not exists public.user_preferences (
  user_id                   uuid primary key references auth.users (id) on delete cascade,
  notify_new_mission        boolean not null default true,
  notify_maintenance_due    boolean not null default true,
  notify_stock_low          boolean not null default true,
  notify_leave_requests     boolean not null default true,
  sms_urgent_alerts         boolean not null default false,
  traffic_layer             boolean not null default true,
  vehicle_type              text not null default 'van',
  gps_refresh_rate          integer not null default 30 check (gps_refresh_rate >= 5 and gps_refresh_rate <= 300),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table public.user_preferences is
  'Préférences individuelles d''affichage, d''alertes et de cartographie synchronisées par utilisateur.';

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own"
  on public.user_preferences for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own"
  on public.user_preferences for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own"
  on public.user_preferences for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "user_preferences_delete_own" on public.user_preferences;
create policy "user_preferences_delete_own"
  on public.user_preferences for delete
  to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.user_preferences to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Policy RLS auto-mise à jour sur organization_members
-- -----------------------------------------------------------------------------
-- Permet à tout membre actif de modifier ses coordonnées personnelles (téléphone,
-- intitulé de poste) sur son propre enregistrement, sans exiger `member.update_role`.
-- Les tentatives d'auto-promotion de rôle ou statut restent strictement
-- interceptées et rejetées par le trigger `app.prevent_privilege_escalation()`.

drop policy if exists "organization_members_update_self" on public.organization_members;
create policy "organization_members_update_self"
  on public.organization_members for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

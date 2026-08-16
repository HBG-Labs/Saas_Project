-- =============================================================================
-- Cartographie & suivi GPS des intervenants
-- =============================================================================
--
-- LE CONSTAT
--
-- L'écran « Cartographie & Live GPS » affiche des intervenants en déplacement,
-- leur vitesse, leur batterie, leur trajet des dernières heures. Tout cela vient
-- de `mock-geo-data.ts` : des personnes inventées à des coordonnées inventées.
--
-- CE QUI N'EST PAS CRÉÉ, ET POURQUOI
--
-- Les CHANTIERS affichés sur la carte ne demandent aucune table. Une mission
-- porte déjà `latitude`, `longitude`, `reference`, `priority`, `status`,
-- `scheduled_start`, son client et son intervenant. La carte les lit ; en
-- créer une copie garantirait la divergence.
--
-- CE QUE LA LOI IMPOSE, ET QUE LE SCHÉMA APPLIQUE
--
-- Géolocaliser un salarié est encadré. La CNIL exige que le dispositif soit
-- proportionné, que les personnes soient informées, et que les données ne
-- soient pas conservées au-delà de deux mois en usage courant. Trois décisions
-- en découlent, inscrites dans le schéma plutôt que dans une note de service :
--
--   1. Le partage est un CHOIX. L'absence de ligne vaut absence de suivi. Un
--      intervenant supprime sa ligne et cesse d'être localisé — la policy de
--      suppression ne demande aucune permission, seulement d'être soi.
--   2. Personne n'écrit la position de quelqu'un d'autre. Pas même un
--      propriétaire : une position n'est pas une donnée de gestion, c'est une
--      déclaration faite par l'appareil de la personne.
--   3. La purge est AUTOMATIQUE. Chaque relevé élague la piste du même
--      intervenant au-delà de la fenêtre de conservation. Une fonction de purge
--      à programmer serait une fonction que personne ne programme.
--
-- Ce que le schéma ne peut pas faire : informer les salariés, et justifier la
-- proportionnalité du dispositif. Cela reste à la charge de l'employeur.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'technician_presence') then
    create type public.technician_presence as enum (
      'on_road', 'on_site', 'available', 'offline'
    );
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- technician_locations — la position courante
-- -----------------------------------------------------------------------------
--
-- Une ligne par membre, remplacée à chaque relevé. La clé primaire EST le
-- membre : il n'y a pas deux positions courantes d'une même personne, et un
-- `upsert` sur cette clé est l'écriture naturelle du client mobile.
create table if not exists public.technician_locations (
  member_id       uuid primary key references public.organization_members (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  latitude        double precision not null check (latitude between -90 and 90),
  longitude       double precision not null check (longitude between -180 and 180),
  accuracy_m      numeric(7,2) check (accuracy_m is null or accuracy_m >= 0),
  heading         numeric(5,2) check (heading is null or heading between 0 and 360),
  speed_kmh       numeric(6,2) check (speed_kmh is null or speed_kmh >= 0),
  battery_pct     smallint check (battery_pct is null or battery_pct between 0 and 100),
  presence        public.technician_presence not null default 'available',
  vehicle_plate   text check (vehicle_plate is null or char_length(vehicle_plate) <= 20),
  -- Horodatage du RELEVÉ, distinct de `updated_at` : un appareil hors réseau
  -- transmet en différé, et confondre les deux ferait croire à une position
  -- fraîche.
  recorded_at     timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists technician_locations_org_idx
  on public.technician_locations (organization_id, recorded_at desc);

drop trigger if exists technician_locations_set_updated_at on public.technician_locations;
create trigger technician_locations_set_updated_at
  before update on public.technician_locations
  for each row execute function public.set_updated_at();

drop trigger if exists technician_locations_organization_immutable on public.technician_locations;
create trigger technician_locations_organization_immutable
  before update on public.technician_locations
  for each row execute function app.enforce_organization_immutable();

-- -----------------------------------------------------------------------------
-- technician_location_pings — la piste
-- -----------------------------------------------------------------------------
create table if not exists public.technician_location_pings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id       uuid not null references public.organization_members (id) on delete cascade,
  latitude        double precision not null check (latitude between -90 and 90),
  longitude       double precision not null check (longitude between -180 and 180),
  heading         numeric(5,2) check (heading is null or heading between 0 and 360),
  speed_kmh       numeric(6,2) check (speed_kmh is null or speed_kmh >= 0),
  battery_pct     smallint check (battery_pct is null or battery_pct between 0 and 100),
  presence        public.technician_presence not null default 'available',
  note            text check (note is null or char_length(note) <= 300),
  recorded_at     timestamptz not null default now()
);

-- Sert la lecture d'une piste ET la purge : c'est le même parcours.
create index if not exists technician_location_pings_trail_idx
  on public.technician_location_pings (member_id, recorded_at desc);

-- -----------------------------------------------------------------------------
-- La position appartient à celui qui la déclare
-- -----------------------------------------------------------------------------
--
-- Le contrôle est fait ici plutôt que dans la policy pour une raison précise :
-- il faut vérifier à la fois que le membre est bien l'appelant ET que
-- l'organisation portée par la ligne est celle du membre. Une policy qui ne
-- regarderait que `organization_id` laisserait passer une position attribuée à
-- un collègue de la même entreprise.
create or replace function app.enforce_location_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_org  uuid;
  v_member_user uuid;
begin
  select m.organization_id, m.user_id into v_member_org, v_member_user
  from public.organization_members m
  where m.id = new.member_id;

  if v_member_org is distinct from new.organization_id then
    raise exception 'Ce membre n''appartient pas à cette organisation.'
      using errcode = 'foreign_key_violation';
  end if;

  if v_member_user is distinct from (select auth.uid()) then
    raise exception 'Une position ne peut être déclarée que par la personne concernée.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists technician_locations_ownership on public.technician_locations;
create trigger technician_locations_ownership
  before insert or update on public.technician_locations
  for each row execute function app.enforce_location_ownership();

drop trigger if exists technician_location_pings_ownership on public.technician_location_pings;
create trigger technician_location_pings_ownership
  before insert on public.technician_location_pings
  for each row execute function app.enforce_location_ownership();

-- -----------------------------------------------------------------------------
-- Purge automatique de la piste
-- -----------------------------------------------------------------------------
--
-- Soixante jours, la limite d'usage courant retenue par la CNIL pour un suivi
-- de véhicules professionnels.
--
-- Déclenchée par l'écriture plutôt que programmée : une purge confiée à un
-- planificateur dépend d'une extension à activer et d'une tâche à surveiller.
-- Celle-ci ne peut pas être oubliée, puisqu'elle s'exécute à l'endroit même où
-- la donnée est produite. L'index `(member_id, recorded_at desc)` la rend
-- proportionnée : elle ne balaie jamais la table entière.
create or replace function app.prune_location_trail()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.technician_location_pings
  where member_id = new.member_id
    and recorded_at < now() - interval '60 days';

  return null;
end;
$$;

drop trigger if exists technician_location_pings_prune on public.technician_location_pings;
create trigger technician_location_pings_prune
  after insert on public.technician_location_pings
  for each row execute function app.prune_location_trail();

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
--
-- Une seule permission, et elle ne concerne QUE la lecture d'autrui. Il n'existe
-- pas de `location.manage` : personne ne modifie la position d'un tiers, quel
-- que soit son rôle. Le droit d'écrire n'est pas un rôle, c'est une identité.
--
-- Le chef d'équipe l'obtient : répartir des urgences sans savoir qui est le plus
-- proche n'a pas de sens. Le technicien ne l'obtient pas — suivre ses collègues
-- n'entre pas dans son travail.
insert into public.role_permissions (role, permission) values
  ('owner',       'location.view_all'),
  ('admin',       'location.view_all'),
  ('manager',     'location.view_all'),
  ('team_leader', 'location.view_all')
on conflict (role, permission) do nothing;

-- -----------------------------------------------------------------------------
-- Entitlement
-- -----------------------------------------------------------------------------
insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('business', 'live_tracking', null),
  ('ultimate', 'live_tracking', null)
on conflict (plan_code, feature_key) do update set
  limit_value = excluded.limit_value;

-- -----------------------------------------------------------------------------
-- Privilèges et RLS
-- -----------------------------------------------------------------------------
revoke all on public.technician_locations      from public, anon, authenticated;
revoke all on public.technician_location_pings from public, anon, authenticated;

grant select, insert, update, delete on public.technician_locations      to authenticated;
-- Aucun UPDATE sur la piste : un relevé passé ne se réécrit pas.
grant select, insert, delete         on public.technician_location_pings to authenticated;

alter table public.technician_locations      enable row level security;
alter table public.technician_location_pings enable row level security;

-- ── technician_locations ─────────────────────────────────────────────────────
drop policy if exists "technician_locations_select" on public.technician_locations;
create policy "technician_locations_select"
  on public.technician_locations for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'live_tracking'))
    and (
      (select app.has_org_permission(organization_id, 'location.view_all'))
      or (select app.is_own_membership(member_id))
    )
  );

-- Écriture réservée à soi-même. Le trigger le vérifie aussi, et ce n'est pas
-- redondant : la policy refuse sans bruit, le trigger explique pourquoi.
drop policy if exists "technician_locations_insert" on public.technician_locations;
create policy "technician_locations_insert"
  on public.technician_locations for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'live_tracking'))
    and (select app.is_own_membership(member_id))
  );

drop policy if exists "technician_locations_update" on public.technician_locations;
create policy "technician_locations_update"
  on public.technician_locations for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'live_tracking'))
    and (select app.is_own_membership(member_id))
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'live_tracking'))
    and (select app.is_own_membership(member_id))
  );

-- Cesser de partager sa position est un droit, pas une faveur : aucune
-- permission demandée, et le module n'a même pas besoin d'être actif — une
-- entreprise qui résilie ne doit pas retenir ses salariés sur la carte.
drop policy if exists "technician_locations_delete" on public.technician_locations;
create policy "technician_locations_delete"
  on public.technician_locations for delete
  to authenticated
  using ((select app.is_own_membership(member_id)));

-- ── technician_location_pings ────────────────────────────────────────────────
drop policy if exists "technician_location_pings_select" on public.technician_location_pings;
create policy "technician_location_pings_select"
  on public.technician_location_pings for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'live_tracking'))
    and (
      (select app.has_org_permission(organization_id, 'location.view_all'))
      or (select app.is_own_membership(member_id))
    )
  );

drop policy if exists "technician_location_pings_insert" on public.technician_location_pings;
create policy "technician_location_pings_insert"
  on public.technician_location_pings for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'live_tracking'))
    and (select app.is_own_membership(member_id))
  );

drop policy if exists "technician_location_pings_delete" on public.technician_location_pings;
create policy "technician_location_pings_delete"
  on public.technician_location_pings for delete
  to authenticated
  using ((select app.is_own_membership(member_id)));

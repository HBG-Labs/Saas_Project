-- =============================================================================
-- Le parc roulant, enfin en base
-- =============================================================================
--
-- CE QUE CETTE MIGRATION RÉPARE
--
-- Le module Véhicules avait un écran complet, une modale d'édition, un
-- historique d'entretien — et aucune table. Tout vivait dans `localStorage`,
-- semé au premier accès avec une flotte INVENTÉE : un Renault Trafic
-- immatriculé GK-482-TZ apparaissait chez chaque entreprise.
--
-- Trois conséquences, aucune visible depuis l'interface :
--
--   • le client découvrait des véhicules qu'il n'avait jamais saisis ;
--   • ce qu'il corrigeait ne quittait pas SON navigateur — invisible pour ses
--     collègues, absent de son téléphone, perdu au premier nettoyage de cache ;
--   • rien de tout cela n'était couvert par la RLS ni par les sauvegardes.
--
-- POURQUOI RÉUTILISER LES DROITS D'`equipment`
--
-- Les véhicules sont le parc ROULANT du même parc : une entreprise qui gère son
-- outillage gère ses fourgons. Créer `vehicles.view` et `vehicles.manage`
-- imposerait six lignes de plus dans `role_permissions`, trois dans
-- `plan_features`, et deux jeux de droits à garder cohérents pour une
-- distinction que personne ne fait sur le terrain.
--
-- Conséquence assumée : qui voit l'outillage voit les véhicules. C'est le
-- comportement attendu, et il se sépare le jour où quelqu'un le demande.
-- =============================================================================

create type public.vehicle_type as enum ('van', 'truck', 'car', 'aerial_lift', 'utility');
create type public.vehicle_fuel as enum ('diesel', 'essence', 'electric', 'hybrid');
create type public.vehicle_status as enum (
  'in_service', 'available', 'maintenance', 'out_of_service'
);
create type public.vehicle_maintenance_type as enum (
  'revision', 'controle_technique', 'pneus', 'freins', 'vidange', 'reparation', 'autre'
);

create table if not exists public.vehicles (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  -- L'immatriculation identifie le véhicule auprès de l'État : deux véhicules
  -- distincts d'une même entreprise ne peuvent pas la partager.
  plate                  text not null check (char_length(plate) between 2 and 20),
  brand                  text not null check (char_length(brand) between 1 and 60),
  model                  text not null check (char_length(model) between 1 and 80),
  type                   public.vehicle_type not null default 'van',
  fuel                   public.vehicle_fuel not null default 'diesel',
  status                 public.vehicle_status not null default 'available',
  -- Un compteur ne recule pas, et aucun utilitaire ne dépasse deux millions.
  mileage                integer not null default 0 check (mileage between 0 and 2000000),
  assigned_member_id     uuid references public.organization_members (id) on delete set null,
  next_ct_date           date,
  next_revision_date     date,
  next_revision_mileage  integer check (next_revision_mileage is null or next_revision_mileage >= 0),
  insurance_expiry_date  date,
  notes                  text,
  created_by             uuid references auth.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- Un véhicule « sur le terrain » est conduit par quelqu'un. Sans cette
  -- contrainte, l'écran affiche « en service » sans dire par qui.
  constraint vehicles_assignment_coherent check (
    (status = 'in_service' and assigned_member_id is not null)
    or (status <> 'in_service')
  )
);

create unique index if not exists vehicles_plate_idx
  on public.vehicles (organization_id, upper(plate));

create index if not exists vehicles_organization_idx
  on public.vehicles (organization_id, status);

-- L'écran met en avant ce qui arrive à échéance — contrôle technique et
-- révision sont les deux premières questions posées à une flotte.
create index if not exists vehicles_next_ct_idx
  on public.vehicles (organization_id, next_ct_date)
  where next_ct_date is not null;

-- -----------------------------------------------------------------------------
-- Historique d'entretien
-- -----------------------------------------------------------------------------
--
-- Table fille, contrairement aux pièces jointes du support : un entretien se
-- consulte, se trie par date et se totalise en coût. Le loger dans un `jsonb`
-- interdirait tout cela.

create table if not exists public.vehicle_maintenance_records (
  id           uuid primary key default gen_random_uuid(),
  vehicle_id   uuid not null references public.vehicles (id) on delete cascade,
  performed_on date not null,
  type         public.vehicle_maintenance_type not null default 'autre',
  description  text not null check (char_length(description) between 2 and 500),
  mileage      integer not null check (mileage between 0 and 2000000),
  cost_cents   integer check (cost_cents is null or cost_cents >= 0),
  performed_by text,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists vehicle_maintenance_vehicle_idx
  on public.vehicle_maintenance_records (vehicle_id, performed_on desc);

-- -----------------------------------------------------------------------------
-- Garde-fous
-- -----------------------------------------------------------------------------

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

/**
 * Le conducteur affecté appartient à la même organisation.
 *
 * Sans ce garde-fou, un identifiant de membre d'une AUTRE entreprise, forgé à
 * la main, passerait : la policy ne contrôle que `organization_id`, pas ce que
 * la ligne référence. Même précaution que `enforce_equipment_assignee_org`.
 */
create or replace function app.enforce_vehicle_assignee_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_org uuid;
begin
  if new.assigned_member_id is null then
    return new;
  end if;

  select m.organization_id into v_member_org
  from public.organization_members m
  where m.id = new.assigned_member_id;

  if v_member_org is distinct from new.organization_id then
    raise exception 'Ce membre n''appartient pas à cette organisation.'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists vehicles_assignee_org on public.vehicles;
create trigger vehicles_assignee_org
  before insert or update on public.vehicles
  for each row execute function app.enforce_vehicle_assignee_org();

drop trigger if exists vehicles_organization_immutable on public.vehicles;
create trigger vehicles_organization_immutable
  before update on public.vehicles
  for each row execute function app.enforce_organization_immutable();

-- -----------------------------------------------------------------------------
-- Droits
-- -----------------------------------------------------------------------------

alter table public.vehicles enable row level security;
alter table public.vehicle_maintenance_records enable row level security;

drop policy if exists "vehicles_select" on public.vehicles;
create policy "vehicles_select"
  on public.vehicles for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'equipment'))
    and (select app.has_org_permission(organization_id, 'equipment.view'))
  );

drop policy if exists "vehicles_insert" on public.vehicles;
create policy "vehicles_insert"
  on public.vehicles for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'equipment'))
    and (select app.has_org_permission(organization_id, 'equipment.manage'))
  );

drop policy if exists "vehicles_update" on public.vehicles;
create policy "vehicles_update"
  on public.vehicles for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'equipment'))
    and (select app.has_org_permission(organization_id, 'equipment.manage'))
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'equipment'))
    and (select app.has_org_permission(organization_id, 'equipment.manage'))
  );

drop policy if exists "vehicles_delete" on public.vehicles;
create policy "vehicles_delete"
  on public.vehicles for delete
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'equipment'))
    and (select app.has_org_permission(organization_id, 'equipment.manage'))
  );

-- L'historique suit son véhicule : la portée se lit à travers lui, jamais en
-- recopiant `organization_id`. Une colonne dupliquée finirait par diverger, et
-- c'est précisément par là qu'une fuite inter-organisation s'installe.
drop policy if exists "vehicle_maintenance_select" on public.vehicle_maintenance_records;
create policy "vehicle_maintenance_select"
  on public.vehicle_maintenance_records for select
  to authenticated
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id
        and (select app.can_use_pro_module(v.organization_id, 'equipment'))
        and (select app.has_org_permission(v.organization_id, 'equipment.view'))
    )
  );

drop policy if exists "vehicle_maintenance_insert" on public.vehicle_maintenance_records;
create policy "vehicle_maintenance_insert"
  on public.vehicle_maintenance_records for insert
  to authenticated
  with check (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id
        and (select app.can_use_pro_module(v.organization_id, 'equipment'))
        and (select app.has_org_permission(v.organization_id, 'equipment.manage'))
    )
  );

drop policy if exists "vehicle_maintenance_delete" on public.vehicle_maintenance_records;
create policy "vehicle_maintenance_delete"
  on public.vehicle_maintenance_records for delete
  to authenticated
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id
        and (select app.can_use_pro_module(v.organization_id, 'equipment'))
        and (select app.has_org_permission(v.organization_id, 'equipment.manage'))
    )
  );

-- Pas de policy UPDATE sur l'historique : un entretien passé ne se réécrit pas.
-- Une correction s'ajoute, ce qui conserve la trace de l'original.

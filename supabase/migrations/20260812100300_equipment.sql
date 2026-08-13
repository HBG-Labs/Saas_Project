-- =============================================================================
-- Parc matériel & outillage
-- =============================================================================
--
-- LE CONSTAT
--
-- L'écran « Parc Matériel » gère un inventaire complet — réflectomètres,
-- soudeuses, pinces ampèremétriques, harnais — avec affectation à un technicien
-- et dates d'étalonnage. Tout cela vivait dans une clé `localStorage`
-- (`nexoratech_equipment_fleet`) : propre au navigateur de la personne qui a
-- saisi, invisible pour l'équipe, perdu au premier nettoyage du cache.
--
-- Or l'étalonnage n'est pas une information de confort. Un OTDR hors validité
-- invalide une recette ; un harnais périmé engage la responsabilité de
-- l'employeur. Ces dates doivent vivre là où toute l'entreprise les voit.
--
-- CE QUI EST MODÉLISÉ, ET CE QUI NE L'EST PAS
--
-- L'affectation pointe vers `organization_members`, pas vers un texte libre :
-- « Stéphane Leduc » saisi à la main ne survit pas à un homonyme ni à un départ.
-- La colonne est nullable — du matériel au magasin n'est affecté à personne — et
-- passe à NULL si le membre disparaît, sans emporter l'appareil.
--
-- L'historique des affectations n'est PAS modélisé. Il le sera si le besoin
-- apparaît ; anticiper une table `equipment_assignments` que rien n'alimente
-- ajouterait du schéma sans usage.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
--
-- Des énumérations plutôt que du texte libre : l'interface filtre par statut et
-- compte par catégorie. Une faute de frappe créerait une catégorie fantôme dans
-- les compteurs, sans que rien ne le signale.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'equipment_category') then
    create type public.equipment_category as enum ('optique', 'electricite', 'radio', 'securite', 'autre');
  end if;

  if not exists (select 1 from pg_type where typname = 'equipment_status') then
    create type public.equipment_status as enum ('available', 'assigned', 'maintenance', 'expired');
  end if;

  if not exists (select 1 from pg_type where typname = 'equipment_condition') then
    create type public.equipment_condition as enum ('neuf', 'bon_etat', 'a_reviser');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- equipment
-- -----------------------------------------------------------------------------
create table if not exists public.equipment (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  name               text not null check (char_length(name) between 2 and 150),
  brand              text,
  -- Le numéro de série identifie l'appareil chez son constructeur : deux
  -- appareils distincts d'une même entreprise ne peuvent pas le partager.
  serial_number      text,
  category           public.equipment_category not null default 'autre',
  status             public.equipment_status not null default 'available',
  condition          public.equipment_condition not null default 'bon_etat',
  assigned_member_id uuid references public.organization_members (id) on delete set null,
  last_calibration   date,
  next_calibration   date,
  notes              text,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Un appareil ne peut pas être en révision ET affecté à quelqu'un.
  constraint equipment_assignment_coherent check (
    (status = 'assigned' and assigned_member_id is not null)
    or (status <> 'assigned')
  )
);

create unique index if not exists equipment_serial_idx
  on public.equipment (organization_id, serial_number)
  where serial_number is not null and serial_number <> '';

create index if not exists equipment_organization_idx
  on public.equipment (organization_id, status);

-- L'écran met en avant ce qui arrive à échéance : l'index sert ce tri, qui est
-- la première question posée au parc.
create index if not exists equipment_next_calibration_idx
  on public.equipment (organization_id, next_calibration)
  where next_calibration is not null;

drop trigger if exists equipment_set_updated_at on public.equipment;
create trigger equipment_set_updated_at
  before update on public.equipment
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Le membre affecté appartient à la même organisation
-- -----------------------------------------------------------------------------
--
-- Sans ce garde-fou, un identifiant de membre d'une AUTRE entreprise, forgé à la
-- main, passerait : la policy ne contrôle que `organization_id`, pas ce que la
-- ligne référence. C'est la même précaution que `enforce_team_member_same_org`.
create or replace function app.enforce_equipment_assignee_org()
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

drop trigger if exists equipment_assignee_org on public.equipment;
create trigger equipment_assignee_org
  before insert or update on public.equipment
  for each row execute function app.enforce_equipment_assignee_org();

drop trigger if exists equipment_organization_immutable on public.equipment;
create trigger equipment_organization_immutable
  before update on public.equipment
  for each row execute function app.enforce_organization_immutable();

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
--
-- Deux permissions, pas quatre. Consulter le parc et le tenir à jour sont deux
-- gestes distincts ; distinguer en plus création, modification et suppression
-- n'apporterait aucune décision réelle — qui peut ajouter un appareil peut le
-- retirer.
--
-- Le technicien CONSULTE : il doit pouvoir vérifier que le réflectomètre qu'on
-- lui confie est encore étalonné. Il ne modifie pas l'inventaire.
insert into public.role_permissions (role, permission) values
  ('owner',       'equipment.view'),
  ('owner',       'equipment.manage'),
  ('admin',       'equipment.view'),
  ('admin',       'equipment.manage'),
  ('manager',     'equipment.view'),
  ('manager',     'equipment.manage'),
  ('team_leader', 'equipment.view'),
  ('technician',  'equipment.view')
on conflict (role, permission) do nothing;

-- -----------------------------------------------------------------------------
-- Entitlement
-- -----------------------------------------------------------------------------
--
-- `null` = illimité. Ce n'est pas le nombre d'appareils qui distingue les
-- offres, c'est l'accès au module — l'ABSENCE de la clé pour `free` et `pro`
-- suffit à le refuser.
insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('business', 'equipment', null),
  ('ultimate', 'equipment', null)
on conflict (plan_code, feature_key) do update set
  limit_value = excluded.limit_value;

-- -----------------------------------------------------------------------------
-- Privilèges et RLS
-- -----------------------------------------------------------------------------
revoke all on public.equipment from public, anon, authenticated;
grant select, insert, update, delete on public.equipment to authenticated;

alter table public.equipment enable row level security;

-- Une policy par commande : PostgreSQL n'évalue pas le `using` à l'INSERT, et
-- une policy « ALL » laisserait la création sans condition véritable.
drop policy if exists "equipment_select" on public.equipment;
create policy "equipment_select"
  on public.equipment for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'equipment'))
    and (select app.has_org_permission(organization_id, 'equipment.view'))
  );

drop policy if exists "equipment_insert" on public.equipment;
create policy "equipment_insert"
  on public.equipment for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'equipment'))
    and (select app.has_org_permission(organization_id, 'equipment.manage'))
  );

drop policy if exists "equipment_update" on public.equipment;
create policy "equipment_update"
  on public.equipment for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'equipment'))
    and (select app.has_org_permission(organization_id, 'equipment.manage'))
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'equipment'))
    and (select app.has_org_permission(organization_id, 'equipment.manage'))
  );

drop policy if exists "equipment_delete" on public.equipment;
create policy "equipment_delete"
  on public.equipment for delete
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'equipment'))
    and (select app.has_org_permission(organization_id, 'equipment.manage'))
  );

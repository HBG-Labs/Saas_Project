-- =============================================================================
-- Stock : consommables et journal des mouvements
-- =============================================================================
--
-- LE CONSTAT
--
-- Le module Stock a été livré côté code entièrement dans `localStorage`
-- (`src/features/stock/api/stock.storage.ts`), avec sept articles de
-- démonstration écrits en dur et trois mouvements nommant de vrais techniciens.
-- Sur une application multi-tenant, cela signifiait : un stock par navigateur,
-- aucun partage entre le magasinier et le technicien, perte au vidage du cache,
-- et aucune isolation entre organisations puisque rien n'atteignait le serveur.
--
-- `supabase/README.md` annonçait déjà cette table sous le nom `materials`, en
-- « migration volontairement reportée », `intervention_reports.materials_used`
-- tenant lieu de `jsonb` d'attente. C'est cette dette qui est soldée ici.
--
-- Le nom retenu est `stock_consumables` plutôt que `materials` : le code, les
-- routes (`/stock`), les clés de cache (`qk.stock.*`) et l'interface parlent
-- tous de consommables. Aligner la base sur le vocabulaire déjà employé évite
-- une traduction permanente entre les deux.
--
-- DEUX TABLES, PAS UNE
--
-- La quantité en stock est un ÉTAT ; le mouvement est un ÉVÉNEMENT. Les
-- confondre — une seule table de lignes signées — obligerait à recalculer
-- l'état par agrégation à chaque affichage, et interdirait la contrainte
-- « pas de quantité négative ». Les garder séparés impose en revanche qu'ils ne
-- puissent jamais diverger : c'est le rôle de `record_stock_movement()`, plus
-- bas, qui écrit les deux dans la même transaction.
--
-- MONTANTS EN EUROS, ET C'EST UN ÉCART ASSUMÉ
--
-- Le reste du projet stocke les montants en `*_cents integer`
-- (cf. `vehicles.cost_cents`, `quotes`). Ici les colonnes sont des
-- `numeric(12,2)` en euros, sur décision explicite : le module a été écrit avec
-- des `unitPriceEur` flottants dans toute son interface, et convertir aurait
-- demandé de retoucher les huit composants livrés. `numeric` — et non `double
-- precision` — garantit au moins l'exactitude décimale des additions.
--
-- L'ARTICLE SUPPRIMÉ NE DOIT PAS EFFACER SON HISTORIQUE
--
-- `stock_movements.consumable_id` est `on delete set null`, jamais `cascade` :
-- un journal de stock qui se vide en supprimant une référence ne serait plus un
-- journal. Les colonnes `consumable_name` et `consumable_reference` sont des
-- INSTANTANÉS figés, au même titre que `missions.customer_name` : elles
-- décrivent l'article tel qu'il était au moment du mouvement, et survivent donc
-- aussi bien à sa suppression qu'à son renommage.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enum
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'stock_movement_type') then
    create type public.stock_movement_type as enum ('in', 'out', 'transfer', 'adjustment');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Table : consommables
-- -----------------------------------------------------------------------------
create table if not exists public.stock_consumables (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  reference         text not null check (length(trim(reference)) > 0),
  name              text not null check (length(trim(name)) > 0),
  category          text not null default 'Autre',
  unit              text not null default 'pièce',

  -- `numeric` et non `integer` : un câble se stocke au mètre, un fluide au
  -- litre. La contrainte porte sur le signe, pas sur la divisibilité.
  quantity_in_stock numeric(14, 3) not null default 0 check (quantity_in_stock >= 0),
  min_threshold     numeric(14, 3) not null default 0 check (min_threshold >= 0),

  unit_price_eur    numeric(12, 2) check (unit_price_eur >= 0),
  selling_price_eur numeric(12, 2) check (selling_price_eur >= 0),

  location          text not null default '',
  supplier          text,
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Une référence identifie un article DANS une organisation. Deux entreprises
  -- peuvent parfaitement employer le même code fournisseur.
  unique (organization_id, reference)
);

-- Toutes les listes filtrent par organisation, et l'alerte de seuil est la
-- requête la plus fréquente de la page d'accueil du module.
create index if not exists stock_consumables_org_idx
  on public.stock_consumables (organization_id);

create index if not exists stock_consumables_low_stock_idx
  on public.stock_consumables (organization_id)
  where quantity_in_stock <= min_threshold;

drop trigger if exists stock_consumables_set_updated_at on public.stock_consumables;
create trigger stock_consumables_set_updated_at
  before update on public.stock_consumables
  for each row execute function public.set_updated_at();

drop trigger if exists stock_consumables_organization_immutable on public.stock_consumables;
create trigger stock_consumables_organization_immutable
  before update on public.stock_consumables
  for each row execute function app.enforce_organization_immutable();

-- -----------------------------------------------------------------------------
-- Table : mouvements
-- -----------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,

  consumable_id        uuid references public.stock_consumables (id) on delete set null,
  -- Instantanés : voir l'en-tête. `not null` car un mouvement sans article
  -- lisible n'a aucune valeur d'archive.
  consumable_name      text not null,
  consumable_reference text not null,

  type                 public.stock_movement_type not null,
  -- Toujours positive : c'est `type` qui porte le sens. Une quantité signée
  -- ferait exister deux représentations de la même sortie.
  quantity             numeric(14, 3) not null check (quantity > 0),
  reason               text not null default '',

  technician_id        uuid references public.organization_members (id) on delete set null,
  technician_name      text,
  intervention_ref     text,
  location_from        text,
  location_to          text,

  occurred_at          timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

-- Requête dominante : « le journal de l'organisation X, du plus récent au plus
-- ancien ».
create index if not exists stock_movements_org_occurred_idx
  on public.stock_movements (organization_id, occurred_at desc);

-- Index sur la clé étrangère : Postgres n'en crée pas automatiquement, et la
-- fiche d'un article liste ses mouvements.
create index if not exists stock_movements_consumable_idx
  on public.stock_movements (consumable_id);

drop trigger if exists stock_movements_organization_immutable on public.stock_movements;
create trigger stock_movements_organization_immutable
  before update on public.stock_movements
  for each row execute function app.enforce_organization_immutable();

-- -----------------------------------------------------------------------------
-- Cohérence : l'article mouvementé appartient à la même organisation
-- -----------------------------------------------------------------------------
--
-- Sans ce contrôle, une organisation pourrait enregistrer un mouvement sur
-- l'article d'une autre : les policies vérifient `organization_id` de la LIGNE
-- écrite, pas celui de la ligne pointée par la clé étrangère.
create or replace function app.enforce_stock_movement_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if new.consumable_id is null then
    return new;
  end if;

  select organization_id into v_org
  from public.stock_consumables
  where id = new.consumable_id;

  if v_org is distinct from new.organization_id then
    raise exception
      'Le consommable % n''appartient pas à l''organisation %.',
      new.consumable_id, new.organization_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists stock_movements_same_org on public.stock_movements;
create trigger stock_movements_same_org
  before insert or update on public.stock_movements
  for each row execute function app.enforce_stock_movement_org();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
--
-- Une policy par verbe, jamais `for all` : le `using` d'une policy `all` n'est
-- pas évalué à l'insertion. `with check` est systématiquement aussi fort que
-- `using`, sans quoi une ligne pourrait être déplacée hors de portée par un
-- update.
alter table public.stock_consumables enable row level security;
alter table public.stock_movements   enable row level security;

drop policy if exists "stock_consumables_select" on public.stock_consumables;
create policy "stock_consumables_select"
  on public.stock_consumables for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'stock'))
    and (select app.has_org_permission(organization_id, 'stock.view'))
  );

drop policy if exists "stock_consumables_insert" on public.stock_consumables;
create policy "stock_consumables_insert"
  on public.stock_consumables for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'stock'))
    and (select app.has_org_permission(organization_id, 'stock.manage'))
  );

drop policy if exists "stock_consumables_update" on public.stock_consumables;
create policy "stock_consumables_update"
  on public.stock_consumables for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'stock'))
    and (select app.has_org_permission(organization_id, 'stock.manage'))
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'stock'))
    and (select app.has_org_permission(organization_id, 'stock.manage'))
  );

drop policy if exists "stock_consumables_delete" on public.stock_consumables;
create policy "stock_consumables_delete"
  on public.stock_consumables for delete
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'stock'))
    and (select app.has_org_permission(organization_id, 'stock.manage'))
  );

drop policy if exists "stock_movements_select" on public.stock_movements;
create policy "stock_movements_select"
  on public.stock_movements for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'stock'))
    and (select app.has_org_permission(organization_id, 'stock.view'))
  );

drop policy if exists "stock_movements_insert" on public.stock_movements;
create policy "stock_movements_insert"
  on public.stock_movements for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'stock'))
    and (select app.has_org_permission(organization_id, 'stock.manage'))
  );

-- Pas de policy UPDATE ni DELETE sur les mouvements : un journal se corrige par
-- une écriture inverse (`adjustment`), pas par réécriture du passé. C'est le
-- même parti pris que `vehicle_maintenance_records`, qui n'a pas d'UPDATE.

-- -----------------------------------------------------------------------------
-- Écriture atomique d'un mouvement
-- -----------------------------------------------------------------------------
--
-- Insérer le mouvement puis mettre à jour la quantité en deux appels laisserait
-- une fenêtre où le journal et l'état divergent — et deux techniciens servant
-- le même article au même instant perdraient une décrémentation.
--
-- `security invoker` (le défaut) est ESSENTIEL : la fonction doit s'exécuter
-- avec les droits de l'appelant pour que les policies ci-dessus s'appliquent.
-- En `security definer`, elle contournerait le cloisonnement multi-tenant.
--
-- `for update` verrouille la ligne d'article le temps de la transaction, ce qui
-- sérialise les mouvements concurrents sur un même article.
create or replace function public.record_stock_movement(
  p_consumable_id    uuid,
  p_type             public.stock_movement_type,
  p_quantity         numeric,
  p_reason           text default '',
  p_technician_id    uuid default null,
  p_technician_name  text default null,
  p_intervention_ref text default null,
  p_location_from    text default null,
  p_location_to      text default null
)
returns public.stock_movements
language plpgsql
set search_path = ''
as $$
declare
  v_item     public.stock_consumables;
  v_new_qty  numeric(14, 3);
  v_movement public.stock_movements;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La quantité d''un mouvement doit être strictement positive.'
      using errcode = 'check_violation';
  end if;

  select * into v_item
  from public.stock_consumables
  where id = p_consumable_id
  for update;

  -- Introuvable OU masqué par la policy de lecture : dans les deux cas
  -- l'appelant n'a rien à en savoir de plus.
  if v_item.id is null then
    raise exception 'Consommable introuvable.' using errcode = 'no_data_found';
  end if;

  v_new_qty := case p_type
    when 'in'         then v_item.quantity_in_stock + p_quantity
    when 'out'        then v_item.quantity_in_stock - p_quantity
    -- Une régularisation d'inventaire POSE le stock compté, elle ne l'ajuste
    -- pas d'un delta : c'est le sens de « inventaire » sur le terrain.
    when 'adjustment' then p_quantity
    -- Un transfert déplace sans créer ni consommer : la quantité globale ne
    -- bouge pas, seuls `location_from` / `location_to` portent l'information.
    when 'transfer'   then v_item.quantity_in_stock
  end;

  if v_new_qty < 0 then
    raise exception
      'Stock insuffisant pour % : % en stock, % demandés.',
      v_item.reference, v_item.quantity_in_stock, p_quantity
      using errcode = 'check_violation';
  end if;

  update public.stock_consumables
  set quantity_in_stock = v_new_qty
  where id = p_consumable_id;

  insert into public.stock_movements (
    organization_id, consumable_id, consumable_name, consumable_reference,
    type, quantity, reason,
    technician_id, technician_name, intervention_ref,
    location_from, location_to
  )
  values (
    v_item.organization_id, v_item.id, v_item.name, v_item.reference,
    p_type, p_quantity, coalesce(p_reason, ''),
    p_technician_id, p_technician_name, p_intervention_ref,
    p_location_from, p_location_to
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
--
-- Des permissions DÉDIÉES, et non un rattachement à `equipment.*` comme l'ont
-- fait les véhicules : le parc matériel et le stock de consommables ne sont pas
-- confiés aux mêmes personnes. Un magasinier gère les références sans avoir à
-- disposer des soudeuses optiques.
--
-- Le technicien LIT le stock et enregistre ses sorties : `stock.manage` lui est
-- accordé, sans quoi il ne pourrait pas déclarer ce qu'il consomme sur
-- chantier, ce qui est l'usage principal du module sur le terrain.
insert into public.role_permissions (role, permission) values
  ('owner',       'stock.view'),
  ('owner',       'stock.manage'),
  ('admin',       'stock.view'),
  ('admin',       'stock.manage'),
  ('manager',     'stock.view'),
  ('manager',     'stock.manage'),
  ('team_leader', 'stock.view'),
  ('team_leader', 'stock.manage'),
  ('technician',  'stock.view'),
  ('technician',  'stock.manage')
-- `employee` reste volontairement à l'écart : son rôle est défini comme une
-- « consultation restreinte de l'organisation », et `rbac.test.ts` fige cette
-- liste à trois permissions. Le stock est un module de terrain.
on conflict (role, permission) do nothing;

-- -----------------------------------------------------------------------------
-- Entitlement
-- -----------------------------------------------------------------------------
--
-- Même palier que `equipment` : le stock accompagne la gestion de parc, et
-- l'absence de la clé pour `free` et `starter` suffit à refuser le module.
insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('pro',        'stock', null),
  ('business',   'stock', null),
  ('enterprise', 'stock', null)
on conflict (plan_code, feature_key) do update set
  limit_value = excluded.limit_value;

-- -----------------------------------------------------------------------------
-- Privilèges
-- -----------------------------------------------------------------------------
--
-- Défense en profondeur : les policies décident QUELLES lignes, les privilèges
-- décident QUELS verbes. Il faut désormais se tromper deux fois pour ouvrir une
-- table. Les mouvements ne reçoivent ni `update` ni `delete`, en accord avec
-- l'absence de policy correspondante.
revoke all on public.stock_consumables from public, anon, authenticated;
grant select, insert, update, delete on public.stock_consumables to authenticated;

revoke all on public.stock_movements from public, anon, authenticated;
grant select, insert on public.stock_movements to authenticated;

revoke all on function public.record_stock_movement from public, anon;
grant execute on function public.record_stock_movement to authenticated;

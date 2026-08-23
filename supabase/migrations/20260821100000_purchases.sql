-- =============================================================================
-- Achats : fournisseurs, bons de commande et réception
-- =============================================================================
--
-- LE CONSTAT
--
-- Le module Achats a été livré entièrement dans `localStorage`
-- (`purchases.storage.ts`, 848 lignes), avec cinq fournisseurs RÉELS codés en dur
-- — Rexel, Sonepar, Würth, CEDEO, Foliatec, SIRET et numéros de TVA compris — et
-- deux bons de commande de démonstration semés dans chaque organisation.
--
-- Plus grave : il importait quatre fonctions de `stock.storage.ts` pour
-- alimenter le stock à la réception. Depuis que le Stock lit PostgreSQL
-- (`20260820110000_stock.sql`), plus aucun écran ne lit ce stock local. Pointer
-- une livraison écrivait donc dans le vide : **la marchandise n'arrivait jamais
-- en stock**. C'est ce trou que cette migration referme.
--
-- TROIS TABLES
--
-- Le fournisseur est un TIERS, la commande un ENGAGEMENT, la ligne un DÉTAIL de
-- cet engagement. Les fondre ferait perdre l'historique : une commande doit
-- rester lisible telle qu'elle a été passée, même si la fiche fournisseur change
-- ou disparaît ensuite.
--
-- LES TOTAUX NE SONT PAS STOCKÉS
--
-- `subtotal_eur`, `tax_eur`, `total_eur` n'existent pas ici. Ils découlent
-- entièrement des lignes, et `purchases.api.ts` les dérive au mapping — même
-- parti pris que la vue `quote_totals` pour les devis (« LE TOTAL N'EST PAS
-- STOCKÉ », `20260812100400_quotes.sql`). Un total stocké finit toujours par
-- diverger de ses lignes.
--
-- MONTANTS EN EUROS, ET C'EST UN ÉCART ASSUMÉ
--
-- `numeric(12,2)` en euros plutôt que `*_cents integer`, par cohérence avec
-- `stock_consumables` et sur décision explicite : l'interface a été écrite avec
-- des `unitPriceEur` partout. `numeric` — et non `double precision` — garantit
-- au moins l'exactitude décimale des additions.
--
-- LA COMMANDE SURVIT À SON FOURNISSEUR
--
-- `supplier_id` est `on delete set null`, jamais `cascade`. Les colonnes
-- `supplier_name` / `_email` / `_phone` / `_address` sont des INSTANTANÉS figés à
-- la création, au même titre que `missions.customer_name` : elles décrivent le
-- fournisseur tel qu'il était au moment de l'engagement. Renommer une société en
-- 2026 ne doit pas réécrire un bon de commande de 2024.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enum
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'purchase_order_status') then
    create type public.purchase_order_status as enum (
      'draft', 'sent', 'partially_received', 'received', 'cancelled'
    );
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Table : fournisseurs
-- -----------------------------------------------------------------------------
create table if not exists public.suppliers (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,

  name                  text not null check (length(trim(name)) > 0),
  code                  text,
  contact_name          text,
  email                 text,
  phone                 text,
  address               text,
  city                  text,
  postal_code           text,
  siret                 text,
  vat_number            text,
  website               text,
  default_payment_terms text,
  notes                 text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Un code fournisseur identifie un tiers DANS une organisation. Deux entreprises
-- peuvent employer le même code interne. L'index partiel laisse `code` libre
-- quand il n'est pas renseigné — l'interface ne l'impose pas.
create unique index if not exists suppliers_org_code_key
  on public.suppliers (organization_id, upper(code))
  where code is not null and code <> '';

create index if not exists suppliers_org_idx
  on public.suppliers (organization_id);

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

drop trigger if exists suppliers_organization_immutable on public.suppliers;
create trigger suppliers_organization_immutable
  before update on public.suppliers
  for each row execute function app.enforce_organization_immutable();

-- -----------------------------------------------------------------------------
-- Table : bons de commande
-- -----------------------------------------------------------------------------
create table if not exists public.purchase_orders (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  reference               text not null,

  supplier_id             uuid references public.suppliers (id) on delete set null,
  -- Instantanés : voir l'en-tête.
  supplier_name           text not null,
  supplier_email          text,
  supplier_phone          text,
  supplier_address        text,

  status                  public.purchase_order_status not null default 'draft',
  order_date              date not null default current_date,
  expected_delivery_date  date,
  received_date           date,

  mission_id              uuid references public.missions (id) on delete set null,
  mission_ref             text,

  -- Taux, pas pourcentage : 0.20 pour 20 %. C'est la forme déjà employée par
  -- l'interface, et elle évite une division à chaque calcul.
  tax_rate                numeric(6, 4) not null default 0.20 check (tax_rate >= 0 and tax_rate <= 1),

  notes                   text,
  delivery_notes          text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  unique (organization_id, reference)
);

create index if not exists purchase_orders_org_date_idx
  on public.purchase_orders (organization_id, order_date desc);

create index if not exists purchase_orders_supplier_idx
  on public.purchase_orders (supplier_id);

drop trigger if exists purchase_orders_set_updated_at on public.purchase_orders;
create trigger purchase_orders_set_updated_at
  before update on public.purchase_orders
  for each row execute function public.set_updated_at();

drop trigger if exists purchase_orders_organization_immutable on public.purchase_orders;
create trigger purchase_orders_organization_immutable
  before update on public.purchase_orders
  for each row execute function app.enforce_organization_immutable();

-- -----------------------------------------------------------------------------
-- Référence de commande, générée par le serveur
-- -----------------------------------------------------------------------------
--
-- Le format `CMD-AAAA-NNN` est celui que produisait déjà le code — et non le
-- `PO-2026-001` qu'annonçait, à tort, le commentaire du type TypeScript.
--
-- Deux défauts sont corrigés au passage :
--   • le compteur partait de `nombre total de commandes + 1`, toutes années
--     confondues, et REGRESSAIT après une suppression — deux commandes
--     pouvaient donc porter le même numéro ;
--   • le formulaire préremplissait une référence ALÉATOIRE
--     (`CMD-2026-<100..999>`), ce qui collisionne par construction.
--
-- Ici le compteur est cadré par organisation ET par année, et la contrainte
-- d'unicité fait foi : en cas de course, l'insertion échoue franchement au lieu
-- de produire un doublon silencieux.
create or replace function app.generate_purchase_order_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year text;
  v_next integer;
begin
  if new.reference is not null and new.reference <> '' then
    return new;
  end if;

  v_year := to_char(coalesce(new.order_date, current_date), 'YYYY');

  select coalesce(max(split_part(reference, '-', 3)::integer), 0) + 1
  into v_next
  from public.purchase_orders
  where organization_id = new.organization_id
    -- `[0-9]` plutôt qu'une classe abrégée : le filtre écarte toute référence
    -- saisie à la main qui ferait échouer le `::integer`.
    and reference ~ ('^CMD-' || v_year || '-[0-9]+$');

  new.reference := 'CMD-' || v_year || '-' || lpad(v_next::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists purchase_orders_generate_reference on public.purchase_orders;
create trigger purchase_orders_generate_reference
  before insert on public.purchase_orders
  for each row execute function app.generate_purchase_order_reference();

-- -----------------------------------------------------------------------------
-- Table : lignes de commande
-- -----------------------------------------------------------------------------
--
-- `id` est structurellement critique : c'est la clé du dictionnaire
-- `{ id_de_ligne: quantité reçue }` que l'écran de réception envoie au serveur.
-- Un identifiant fabriqué côté navigateur ne survivait pas à un rechargement.
create table if not exists public.purchase_order_items (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,

  -- L'article de stock visé, quand il est connu. `set null` : supprimer une
  -- référence du stock ne doit pas amputer une commande passée.
  consumable_id     uuid references public.stock_consumables (id) on delete set null,

  reference         text not null default '',
  description       text not null default '',
  unit              text not null default 'pièce',

  quantity_ordered  numeric(14, 3) not null default 1 check (quantity_ordered > 0),
  quantity_received numeric(14, 3) not null default 0 check (quantity_received >= 0),
  unit_price_eur    numeric(12, 2) not null default 0 check (unit_price_eur >= 0),

  position          integer not null default 0,
  created_at        timestamptz not null default now(),

  -- On ne reçoit jamais plus que ce qui a été commandé.
  check (quantity_received <= quantity_ordered)
);

create index if not exists purchase_order_items_order_idx
  on public.purchase_order_items (purchase_order_id, position);

create index if not exists purchase_order_items_consumable_idx
  on public.purchase_order_items (consumable_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
--
-- Une policy par verbe, jamais `for all` : le `using` d'une policy `all` n'est
-- pas évalué à l'insertion. `with check` est systématiquement aussi fort que
-- `using`, sans quoi une ligne pourrait être déplacée hors de portée.
alter table public.suppliers            enable row level security;
alter table public.purchase_orders      enable row level security;
alter table public.purchase_order_items enable row level security;

drop policy if exists "suppliers_select" on public.suppliers;
create policy "suppliers_select"
  on public.suppliers for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'purchases'))
    and (select app.has_org_permission(organization_id, 'purchase.view'))
  );

drop policy if exists "suppliers_insert" on public.suppliers;
create policy "suppliers_insert"
  on public.suppliers for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'purchases'))
    and (select app.has_org_permission(organization_id, 'purchase.manage'))
  );

drop policy if exists "suppliers_update" on public.suppliers;
create policy "suppliers_update"
  on public.suppliers for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'purchases'))
    and (select app.has_org_permission(organization_id, 'purchase.manage'))
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'purchases'))
    and (select app.has_org_permission(organization_id, 'purchase.manage'))
  );

drop policy if exists "suppliers_delete" on public.suppliers;
create policy "suppliers_delete"
  on public.suppliers for delete
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'purchases'))
    and (select app.has_org_permission(organization_id, 'purchase.manage'))
  );

drop policy if exists "purchase_orders_select" on public.purchase_orders;
create policy "purchase_orders_select"
  on public.purchase_orders for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'purchases'))
    and (select app.has_org_permission(organization_id, 'purchase.view'))
  );

drop policy if exists "purchase_orders_insert" on public.purchase_orders;
create policy "purchase_orders_insert"
  on public.purchase_orders for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'purchases'))
    and (select app.has_org_permission(organization_id, 'purchase.manage'))
  );

drop policy if exists "purchase_orders_update" on public.purchase_orders;
create policy "purchase_orders_update"
  on public.purchase_orders for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'purchases'))
    and (select app.has_org_permission(organization_id, 'purchase.manage'))
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'purchases'))
    and (select app.has_org_permission(organization_id, 'purchase.manage'))
  );

drop policy if exists "purchase_orders_delete" on public.purchase_orders;
create policy "purchase_orders_delete"
  on public.purchase_orders for delete
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'purchases'))
    and (select app.has_org_permission(organization_id, 'purchase.manage'))
  );

-- Les lignes n'ont pas d'`organization_id` : elles lisent leur portée À TRAVERS
-- la commande, comme `vehicle_maintenance_records` le fait à travers le
-- véhicule. Dupliquer la colonne créerait deux vérités à tenir d'accord.
drop policy if exists "purchase_order_items_select" on public.purchase_order_items;
create policy "purchase_order_items_select"
  on public.purchase_order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.purchase_orders o
      where o.id = purchase_order_id
        and (select app.can_use_pro_module(o.organization_id, 'purchases'))
        and (select app.has_org_permission(o.organization_id, 'purchase.view'))
    )
  );

drop policy if exists "purchase_order_items_insert" on public.purchase_order_items;
create policy "purchase_order_items_insert"
  on public.purchase_order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.purchase_orders o
      where o.id = purchase_order_id
        and (select app.can_use_pro_module(o.organization_id, 'purchases'))
        and (select app.has_org_permission(o.organization_id, 'purchase.manage'))
    )
  );

drop policy if exists "purchase_order_items_update" on public.purchase_order_items;
create policy "purchase_order_items_update"
  on public.purchase_order_items for update
  to authenticated
  using (
    exists (
      select 1 from public.purchase_orders o
      where o.id = purchase_order_id
        and (select app.can_use_pro_module(o.organization_id, 'purchases'))
        and (select app.has_org_permission(o.organization_id, 'purchase.manage'))
    )
  )
  with check (
    exists (
      select 1 from public.purchase_orders o
      where o.id = purchase_order_id
        and (select app.can_use_pro_module(o.organization_id, 'purchases'))
        and (select app.has_org_permission(o.organization_id, 'purchase.manage'))
    )
  );

drop policy if exists "purchase_order_items_delete" on public.purchase_order_items;
create policy "purchase_order_items_delete"
  on public.purchase_order_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.purchase_orders o
      where o.id = purchase_order_id
        and (select app.can_use_pro_module(o.organization_id, 'purchases'))
        and (select app.has_org_permission(o.organization_id, 'purchase.manage'))
    )
  );

-- -----------------------------------------------------------------------------
-- Cohérence : le fournisseur et la mission appartiennent à la même organisation
-- -----------------------------------------------------------------------------
create or replace function app.enforce_purchase_order_refs_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if new.supplier_id is not null then
    select organization_id into v_org from public.suppliers where id = new.supplier_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Le fournisseur % n''appartient pas à l''organisation %.',
        new.supplier_id, new.organization_id using errcode = 'check_violation';
    end if;
  end if;

  if new.mission_id is not null then
    select organization_id into v_org from public.missions where id = new.mission_id;
    if v_org is distinct from new.organization_id then
      raise exception 'La mission % n''appartient pas à l''organisation %.',
        new.mission_id, new.organization_id using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_orders_refs_org on public.purchase_orders;
create trigger purchase_orders_refs_org
  before insert or update on public.purchase_orders
  for each row execute function app.enforce_purchase_order_refs_org();

-- -----------------------------------------------------------------------------
-- Entrée en stock d'une ligne reçue
-- -----------------------------------------------------------------------------
--
-- Helper PARTAGÉ : trois chemins amènent de la marchandise en stock — la
-- réception proprement dite, la création d'une commande déjà au statut
-- `received`, et le passage d'une commande existante à ce statut. Les écrire
-- trois fois, c'était garantir qu'ils divergent.
--
-- L'appariement de l'article reprend les trois passes du code d'origine, dans
-- le même ordre : identifiant explicite, puis référence (insensible à la casse),
-- puis désignation comparée au nom OU à la référence. Sans quoi une même
-- fourniture entrerait deux fois au catalogue sous deux orthographes.
create or replace function app.receive_purchase_line(
  p_organization_id uuid,
  p_item_id         uuid,
  p_quantity        numeric,
  p_order_reference text,
  p_supplier_name   text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_item      public.purchase_order_items;
  v_target    uuid;
  v_reference text;
  v_nom       text;
begin
  if p_quantity is null or p_quantity <= 0 then
    return null;
  end if;

  select * into v_item from public.purchase_order_items where id = p_item_id;
  if v_item.id is null then
    return null;
  end if;

  v_reference := upper(trim(v_item.reference));
  v_nom       := lower(trim(v_item.description));

  -- Passe 1 : l'article explicitement lié à la ligne.
  if v_item.consumable_id is not null then
    select id into v_target
    from public.stock_consumables
    where id = v_item.consumable_id and organization_id = p_organization_id;
  end if;

  -- Passe 2 : même référence.
  if v_target is null and v_reference <> '' then
    select id into v_target
    from public.stock_consumables
    where organization_id = p_organization_id
      and upper(trim(reference)) = v_reference
    limit 1;
  end if;

  -- Passe 3 : la désignation retrouve un nom ou une référence.
  if v_target is null and v_nom <> '' then
    select id into v_target
    from public.stock_consumables
    where organization_id = p_organization_id
      and (lower(trim(name)) = v_nom or lower(trim(reference)) = v_nom)
    limit 1;
  end if;

  -- Rien ne correspond : la livraison fait entrer une nouvelle référence au
  -- catalogue. C'est le comportement attendu d'un magasinier qui réceptionne
  -- une fourniture qu'il ne stockait pas encore.
  if v_target is null then
    insert into public.stock_consumables (
      organization_id, reference, name, category, unit,
      quantity_in_stock, min_threshold, unit_price_eur, location, supplier, notes
    )
    values (
      p_organization_id,
      coalesce(nullif(v_reference, ''), 'ART-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
      coalesce(nullif(trim(v_item.description), ''), nullif(v_item.reference, ''), 'Article reçu'),
      'Général & Divers',
      coalesce(nullif(v_item.unit, ''), 'pièce'),
      0,
      5,
      nullif(v_item.unit_price_eur, 0),
      'Dépôt Central',
      p_supplier_name,
      'Créé automatiquement depuis la commande fournisseur ' || coalesce(p_order_reference, '')
    )
    returning id into v_target;

    -- La ligne retient l'article qu'elle a fait naître : la prochaine réception
    -- passera par la passe 1, sans réappariement approximatif.
    update public.purchase_order_items set consumable_id = v_target where id = p_item_id;
  end if;

  -- Entrée en stock. Le mouvement porte le même libellé qu'auparavant pour que
  -- les journaux déjà lus par les équipes restent reconnaissables.
  update public.stock_consumables
  set quantity_in_stock = quantity_in_stock + p_quantity
  where id = v_target;

  insert into public.stock_movements (
    organization_id, consumable_id, consumable_name, consumable_reference,
    type, quantity, reason, location_to
  )
  select
    p_organization_id, c.id, c.name, c.reference,
    'in', p_quantity,
    'Réception Commande Fournisseur ' || coalesce(p_order_reference, '')
      || ' (' || coalesce(p_supplier_name, '') || ')',
    c.location
  from public.stock_consumables c
  where c.id = v_target;

  return v_target;
end;
$$;

-- -----------------------------------------------------------------------------
-- Réception d'une commande, en une transaction
-- -----------------------------------------------------------------------------
--
-- `p_lines` est un objet `{ "<id de ligne>": <quantité reçue MAINTENANT> }`.
-- C'est un INCRÉMENT, pas un cumul : l'écran de réception envoie ce qui figure
-- sur le bon de livraison du jour.
--
-- `security invoker` (le défaut) est ESSENTIEL : la fonction doit s'exécuter
-- avec les droits de l'appelant pour que les policies s'appliquent. En
-- `security definer`, elle contournerait le cloisonnement multi-tenant.
--
-- Tout se joue dans une seule transaction. L'ancienne version écrivait le
-- pointage puis, séparément, le stock — et rattrapait les écarts par une
-- « réconciliation » dont l'idempotence reposait sur la présence de la référence
-- de commande DANS LE TEXTE du motif de mouvement. Renommer une commande
-- suffisait à recompter tout son stock.
create or replace function public.receive_purchase_order(
  p_order_id        uuid,
  p_lines           jsonb default '{}'::jsonb,
  p_delivery_notes  text default null
)
returns public.purchase_orders
language plpgsql
set search_path = ''
as $$
declare
  v_order    public.purchase_orders;
  v_item     public.purchase_order_items;
  v_recu     numeric;
  v_nouvelle numeric;
  v_solde    boolean := true;
  v_touche   boolean := false;
begin
  select * into v_order from public.purchase_orders where id = p_order_id for update;

  if v_order.id is null then
    raise exception 'Commande introuvable.' using errcode = 'no_data_found';
  end if;

  for v_item in
    select * from public.purchase_order_items
    where purchase_order_id = p_order_id
    order by position
  loop
    v_recu := coalesce((p_lines ->> v_item.id::text)::numeric, 0);

    if v_recu > 0 then
      -- Plafonné à ce qui reste dû : un bon de livraison excédentaire ne crée
      -- pas de stock fantôme.
      v_nouvelle := least(v_item.quantity_ordered, v_item.quantity_received + v_recu);
      v_recu := v_nouvelle - v_item.quantity_received;

      if v_recu > 0 then
        v_touche := true;

        update public.purchase_order_items
        set quantity_received = v_nouvelle
        where id = v_item.id;

        perform app.receive_purchase_line(
          v_order.organization_id, v_item.id, v_recu,
          v_order.reference, v_order.supplier_name
        );
      end if;
    else
      v_nouvelle := v_item.quantity_received;
    end if;

    if v_nouvelle < v_item.quantity_ordered then
      v_solde := false;
    end if;
  end loop;

  update public.purchase_orders
  set
    status = case
      when v_solde then 'received'::public.purchase_order_status
      when v_touche or status = 'partially_received'
        then 'partially_received'::public.purchase_order_status
      else status
    end,
    received_date  = case when v_solde then current_date else received_date end,
    delivery_notes = coalesce(nullif(trim(coalesce(p_delivery_notes, '')), ''), delivery_notes)
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- Solder une commande d'un coup
-- -----------------------------------------------------------------------------
--
-- Sert les deux chemins « la commande passe à `received` » : à la création
-- (marchandise déjà là) et à la mise à jour. Elle délègue à
-- `receive_purchase_order` en réclamant, pour chaque ligne, exactement ce qui
-- reste dû — donc sans jamais recompter ce qui a déjà été reçu.
create or replace function public.receive_purchase_order_fully(p_order_id uuid)
returns public.purchase_orders
language plpgsql
set search_path = ''
as $$
declare
  v_lines jsonb;
begin
  select coalesce(jsonb_object_agg(id::text, quantity_ordered - quantity_received), '{}'::jsonb)
  into v_lines
  from public.purchase_order_items
  where purchase_order_id = p_order_id
    and quantity_ordered > quantity_received;

  return public.receive_purchase_order(p_order_id, v_lines, null);
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
--
-- Des permissions DÉDIÉES plutôt qu'un rattachement à `quote.*`, sur lequel le
-- routeur s'appuyait faute de mieux : engager une dépense chez un fournisseur et
-- établir un devis client sont deux responsabilités distinctes.
--
-- Le technicien LIT les commandes — savoir ce qui a été commandé et quand cela
-- arrive conditionne son chantier — mais n'engage pas l'entreprise.
insert into public.role_permissions (role, permission) values
  ('owner',       'purchase.view'),
  ('owner',       'purchase.manage'),
  ('admin',       'purchase.view'),
  ('admin',       'purchase.manage'),
  ('manager',     'purchase.view'),
  ('manager',     'purchase.manage'),
  ('team_leader', 'purchase.view'),
  ('technician',  'purchase.view')
-- `employee` reste à l'écart : son rôle est une « consultation restreinte de
-- l'organisation », et `rbac.test.ts` fige sa liste à trois permissions.
on conflict (role, permission) do nothing;

-- -----------------------------------------------------------------------------
-- Entitlement
-- -----------------------------------------------------------------------------
--
-- Même palier que `stock` et `equipment` : les achats accompagnent la gestion de
-- parc. L'ABSENCE de la clé pour `free` et `starter` suffit à refuser le module.
insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('pro',        'purchases', null),
  ('business',   'purchases', null),
  ('enterprise', 'purchases', null)
on conflict (plan_code, feature_key) do update set
  limit_value = excluded.limit_value;

-- -----------------------------------------------------------------------------
-- Privilèges
-- -----------------------------------------------------------------------------
--
-- Défense en profondeur : les policies décident QUELLES lignes, les privilèges
-- décident QUELS verbes. Il faut se tromper deux fois pour ouvrir une table.
revoke all on public.suppliers from public, anon, authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;

revoke all on public.purchase_orders from public, anon, authenticated;
grant select, insert, update, delete on public.purchase_orders to authenticated;

revoke all on public.purchase_order_items from public, anon, authenticated;
grant select, insert, update, delete on public.purchase_order_items to authenticated;

revoke all on function public.receive_purchase_order from public, anon;
grant execute on function public.receive_purchase_order to authenticated;

revoke all on function public.receive_purchase_order_fully from public, anon;
grant execute on function public.receive_purchase_order_fully to authenticated;

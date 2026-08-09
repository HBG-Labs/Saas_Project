-- =============================================================================
-- Clients, contacts et sites d'intervention
-- =============================================================================
--
-- Jusqu'ici, une mission portait le client sous forme de texte libre
-- (`customer_name`, `customer_phone`, adresse). Cela suffit pour un dépannage
-- ponctuel, mais interdit tout ce qui fait la valeur d'un suivi client :
-- retrouver l'historique d'un site, réutiliser une adresse et ses consignes
-- d'accès, ou joindre le bon interlocuteur.
--
-- Le rattachement est OPTIONNEL et les champs texte des missions sont CONSERVÉS.
-- Ce n'est pas une hésitation : ce sont deux informations de nature différente.
-- La fiche client est vivante et se corrige ; le compte rendu d'une intervention
-- de 2024 est une pièce probante, et le nom qui y figure ne doit pas changer
-- parce que le client a été renommé en 2026. Les colonnes texte deviennent donc
-- un instantané figé à la création, alimenté depuis le site quand il existe.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- customers
-- -----------------------------------------------------------------------------
create table if not exists public.customers (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  reference           text not null,
  name                text not null check (char_length(name) between 2 and 150),
  legal_name          text,
  registration_number text,
  vat_number          text,
  email               text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone               text,
  address_line1       text,
  address_line2       text,
  postal_code         text,
  city                text,
  country             text default 'FR' check (country is null or char_length(country) = 2),
  notes               text,
  status              public.content_status not null default 'active',
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (organization_id, reference)
);

create index if not exists customers_organization_idx
  on public.customers (organization_id, status);

-- Recherche par nom insensible à la casse : c'est ainsi qu'on cherche un client
-- sur le terrain, pas par référence.
create index if not exists customers_name_idx
  on public.customers (organization_id, lower(name));

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Référence lisible, par organisation
-- -----------------------------------------------------------------------------
--
-- Même raisonnement que pour les missions : au téléphone on annonce
-- « le client CLI-0042 ». La numérotation repart de 1 dans chaque organisation,
-- ce qui évite en prime de laisser deviner le portefeuille d'un concurrent.
create or replace function app.generate_customer_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
begin
  if new.reference is not null and new.reference <> '' then
    return new;
  end if;

  select coalesce(max(substring(reference from '\d+$')::integer), 0) + 1
  into v_next
  from public.customers
  where organization_id = new.organization_id
    and reference like 'CLI-%';

  new.reference := 'CLI-' || lpad(v_next::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists customers_generate_reference on public.customers;
create trigger customers_generate_reference
  before insert on public.customers
  for each row execute function app.generate_customer_reference();

-- -----------------------------------------------------------------------------
-- customer_contacts
-- -----------------------------------------------------------------------------
create table if not exists public.customer_contacts (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers (id) on delete cascade,
  -- Dénormalisé pour que les policies filtrent sans jointure. ÉCRASÉ PAR TRIGGER :
  -- la valeur envoyée par le client n'est jamais retenue.
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_name      text,
  last_name       text not null check (char_length(last_name) between 1 and 100),
  role_label      text,
  email           text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone           text,
  is_primary      boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists customer_contacts_customer_idx
  on public.customer_contacts (customer_id);

-- Un seul interlocuteur principal par client.
create unique index if not exists customer_contacts_primary_idx
  on public.customer_contacts (customer_id)
  where is_primary;

drop trigger if exists customer_contacts_set_updated_at on public.customer_contacts;
create trigger customer_contacts_set_updated_at
  before update on public.customer_contacts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- sites
-- -----------------------------------------------------------------------------
create table if not exists public.sites (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(name) between 2 and 150),
  -- Référence interne du client (« PBO-1245 », « Agence Nord »), pas la nôtre.
  code            text,
  address_line1   text,
  address_line2   text,
  postal_code     text,
  city            text,
  country         text default 'FR' check (country is null or char_length(country) = 2),
  latitude        numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude       numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  -- Codes de portail, consignes de sécurité, horaires d'accès. C'est
  -- l'information qui fait gagner une heure au technicien sur place.
  access_notes    text,
  contact_id      uuid references public.customer_contacts (id) on delete set null,
  status          public.content_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists sites_customer_idx on public.sites (customer_id, status);
create index if not exists sites_organization_idx on public.sites (organization_id, status);

create unique index if not exists sites_customer_code_idx
  on public.sites (customer_id, code)
  where code is not null;

drop trigger if exists sites_set_updated_at on public.sites;
create trigger sites_set_updated_at
  before update on public.sites
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Intégrité inter-tenant
-- -----------------------------------------------------------------------------
--
-- `organization_id` est recalculé depuis le parent plutôt que vérifié : un
-- contrôle laisse au client le soin de fournir une valeur juste, un écrasement
-- lui retire la question. C'est le même parti pris que pour les interventions et
-- les pièces jointes.
create or replace function app.enforce_customer_child_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.customers where id = new.customer_id;

  if v_org is null then
    raise exception 'Le client référencé est introuvable.'
      using errcode = 'foreign_key_violation';
  end if;

  new.organization_id := v_org;
  return new;
end;
$$;

drop trigger if exists customer_contacts_enforce_org on public.customer_contacts;
create trigger customer_contacts_enforce_org
  before insert or update on public.customer_contacts
  for each row execute function app.enforce_customer_child_org();

drop trigger if exists sites_enforce_org on public.sites;
create trigger sites_enforce_org
  before insert or update on public.sites
  for each row execute function app.enforce_customer_child_org();

-- Le contact rattaché à un site doit appartenir au même client, sans quoi une
-- fiche pourrait désigner l'interlocuteur d'une autre entreprise.
create or replace function app.enforce_site_contact_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact_customer uuid;
begin
  if new.contact_id is null then
    return new;
  end if;

  select customer_id into v_contact_customer
  from public.customer_contacts
  where id = new.contact_id;

  if v_contact_customer is null or v_contact_customer <> new.customer_id then
    raise exception 'Le contact doit appartenir au même client que le site.'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists sites_contact_same_customer on public.sites;
create trigger sites_contact_same_customer
  before insert or update on public.sites
  for each row execute function app.enforce_site_contact_customer();

-- -----------------------------------------------------------------------------
-- Rattachement des missions
-- -----------------------------------------------------------------------------
alter table public.missions
  add column if not exists customer_id uuid references public.customers (id) on delete set null;

alter table public.missions
  add column if not exists site_id uuid references public.sites (id) on delete set null;

create index if not exists missions_customer_idx
  on public.missions (customer_id) where customer_id is not null;

create index if not exists missions_site_idx
  on public.missions (site_id) where site_id is not null;

-- `on delete set null` des deux côtés : supprimer une fiche client ne doit
-- jamais faire disparaître une mission ni son compte rendu. Le lien se rompt,
-- l'instantané textuel reste, l'historique survit.

create or replace function app.enforce_mission_customer_site()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_org  uuid;
  v_site_org      uuid;
  v_site_customer uuid;
begin
  if new.customer_id is not null then
    select organization_id into v_customer_org
    from public.customers where id = new.customer_id;

    if v_customer_org is null or v_customer_org <> new.organization_id then
      raise exception 'Le client doit appartenir à la même organisation que la mission.'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  if new.site_id is not null then
    select organization_id, customer_id into v_site_org, v_site_customer
    from public.sites where id = new.site_id;

    if v_site_org is null or v_site_org <> new.organization_id then
      raise exception 'Le site doit appartenir à la même organisation que la mission.'
        using errcode = 'foreign_key_violation';
    end if;

    -- Le site impose son client : renseigner l'un sans l'autre est une source
    -- d'incohérence silencieuse dans les statistiques par client.
    if new.customer_id is null then
      new.customer_id := v_site_customer;
    elsif new.customer_id <> v_site_customer then
      raise exception 'Le site sélectionné n''appartient pas au client de la mission.'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists missions_customer_site_guard on public.missions;
create trigger missions_customer_site_guard
  before insert or update on public.missions
  for each row execute function app.enforce_mission_customer_site();

-- Instantané des coordonnées, à la création UNIQUEMENT.
--
-- Ne s'applique qu'aux champs laissés vides : une saisie manuelle l'emporte
-- toujours, le terrain sachant parfois mieux que la fiche.
create or replace function app.snapshot_mission_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_name text;
  v_site record;
begin
  if new.customer_id is not null and (new.customer_name is null or new.customer_name = '') then
    select name into v_customer_name from public.customers where id = new.customer_id;
    new.customer_name := v_customer_name;
  end if;

  if new.site_id is not null then
    select name, address_line1, address_line2, postal_code, city, country, latitude, longitude
    into v_site
    from public.sites where id = new.site_id;

    new.location_label := coalesce(new.location_label, v_site.name);
    new.address_line1  := coalesce(new.address_line1, v_site.address_line1);
    new.address_line2  := coalesce(new.address_line2, v_site.address_line2);
    new.postal_code    := coalesce(new.postal_code, v_site.postal_code);
    new.city           := coalesce(new.city, v_site.city);
    new.country        := coalesce(new.country, v_site.country);
    new.latitude       := coalesce(new.latitude, v_site.latitude);
    new.longitude      := coalesce(new.longitude, v_site.longitude);
  end if;

  return new;
end;
$$;

drop trigger if exists missions_snapshot_customer on public.missions;
create trigger missions_snapshot_customer
  before insert on public.missions
  for each row execute function app.snapshot_mission_customer();

-- -----------------------------------------------------------------------------
-- Journal d'audit
-- -----------------------------------------------------------------------------
create or replace function app.audit_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_audit_log(
      new.organization_id, 'customer.created', 'customer', new.id,
      jsonb_build_object('name', new.name, 'reference', new.reference)
    );
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      perform app.write_audit_log(
        new.organization_id, 'customer.status_changed', 'customer', new.id,
        jsonb_build_object('from', old.status, 'to', new.status)
      );
    end if;
  elsif tg_op = 'DELETE' then
    perform app.write_audit_log(
      old.organization_id, 'customer.deleted', 'customer', old.id,
      jsonb_build_object('name', old.name, 'reference', old.reference)
    );
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists customers_audit on public.customers;
create trigger customers_audit
  after insert or update or delete on public.customers
  for each row execute function app.audit_customer();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.sites enable row level security;

-- Deux populations lisent un client, pour deux raisons distinctes.
--
-- Ceux qui gèrent le portefeuille — `customer.view` — le voient en entier.
-- Le technicien, lui, n'a aucune raison de connaître la liste des clients de
-- l'entreprise ; il a besoin de la fiche du client CHEZ QUI il intervient. La
-- seconde branche lui ouvre exactement cela, et rien de plus : la sous-requête
-- s'exécute elle-même sous la policy des missions, donc bornée aux missions
-- qu'il peut déjà voir.
drop policy if exists "customers_select" on public.customers;
create policy "customers_select"
  on public.customers for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'customers'))
    and (
      (select app.has_org_permission(organization_id, 'customer.view'))
      or id in (select m.customer_id from public.missions m where m.customer_id is not null)
    )
  );

drop policy if exists "customers_insert" on public.customers;
create policy "customers_insert"
  on public.customers for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'customers'))
    and (select app.has_org_permission(organization_id, 'customer.create'))
    and created_by = (select auth.uid())
  );

drop policy if exists "customers_update" on public.customers;
create policy "customers_update"
  on public.customers for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'customers'))
    and (select app.has_org_permission(organization_id, 'customer.update'))
  )
  with check ((select app.can_use_pro_module(organization_id, 'customers')));

drop policy if exists "customers_delete" on public.customers;
create policy "customers_delete"
  on public.customers for delete
  to authenticated
  using ((select app.has_org_permission(organization_id, 'customer.delete')));

-- Les tables filles héritent : la sous-requête réévalue `customers_select`.
-- Motif déjà employé par `mission_assignments` et `intervention_attachments`,
-- et seul moyen d'éviter la récursion de policy (42P17).
drop policy if exists "customer_contacts_select" on public.customer_contacts;
create policy "customer_contacts_select"
  on public.customer_contacts for select
  to authenticated
  using (customer_id in (select c.id from public.customers c));

drop policy if exists "customer_contacts_write" on public.customer_contacts;
create policy "customer_contacts_write"
  on public.customer_contacts for all
  to authenticated
  using ((select app.has_org_permission(organization_id, 'customer.update')))
  with check (customer_id in (select c.id from public.customers c));

drop policy if exists "sites_select" on public.sites;
create policy "sites_select"
  on public.sites for select
  to authenticated
  using (
    customer_id in (select c.id from public.customers c)
    -- Un technicien affecté doit atteindre le site — adresse et consignes
    -- d'accès — même si la fiche client lui reste fermée.
    or id in (select m.site_id from public.missions m where m.site_id is not null)
  );

drop policy if exists "sites_write" on public.sites;
create policy "sites_write"
  on public.sites for all
  to authenticated
  using ((select app.has_org_permission(organization_id, 'customer.update')))
  with check (customer_id in (select c.id from public.customers c));

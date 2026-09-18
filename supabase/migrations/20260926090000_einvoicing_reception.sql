-- =============================================================================
-- Réception de factures électroniques (miroir de l'émission, sens inverse)
-- =============================================================================
--
-- CONTEXTE — vérifié contre le vrai spec OpenAPI SUPER PDP
-- (https://api.superpdp.tech/openapi/superpdp.json) et testé en bac à sable
-- (« Burger Queen », entreprise 000000001) avant cette migration :
--
--   - `GET /v1.beta/invoices?direction=in` liste les factures REÇUES — même
--     endpoint que l'émission (`direction=out`, déjà utilisé), même
--     pagination, aucun webhook n'existe dans cette API : la réception est
--     forcément en polling, comme le suivi des statuts d'émission.
--   - Le paramètre `superpdp_send_and_receive=send_and_receive` (au lieu de
--     `send` seul) est la valeur confirmée pour activer la réception — vue
--     de première main sur l'écran de consentement SUPER PDP : « Je donne
--     mon accord formel pour envoyer des factures électroniques ET inscrire
--     à ma demande des adresses électroniques de facturation dans l'annuaire
--     pour recevoir des factures. »
--   - L'inscription à l'annuaire (condition pour être routable comme
--     destinataire) se fait DANS ce même écran de consentement OAuth, pas
--     par un appel séparé à `POST /v1.beta/directory_entries` de notre côté.
--   - Les mandats (`company_mandates`) ne sont PAS utilisés ici : ils
--     concernent une entreprise qui reçoit pour le compte d'une AUTRE
--     entreprise sans connexion directe. Chaque organisation REZO360 se
--     connecte à son propre SIREN, exactement comme pour l'émission.
--
-- Ce stockage ne constitue PAS un SAE (Système d'Archivage Électronique)
-- certifié — même réserve que `invoice_electronic_documents` pour l'émission.

-- -----------------------------------------------------------------------------
-- Extension de la connexion existante : statut de réception, indépendant du
-- statut d'émission (une organisation peut émettre sans jamais avoir demandé
-- la réception, ou l'inverse en théorie).
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'einvoicing_reception_status') then
    create type public.einvoicing_reception_status as enum (
      'not_requested',
      'pending_verification',
      'active',
      'failed'
    );
  end if;
end
$$;

alter table public.einvoicing_provider_connections
  add column if not exists reception_status public.einvoicing_reception_status
    not null default 'not_requested',
  add column if not exists reception_activated_at timestamptz,
  add column if not exists reception_last_checked_at timestamptz,
  add column if not exists reception_last_error_code text,
  add column if not exists reception_last_error_message text;

alter table public.einvoicing_provider_connections
  add constraint einvoicing_reception_active_is_recent_or_null check (
    reception_status <> 'active' or reception_activated_at is not null
  );

grant select (
  reception_status,
  reception_activated_at,
  reception_last_checked_at,
  reception_last_error_code,
  reception_last_error_message
) on public.einvoicing_provider_connections to authenticated;

revoke all on type public.einvoicing_reception_status from public, anon;
grant usage on type public.einvoicing_reception_status to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Factures reçues — miroir de `invoice_transmissions`, sens inverse.
--
-- `internal_status` est le SEUL champ modifiable par un utilisateur : le tri
-- (nouvelle / vue / archivée / contestée) est un usage interne à
-- l'organisation, jamais transmis à SUPER PDP. `regulatory_status` reflète ce
-- que le réseau a réellement transmis (accusés de réception, rejets…) — lecture
-- seule côté client, alimenté uniquement par le worker de synchronisation.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'received_invoice_internal_status') then
    create type public.received_invoice_internal_status as enum (
      'new',
      'viewed',
      'archived',
      'disputed'
    );
  end if;
end
$$;

create table public.received_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provider_code text not null check (char_length(btrim(provider_code)) between 2 and 80),
  provider_invoice_id text not null check (btrim(provider_invoice_id) <> ''),

  internal_status public.received_invoice_internal_status not null default 'new',
  regulatory_status public.invoice_transmission_status,

  supplier_name text check (supplier_name is null or char_length(btrim(supplier_name)) between 1 and 300),
  supplier_siren text check (supplier_siren is null or supplier_siren ~ '^\d{9}$'),
  supplier_identifier text,

  currency_code text check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  amount_without_vat numeric(14, 2),
  amount_vat numeric(14, 2),
  amount_with_vat numeric(14, 2),

  issue_date date,
  payment_due_date date,
  received_at timestamptz not null default now(),

  last_error_code text,
  last_error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint received_invoices_provider_unique unique (provider_code, provider_invoice_id)
);

create index received_invoices_organization_status_idx
  on public.received_invoices (organization_id, internal_status, received_at desc);

create table public.received_invoice_events (
  id uuid primary key default gen_random_uuid(),
  received_invoice_id uuid not null references public.received_invoices(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  source text not null check (source in ('application', 'provider', 'administration')),
  event_type text not null check (char_length(btrim(event_type)) between 1 and 100),
  normalized_status public.invoice_transmission_status,
  provider_status_code text,
  provider_event_id text,
  message text,
  payload_sha256 text check (payload_sha256 is null or payload_sha256 ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now()
);

create index received_invoice_events_timeline_idx
  on public.received_invoice_events (received_invoice_id, occurred_at desc, recorded_at desc);

create unique index received_invoice_events_provider_event_idx
  on public.received_invoice_events (received_invoice_id, provider_event_id)
  where provider_event_id is not null;

create table public.received_invoice_documents (
  received_invoice_id uuid primary key references public.received_invoices(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  -- Le document ORIGINAL tel que transmis par le fournisseur (jamais reconstruit) :
  -- UBL, CII ou Factur-X selon ce que le fournisseur a réellement envoyé.
  original_format text not null check (original_format in ('ubl', 'cii', 'factur_x')),
  object_path text not null unique,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size integer not null check (byte_size between 1 and 5000000),
  stored_at timestamptz not null default now(),
  check (object_path = organization_id::text || '/' || received_invoice_id::text || '/original')
);

-- -----------------------------------------------------------------------------
-- Immuabilité — mêmes garanties que le cycle d'émission.
-- -----------------------------------------------------------------------------
create function app.guard_received_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id
      or new.provider_code is distinct from old.provider_code
      or new.provider_invoice_id is distinct from old.provider_invoice_id
      or new.received_at is distinct from old.received_at
      or new.created_at is distinct from old.created_at then
      raise exception 'L’identité d’une facture reçue ne peut pas être modifiée.'
        using errcode = 'restrict_violation';
    end if;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Une facture reçue ne peut pas être supprimée : son historique doit être conservé.'
      using errcode = 'restrict_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger received_invoices_guard
  before insert or update or delete on public.received_invoices
  for each row execute function app.guard_received_invoice();

create function app.guard_received_invoice_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Un événement de réception est immuable.' using errcode = 'restrict_violation';
  end if;
  select r.organization_id into new.organization_id
  from public.received_invoices r where r.id = new.received_invoice_id;
  if new.organization_id is null then
    raise exception 'Facture reçue introuvable.' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger received_invoice_events_guard
  before insert or update or delete on public.received_invoice_events
  for each row execute function app.guard_received_invoice_event();

create function app.guard_received_invoice_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Le document d’une facture reçue ne peut pas être remplacé ou supprimé.'
      using errcode = 'restrict_violation';
  end if;
  if not exists (
    select 1 from public.received_invoices r
    where r.id = new.received_invoice_id and r.organization_id = new.organization_id
  ) then
    raise exception 'Facture reçue introuvable pour cette organisation.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger received_invoice_document_guard
  before insert or update or delete on public.received_invoice_documents
  for each row execute function app.guard_received_invoice_document();

-- -----------------------------------------------------------------------------
-- RLS — lecture cliente / écriture serveur, sauf `internal_status` qui reste
-- un usage interne à l'organisation (colonne dédiée, jamais transmise au réseau).
-- -----------------------------------------------------------------------------
alter table public.received_invoices enable row level security;
alter table public.received_invoice_events enable row level security;
alter table public.received_invoice_documents enable row level security;

revoke all on public.received_invoices from public, anon, authenticated, service_role;
revoke all on public.received_invoice_events from public, anon, authenticated, service_role;
revoke all on public.received_invoice_documents from public, anon, authenticated, service_role;

grant select on public.received_invoices, public.received_invoice_events, public.received_invoice_documents
  to authenticated;
grant update (internal_status) on public.received_invoices to authenticated;
grant all on public.received_invoices, public.received_invoice_events, public.received_invoice_documents
  to service_role;

revoke all on type public.received_invoice_internal_status from public, anon;
grant usage on type public.received_invoice_internal_status to authenticated, service_role;

create policy received_invoices_select
  on public.received_invoices for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'invoicing'))
    and (select app.has_org_permission(organization_id, 'invoice.view'))
  );

create policy received_invoices_update_internal_status
  on public.received_invoices for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'invoicing'))
    and (select app.has_org_permission(organization_id, 'invoice.manage'))
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'invoicing'))
    and (select app.has_org_permission(organization_id, 'invoice.manage'))
  );

create policy received_invoice_events_select
  on public.received_invoice_events for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'invoicing'))
    and (select app.has_org_permission(organization_id, 'invoice.view'))
  );

create policy received_invoice_documents_select
  on public.received_invoice_documents for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'invoicing'))
    and (select app.has_org_permission(organization_id, 'invoice.view'))
  );

revoke all on function app.guard_received_invoice() from public, anon, authenticated;
revoke all on function app.guard_received_invoice_event() from public, anon, authenticated;
revoke all on function app.guard_received_invoice_document() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Stockage — bucket privé dédié, mêmes restrictions que le document d'émission.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'received-invoice-documents',
  'received-invoice-documents',
  false,
  5000000,
  array['application/xml', 'text/xml', 'application/pdf']
);

create policy received_invoice_files_select on storage.objects
  for select to authenticated
  using (bucket_id = 'received-invoice-documents' and exists (
    select 1 from public.received_invoice_documents d where d.object_path = storage.objects.name
  ));
create policy received_invoice_files_no_insert on storage.objects
  as restrictive for insert to anon, authenticated
  with check (bucket_id <> 'received-invoice-documents');
create policy received_invoice_files_no_update on storage.objects
  as restrictive for update to anon, authenticated
  using (bucket_id <> 'received-invoice-documents')
  with check (bucket_id <> 'received-invoice-documents');
create policy received_invoice_files_no_delete on storage.objects
  as restrictive for delete to anon, authenticated
  using (bucket_id <> 'received-invoice-documents');
create policy received_invoice_files_read_scope on storage.objects
  as restrictive for select to authenticated
  using (bucket_id <> 'received-invoice-documents' or exists (
    select 1 from public.received_invoice_documents d where d.object_path = storage.objects.name
  ));
create policy received_invoice_files_no_anon_read on storage.objects
  as restrictive for select to anon
  using (bucket_id <> 'received-invoice-documents');

comment on table public.received_invoices is
  'Factures reçues de fournisseurs via SUPER PDP (direction=in). Écriture serveur uniquement, sauf internal_status (tri interne, jamais transmis au réseau).';
comment on table public.received_invoice_events is
  'Journal immuable des événements de réception — miroir de invoice_transmission_events.';
comment on table public.received_invoice_documents is
  'Document original conservé tel quel (UBL/CII/Factur-X), empreinte SHA-256. Ce stockage ne constitue pas un SAE certifié.';
comment on column public.einvoicing_provider_connections.reception_status is
  'Statut de la réception, indépendant de l’émission. Le scope OAuth accordé n’est jamais exposé par SUPER PDP (GET /v1.beta/oauth2_sessions/me n’a pas ce champ) : "active" n’est posé qu’après un sondage réussi de GET /v1.beta/invoices?direction=in.';

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.received_invoices'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.received_invoice_events'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.received_invoice_documents'::regclass) then
    raise exception 'RLS doit être active sur les tables de réception.';
  end if;
  if has_table_privilege('authenticated', 'public.received_invoices', 'INSERT')
    or has_table_privilege('authenticated', 'public.received_invoice_events', 'INSERT')
    or has_table_privilege('authenticated', 'public.received_invoice_documents', 'INSERT') then
    raise exception 'Aucune écriture cliente ne doit être possible sur les tables de réception.';
  end if;
  if has_column_privilege('authenticated', 'public.received_invoices', 'provider_invoice_id', 'UPDATE') then
    raise exception 'Seul internal_status doit être modifiable par un client sur received_invoices.';
  end if;
end
$$;

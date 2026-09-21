-- =============================================================================
-- Editeurs A4 : numerotation configurable, options de document et logo
-- =============================================================================

alter table public.quotes
  add column if not exists document_options jsonb not null default '{}'::jsonb,
  add column if not exists discount_rate numeric(5, 2) not null default 0
    check (discount_rate >= 0 and discount_rate <= 100);

alter table public.invoices
  add column if not exists document_options jsonb not null default '{}'::jsonb,
  add column if not exists discount_rate numeric(5, 2) not null default 0
    check (discount_rate >= 0 and discount_rate <= 100);

alter table public.quotes
  add constraint quotes_document_options_object
  check (jsonb_typeof(document_options) = 'object');

alter table public.invoices
  add constraint invoices_document_options_object
  check (jsonb_typeof(document_options) = 'object');

-- Une ligne verrouillable par serie. La valeur suivante est prelevee dans la
-- meme transaction que le document : aucun doublon, aucun trou en cas d'echec.
create table public.document_numbering_settings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_kind text not null check (document_kind in ('quote', 'invoice', 'credit_note')),
  format text not null check (format in (
    'day_sequence', 'month_sequence', 'year_sequence', 'sequence_6', 'sequence',
    'legacy_quote', 'legacy_invoice'
  )),
  next_value integer not null default 1 check (next_value > 0),
  configured boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (organization_id, document_kind)
);

alter table public.document_numbering_settings enable row level security;
revoke all on public.document_numbering_settings from public, anon, authenticated;
grant select, insert, update on public.document_numbering_settings to authenticated;

create policy document_numbering_settings_select
  on public.document_numbering_settings for select to authenticated
  using (
    app.has_org_permission(organization_id,
      case when document_kind = 'quote' then 'quote.view' else 'invoice.view' end)
  );

create policy document_numbering_settings_insert
  on public.document_numbering_settings for insert to authenticated
  with check (
    app.has_org_permission(organization_id,
      case when document_kind = 'quote' then 'quote.manage' else 'invoice.manage' end)
  );

create policy document_numbering_settings_update
  on public.document_numbering_settings for update to authenticated
  using (
    app.has_org_permission(organization_id,
      case when document_kind = 'quote' then 'quote.manage' else 'invoice.manage' end)
  )
  with check (
    app.has_org_permission(organization_id,
      case when document_kind = 'quote' then 'quote.manage' else 'invoice.manage' end)
  );

insert into public.document_numbering_settings
  (organization_id, document_kind, format, next_value, configured)
select o.id, 'quote', 'legacy_quote',
  coalesce((
    select max((regexp_match(q.reference, '(\d+)$'))[1]::integer) + 1
    from public.quotes q
    where q.organization_id = o.id and q.reference ~ '\d+$'
  ), 1),
  exists (select 1 from public.quotes q where q.organization_id = o.id)
from public.organizations o
on conflict (organization_id, document_kind) do nothing;

insert into public.document_numbering_settings
  (organization_id, document_kind, format, next_value, configured)
select o.id, kind.document_kind, 'legacy_invoice',
  coalesce((
    select max(c.last_value) + 1
    from public.invoice_counters c
    where c.organization_id = o.id
      and c.document_type::text = case when kind.document_kind = 'credit_note' then 'credit_note' else 'invoice' end
  ), 1),
  exists (
    select 1 from public.invoices i
    where i.organization_id = o.id
      and i.document_type::text = case when kind.document_kind = 'credit_note' then 'credit_note' else 'invoice' end
      and i.status <> 'draft'
  )
from public.organizations o
cross join (values ('invoice'), ('credit_note')) as kind(document_kind)
on conflict (organization_id, document_kind) do nothing;

create or replace function app.seed_document_numbering_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.document_numbering_settings
    (organization_id, document_kind, format, next_value, configured)
  values
    (new.id, 'quote', 'legacy_quote', 1, false),
    (new.id, 'invoice', 'legacy_invoice', 1, false),
    (new.id, 'credit_note', 'legacy_invoice', 1, false)
  on conflict (organization_id, document_kind) do nothing;
  return new;
end;
$$;

revoke all on function app.seed_document_numbering_settings() from public, anon, authenticated;

drop trigger if exists organizations_seed_document_numbering on public.organizations;
create trigger organizations_seed_document_numbering
  after insert on public.organizations
  for each row execute function app.seed_document_numbering_settings();

create or replace function app.format_document_reference(
  p_format text,
  p_value integer,
  p_document_date date,
  p_document_kind text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  return case p_format
    when 'day_sequence' then to_char(p_document_date, 'YYYY-MM-DD') || '-' || lpad(p_value::text, 6, '0')
    when 'month_sequence' then to_char(p_document_date, 'YYYY-MM') || '-' || lpad(p_value::text, 6, '0')
    when 'year_sequence' then to_char(p_document_date, 'YYYY') || '-' || lpad(p_value::text, 6, '0')
    when 'sequence_6' then lpad(p_value::text, 6, '0')
    when 'sequence' then p_value::text
    when 'legacy_quote' then 'DEV-' || lpad(p_value::text, 4, '0')
    when 'legacy_invoice' then
      (case when p_document_kind = 'credit_note' then 'AV' else 'FAC' end)
      || '-' || to_char(p_document_date, 'YYYY') || '-' || lpad(p_value::text, 5, '0')
    else null
  end;
end;
$$;

revoke all on function app.format_document_reference(text, integer, date, text)
  from public, anon, authenticated;

create or replace function public.configure_document_numbering(
  p_organization_id uuid,
  p_document_kind text,
  p_first_number integer,
  p_format text
)
returns public.document_numbering_settings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result public.document_numbering_settings;
begin
  if p_document_kind not in ('quote', 'invoice', 'credit_note')
     or p_format not in ('day_sequence', 'month_sequence', 'year_sequence', 'sequence_6', 'sequence')
     or p_first_number < 1 then
    raise exception 'Parametres de numerotation invalides.' using errcode = '23514';
  end if;

  if not app.has_org_permission(
    p_organization_id,
    case when p_document_kind = 'quote' then 'quote.manage' else 'invoice.manage' end
  ) then
    raise exception 'Configuration non autorisee.' using errcode = '42501';
  end if;

  if p_document_kind <> 'quote' and exists (
    select 1 from public.invoices i
    where i.organization_id = p_organization_id
      and i.document_type::text = case when p_document_kind = 'credit_note' then 'credit_note' else 'invoice' end
      and i.status <> 'draft'
  ) then
    raise exception 'La numerotation est figee apres la premiere emission.' using errcode = '23001';
  end if;

  insert into public.document_numbering_settings
    (organization_id, document_kind, format, next_value, configured)
  values (p_organization_id, p_document_kind, p_format, p_first_number, true)
  on conflict (organization_id, document_kind) do update set
    format = excluded.format,
    next_value = excluded.next_value,
    configured = true,
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.configure_document_numbering(uuid, text, integer, text)
  from public, anon;
grant execute on function public.configure_document_numbering(uuid, text, integer, text)
  to authenticated;

create or replace function app.generate_quote_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_setting public.document_numbering_settings;
  v_value integer;
begin
  if new.reference is not null and new.reference <> '' then return new; end if;

  insert into public.document_numbering_settings
    (organization_id, document_kind, format, next_value, configured)
  values (new.organization_id, 'quote', 'legacy_quote', 1, false)
  on conflict (organization_id, document_kind) do nothing;

  select * into v_setting
  from public.document_numbering_settings
  where organization_id = new.organization_id and document_kind = 'quote'
  for update;

  v_value := v_setting.next_value;
  update public.document_numbering_settings
  set next_value = next_value + 1, updated_at = now()
  where organization_id = new.organization_id and document_kind = 'quote';

  new.reference := app.format_document_reference(
    v_setting.format, v_value, coalesce(new.created_at::date, current_date), 'quote'
  );
  return new;
end;
$$;

create or replace function app.generate_invoice_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_setting public.document_numbering_settings;
  v_value integer;
  v_year integer;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.issued_at is not null then
      raise exception 'Creez un brouillon avant d''emettre la facture.' using errcode = '23514';
    end if;
    new.reference := 'BR-' || new.id::text;
    return new;
  end if;

  if old.status <> 'draft' then
    if new.status = 'draft' then
      raise exception 'Une facture emise ne redevient pas un brouillon.' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.status = 'draft' then
    new.reference := old.reference;
    new.issued_at := null;
    return new;
  end if;
  if new.status <> 'issued' then
    raise exception 'Emettez la facture avant de modifier son statut.' using errcode = '23514';
  end if;

  new.issued_at := clock_timestamp();
  v_year := extract(year from new.issued_at at time zone 'UTC')::integer;
  v_kind := case when new.document_type = 'credit_note' then 'credit_note' else 'invoice' end;

  insert into public.document_numbering_settings
    (organization_id, document_kind, format, next_value, configured)
  values (new.organization_id, v_kind, 'legacy_invoice', 1, false)
  on conflict (organization_id, document_kind) do nothing;

  select * into v_setting
  from public.document_numbering_settings
  where organization_id = new.organization_id and document_kind = v_kind
  for update;

  v_value := v_setting.next_value;
  update public.document_numbering_settings
  set next_value = next_value + 1, updated_at = now()
  where organization_id = new.organization_id and document_kind = v_kind;

  insert into public.invoice_counters as c
    (organization_id, year, document_type, last_value)
  values (new.organization_id, v_year, new.document_type, v_value)
  on conflict (organization_id, year, document_type)
  do update set last_value = greatest(c.last_value, excluded.last_value), updated_at = now();

  new.reference := app.format_document_reference(
    v_setting.format, v_value, (new.issued_at at time zone 'UTC')::date, v_kind
  );
  return new;
end;
$$;

-- Les remises sont appliquees proportionnellement a chaque groupe de TVA.
create or replace view public.quote_totals
with (security_invoker = true)
as
with gross as (
  select q.id, q.organization_id, q.vat_rate, q.discount_rate,
    coalesce(sum(round(i.quantity * i.unit_price_cents))::bigint, 0) as gross_cents
  from public.quotes q
  left join public.quote_items i on i.quote_id = q.id
  group by q.id, q.organization_id, q.vat_rate, q.discount_rate
), discounted as (
  select *, round(gross_cents * discount_rate / 100)::bigint as discount_cents
  from gross
)
select id as quote_id, organization_id,
  gross_cents as gross_subtotal_cents,
  discount_cents,
  (gross_cents - discount_cents)::bigint as subtotal_cents,
  round((gross_cents - discount_cents) * vat_rate / 100)::bigint as vat_cents,
  ((gross_cents - discount_cents) + round((gross_cents - discount_cents) * vat_rate / 100))::bigint as total_cents
from discounted;

create or replace view public.invoice_vat_breakdown
with (security_invoker = true)
as
with gross as (
  select f.id as invoice_id, f.organization_id, f.discount_rate,
    it.vat_rate, it.vat_category,
    sum(round(it.quantity * it.unit_price_cents))::bigint as gross_base_cents
  from public.invoices f
  join public.invoice_items it on it.invoice_id = f.id
  group by f.id, f.organization_id, f.discount_rate, it.vat_rate, it.vat_category
)
select invoice_id, organization_id, vat_rate, vat_category,
  (gross_base_cents - round(gross_base_cents * discount_rate / 100))::bigint as base_cents,
  round(
    (gross_base_cents - round(gross_base_cents * discount_rate / 100)) * vat_rate / 100
  )::bigint as vat_cents
from gross;

create or replace view public.invoice_totals
with (security_invoker = true)
as
select f.id as invoice_id, f.organization_id,
  coalesce(g.gross_cents, 0)::bigint as gross_subtotal_cents,
  (coalesce(g.gross_cents, 0) - coalesce(b.base_cents, 0))::bigint as discount_cents,
  coalesce(b.base_cents, 0)::bigint as subtotal_cents,
  coalesce(b.vat_cents, 0)::bigint as vat_cents,
  (coalesce(b.base_cents, 0) + coalesce(b.vat_cents, 0))::bigint as total_cents
from public.invoices f
left join (
  select invoice_id, sum(round(quantity * unit_price_cents))::bigint as gross_cents
  from public.invoice_items group by invoice_id
) g on g.invoice_id = f.id
left join (
  select invoice_id, sum(base_cents)::bigint as base_cents, sum(vat_cents)::bigint as vat_cents
  from public.invoice_vat_breakdown group by invoice_id
) b on b.invoice_id = f.id;

-- La transaction de sauvegarde accepte les deux nouvelles proprietes.
create or replace function public.save_invoice_draft(
  p_invoice_id uuid, p_expected_updated_at timestamptz, p_patch jsonb, p_items jsonb
) returns public.invoices language plpgsql security invoker set search_path = '' as $$
declare v_invoice public.invoices; v_patch public.invoices; v_result public.invoices;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Facture inaccessible.' using errcode = '42501'; end if;
  if not app.has_org_permission(v_invoice.organization_id, 'invoice.manage')
    or not app.can_use_pro_module(v_invoice.organization_id, 'invoicing') then
    raise exception 'Modification non autorisee.' using errcode = '42501';
  end if;
  if v_invoice.status <> 'draft' then raise exception 'Cette facture est deja emise.' using errcode = '23001'; end if;
  if v_invoice.updated_at is distinct from p_expected_updated_at then
    raise exception 'Ce brouillon a ete modifie. Actualisez la facture.' using errcode = '40001';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Brouillon invalide.' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) as k where k <> all(array[
    'title','notes','customer_name','customer_legal_name','customer_type','customer_registration_number',
    'customer_vat_number','customer_address_line1','customer_address_line2','customer_postal_code',
    'customer_city','customer_country','due_date','payment_terms','payment_method',
    'service_date','operation_type','buyer_reference','purchase_order_reference','delivery_address_line1',
    'delivery_address_line2','delivery_postal_code','delivery_city','delivery_country',
    'early_payment_terms','late_payment_terms','vat_on_debits','document_options','discount_rate'
  ])) or jsonb_array_length(p_items) > 500 then
    raise exception 'Champs du brouillon invalides.' using errcode = '23514';
  end if;
  v_patch := jsonb_populate_record(v_invoice, p_patch);
  update public.invoices set
    title = v_patch.title, notes = v_patch.notes,
    customer_name = v_patch.customer_name, customer_legal_name = v_patch.customer_legal_name,
    customer_type = v_patch.customer_type, customer_registration_number = v_patch.customer_registration_number,
    customer_vat_number = v_patch.customer_vat_number, customer_address_line1 = v_patch.customer_address_line1,
    customer_address_line2 = v_patch.customer_address_line2, customer_postal_code = v_patch.customer_postal_code,
    customer_city = v_patch.customer_city, customer_country = v_patch.customer_country,
    service_date = v_patch.service_date, operation_type = v_patch.operation_type,
    buyer_reference = v_patch.buyer_reference, purchase_order_reference = v_patch.purchase_order_reference,
    delivery_address_line1 = v_patch.delivery_address_line1,
    delivery_address_line2 = v_patch.delivery_address_line2,
    delivery_postal_code = v_patch.delivery_postal_code,
    delivery_city = v_patch.delivery_city, delivery_country = v_patch.delivery_country,
    early_payment_terms = v_patch.early_payment_terms, late_payment_terms = v_patch.late_payment_terms,
    vat_on_debits = v_patch.vat_on_debits, due_date = v_patch.due_date,
    payment_terms = v_patch.payment_terms, payment_method = v_patch.payment_method,
    document_options = v_patch.document_options, discount_rate = v_patch.discount_rate
  where id = p_invoice_id returning * into v_result;
  if not found then raise exception 'Modification non autorisee.' using errcode = '42501'; end if;
  delete from public.invoice_items where invoice_id = p_invoice_id;
  insert into public.invoice_items
    (invoice_id, organization_id, description, unit, quantity, unit_price_cents, vat_rate, vat_category, vat_exemption_reason, position)
  select p_invoice_id, v_invoice.organization_id, item->>'description', item->>'unit',
    (item->>'quantity')::numeric, (item->>'unit_price_cents')::integer, (item->>'vat_rate')::numeric,
    coalesce(item->>'vat_category', 'S'), nullif(item->>'vat_exemption_reason', ''), ordinality - 1
  from jsonb_array_elements(p_items) with ordinality as lines(item, ordinality);
  select * into v_result from public.invoices where id = p_invoice_id;
  return v_result;
end;
$$;

revoke all on function public.save_invoice_draft(uuid, timestamptz, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_invoice_draft(uuid, timestamptz, jsonb, jsonb)
  to authenticated;

-- Logo d'entreprise : ressource publique volontaire (identite visuelle), depot
-- strictement reserve aux administrateurs de l'organisation.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-branding', 'organization-branding', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists organization_branding_upload on storage.objects;
create policy organization_branding_upload
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'organization-branding'
    and app.has_org_permission(((storage.foldername(name))[1])::uuid, 'organization.update')
  );

drop policy if exists organization_branding_delete on storage.objects;
create policy organization_branding_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'organization-branding'
    and app.has_org_permission(((storage.foldername(name))[1])::uuid, 'organization.update')
  );

grant select on public.quote_totals, public.invoice_totals, public.invoice_vat_breakdown
  to authenticated;

notify pgrst, 'reload schema';

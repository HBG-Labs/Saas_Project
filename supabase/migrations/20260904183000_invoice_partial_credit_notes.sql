-- Partial credit notes. Several issued credits may correct one invoice, but a
-- single editable draft is allowed and cumulative quantities can never exceed
-- the original lines.

alter table public.invoices add column credit_note_scope text;
update public.invoices set credit_note_scope = 'full' where document_type = 'credit_note';
alter table public.invoices add constraint invoices_credit_note_scope check (
  (document_type = 'invoice' and credit_note_scope is null)
  or (document_type = 'credit_note' and credit_note_scope in ('full', 'partial'))
);

drop index public.invoices_one_full_credit_note_idx;
create unique index invoices_one_credit_note_draft_idx
  on public.invoices (corrects_invoice_id)
  where document_type = 'credit_note' and status = 'draft';
create index invoices_credit_notes_source_idx
  on public.invoices (corrects_invoice_id, created_at)
  where document_type = 'credit_note';

alter table public.invoice_items
  add column source_invoice_item_id uuid references public.invoice_items(id) on delete restrict;

-- Existing credits were exact full copies. Position is stable and was copied by
-- the former RPC; the value comparison prevents an accidental bad association.
update public.invoice_items credited
set source_invoice_item_id = source.id
from public.invoices credit, public.invoice_items source
where credit.id = credited.invoice_id
  and credit.document_type = 'credit_note'
  and source.invoice_id = credit.corrects_invoice_id
  and source.position = credited.position
  and source.description = credited.description
  and source.unit = credited.unit
  and source.quantity = credited.quantity
  and source.unit_price_cents = credited.unit_price_cents
  and source.vat_rate = credited.vat_rate
  and source.vat_category = credited.vat_category
  and source.vat_exemption_reason is not distinct from credited.vat_exemption_reason;

create index invoice_items_credit_source_idx
  on public.invoice_items (source_invoice_item_id)
  where source_invoice_item_id is not null;

create or replace function app.enforce_full_credit_note()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_source public.invoices;
begin
  if tg_op = 'UPDATE' and (new.document_type is distinct from old.document_type
    or new.corrects_invoice_id is distinct from old.corrects_invoice_id
    or new.credit_note_scope is distinct from old.credit_note_scope) then
    raise exception 'Le type de document, la portée et la facture d''origine ne peuvent pas changer.' using errcode = '23514';
  end if;
  if new.document_type <> 'credit_note' then return new; end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then return new; end if;

  -- FOR UPDATE serializes issuance of every credit attached to this source.
  select * into v_source from public.invoices where id = new.corrects_invoice_id for update;
  if not found or v_source.organization_id <> new.organization_id
    or v_source.document_type <> 'invoice' or v_source.status not in ('issued','sent','paid') then
    raise exception 'Un avoir doit reprendre une facture émise accessible de votre entreprise.' using errcode = '23514';
  end if;
  if new.id = v_source.id then
    raise exception 'Un avoir ne peut pas se référencer lui-même.' using errcode = '23514';
  end if;
  new.corrected_invoice_reference := v_source.reference;
  new.corrected_invoice_issued_at := v_source.issued_at;
  if new.status = 'draft' then return new; end if;

  if new.currency is distinct from v_source.currency
    or new.customer_id is distinct from v_source.customer_id
    or new.customer_name is distinct from v_source.customer_name
    or new.customer_legal_name is distinct from v_source.customer_legal_name
    or new.customer_registration_number is distinct from v_source.customer_registration_number
    or new.customer_vat_number is distinct from v_source.customer_vat_number
    or new.customer_type is distinct from v_source.customer_type
    or new.customer_address_line1 is distinct from v_source.customer_address_line1
    or new.customer_address_line2 is distinct from v_source.customer_address_line2
    or new.customer_postal_code is distinct from v_source.customer_postal_code
    or new.customer_city is distinct from v_source.customer_city
    or new.customer_country is distinct from v_source.customer_country then
    raise exception 'L''avoir doit conserver le destinataire et la devise de la facture d''origine.' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.invoice_items credited
    left join public.invoice_items source on source.id = credited.source_invoice_item_id
      and source.invoice_id = v_source.id
    where credited.invoice_id = new.id and (
      source.id is null
      or credited.description is distinct from source.description
      or credited.unit is distinct from source.unit
      or credited.unit_price_cents is distinct from source.unit_price_cents
      or credited.vat_rate is distinct from source.vat_rate
      or credited.vat_category is distinct from source.vat_category
      or credited.vat_exemption_reason is distinct from source.vat_exemption_reason
    )
  ) then
    raise exception 'Chaque ligne de l''avoir doit reprendre une ligne et sa TVA de la facture d''origine.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.invoice_items source
    join lateral (
      select coalesce(sum(credited.quantity), 0) as quantity
      from public.invoice_items credited
      join public.invoices credit on credit.id = credited.invoice_id
      where credited.source_invoice_item_id = source.id
        and credit.corrects_invoice_id = v_source.id
        and credit.document_type = 'credit_note'
        and credit.status <> 'draft'
        and credit.id <> new.id
    ) previous on true
    left join public.invoice_items current on current.invoice_id = new.id
      and current.source_invoice_item_id = source.id
    where source.invoice_id = v_source.id
    group by source.id, source.quantity, previous.quantity
    having previous.quantity + coalesce(sum(current.quantity), 0) > source.quantity
  ) then
    raise exception 'Les avoirs émis dépasseraient les quantités de la facture d''origine.' using errcode = '23514';
  end if;

  if new.credit_note_scope = 'full' and (
    exists (select 1 from public.invoices credit where credit.corrects_invoice_id = v_source.id
      and credit.document_type = 'credit_note' and credit.status <> 'draft' and credit.id <> new.id)
    or exists (select 1 from public.invoice_items source where source.invoice_id = v_source.id
      and not exists (select 1 from public.invoice_items credited where credited.invoice_id = new.id
        and credited.source_invoice_item_id = source.id and credited.quantity = source.quantity))
    or exists (select 1 from public.invoice_items credited where credited.invoice_id = new.id
      and not exists (select 1 from public.invoice_items source where source.invoice_id = v_source.id
        and source.id = credited.source_invoice_item_id and source.quantity = credited.quantity))
  ) then
    raise exception 'Un avoir total doit reprendre toutes les quantités et ne peut suivre un avoir déjà émis.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.get_creditable_invoice_lines(p_invoice_id uuid)
returns table (
  invoice_item_id uuid, description text, unit text, unit_price_cents integer,
  vat_rate numeric, vat_category text, vat_exemption_reason text, line_position integer,
  original_quantity numeric, credited_quantity numeric, available_quantity numeric
) language sql security invoker set search_path = '' stable as $$
  select source.id, source.description, source.unit, source.unit_price_cents,
    source.vat_rate, source.vat_category, source.vat_exemption_reason, source.position,
    source.quantity,
    coalesce((select sum(credited.quantity)
      from public.invoice_items credited
      join public.invoices credit on credit.id = credited.invoice_id
      where credited.source_invoice_item_id = source.id
        and credit.corrects_invoice_id = invoice.id
        and credit.document_type = 'credit_note' and credit.status <> 'draft'), 0)::numeric,
    (source.quantity - coalesce((select sum(credited.quantity)
      from public.invoice_items credited
      join public.invoices credit on credit.id = credited.invoice_id
      where credited.source_invoice_item_id = source.id
        and credit.corrects_invoice_id = invoice.id
        and credit.document_type = 'credit_note' and credit.status <> 'draft'), 0))::numeric
  from public.invoices invoice
  join public.invoice_items source on source.invoice_id = invoice.id
  where invoice.id = p_invoice_id and invoice.document_type = 'invoice'
    and invoice.status in ('issued','sent','paid')
    and app.can_use_pro_module(invoice.organization_id, 'invoicing')
    and app.has_org_permission(invoice.organization_id, 'invoice.view')
  order by source.position, source.id;
$$;
revoke all on function public.get_creditable_invoice_lines(uuid) from public, anon;
grant execute on function public.get_creditable_invoice_lines(uuid) to authenticated;

create function public.create_credit_note_draft(
  p_invoice_id uuid, p_expected_updated_at timestamptz, p_reason text,
  p_scope text, p_lines jsonb
) returns public.invoices language plpgsql security invoker set search_path = '' as $$
declare v_source public.invoices; v_result public.invoices; v_count integer;
  v_distinct integer; v_is_full boolean;
begin
  select * into v_source from public.invoices where id = p_invoice_id for update;
  if not found or not app.has_org_permission(v_source.organization_id, 'invoice.manage')
    or not app.can_use_pro_module(v_source.organization_id, 'invoicing') then
    raise exception 'Création d''avoir non autorisée.' using errcode = '42501';
  end if;
  if v_source.document_type <> 'invoice' or v_source.status not in ('issued','sent','paid') then
    raise exception 'Choisissez une facture émise pour préparer un avoir.' using errcode = '23514';
  end if;
  if v_source.updated_at is distinct from p_expected_updated_at then
    raise exception 'La facture a changé. Actualisez-la avant de préparer l''avoir.' using errcode = '40001';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then
    raise exception 'Précisez le motif de l''avoir (3 à 1 000 caractères).' using errcode = '23514';
  end if;
  if p_scope not in ('full','partial') or jsonb_typeof(p_lines) is distinct from 'array'
    or jsonb_array_length(p_lines) not between 1 and 500
    or exists (select 1 from jsonb_array_elements(p_lines) item where jsonb_typeof(item) <> 'object'
      or not item ? 'invoice_item_id' or not item ? 'quantity'
      or item->>'invoice_item_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or item->>'quantity' !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$'
      or (item->>'quantity')::numeric <= 0) then
    raise exception 'Sélectionnez de 1 à 500 lignes avec une quantité positive (3 décimales maximum).' using errcode = '23514';
  end if;
  select count(*), count(distinct item->>'invoice_item_id') into v_count, v_distinct
    from jsonb_array_elements(p_lines) item;
  if v_count <> v_distinct then
    raise exception 'Une ligne de facture ne peut être sélectionnée qu''une fois.' using errcode = '23514';
  end if;
  select * into v_result from public.invoices where corrects_invoice_id = v_source.id
    and document_type = 'credit_note' and status = 'draft';
  if found then return v_result; end if;

  if exists (
    select 1 from jsonb_array_elements(p_lines) item
    left join public.invoice_items source on source.id::text = item->>'invoice_item_id'
      and source.invoice_id = v_source.id
    where source.id is null or (item->>'quantity')::numeric > source.quantity - coalesce((
      select sum(credited.quantity) from public.invoice_items credited
      join public.invoices credit on credit.id = credited.invoice_id
      where credited.source_invoice_item_id = source.id
        and credit.corrects_invoice_id = v_source.id
        and credit.document_type = 'credit_note' and credit.status <> 'draft'), 0)
  ) then
    raise exception 'La sélection dépasse les quantités encore disponibles à créditer.' using errcode = '23514';
  end if;

  select count(*) = v_count and bool_and((item->>'quantity')::numeric = source.quantity)
    into v_is_full
  from public.invoice_items source
  left join jsonb_array_elements(p_lines) item on item->>'invoice_item_id' = source.id::text
  where source.invoice_id = v_source.id;
  if (p_scope = 'full') is distinct from coalesce(v_is_full, false) then
    raise exception 'La portée totale ou partielle ne correspond pas aux quantités sélectionnées.' using errcode = '23514';
  end if;

  insert into public.invoices (
    organization_id,document_type,credit_note_scope,corrects_invoice_id,credit_note_reason,title,
    customer_id,site_id,site_name,customer_name,customer_legal_name,customer_type,
    customer_registration_number,customer_vat_number,customer_address_line1,customer_address_line2,
    customer_postal_code,customer_city,customer_country,currency,service_date,operation_type,
    buyer_reference,purchase_order_reference,delivery_address_line1,delivery_address_line2,
    delivery_postal_code,delivery_city,delivery_country,vat_on_debits,due_date,payment_terms,
    payment_method,early_payment_terms,late_payment_terms,created_by
  ) values (
    v_source.organization_id,'credit_note',p_scope,v_source.id,btrim(p_reason),
    case p_scope when 'full' then 'Avoir total sur ' else 'Avoir partiel sur ' end || v_source.reference,
    v_source.customer_id,v_source.site_id,v_source.site_name,v_source.customer_name,
    v_source.customer_legal_name,v_source.customer_type,v_source.customer_registration_number,
    v_source.customer_vat_number,v_source.customer_address_line1,v_source.customer_address_line2,
    v_source.customer_postal_code,v_source.customer_city,v_source.customer_country,v_source.currency,
    v_source.service_date,v_source.operation_type,v_source.buyer_reference,v_source.purchase_order_reference,
    v_source.delivery_address_line1,v_source.delivery_address_line2,v_source.delivery_postal_code,
    v_source.delivery_city,v_source.delivery_country,v_source.vat_on_debits,
    (now() at time zone 'UTC')::date,'Modalités de remboursement ou d''imputation à convenir avec le client.',
    null,'Sans objet.','Sans objet.',auth.uid()
  ) returning * into v_result;

  insert into public.invoice_items (
    invoice_id,organization_id,source_invoice_item_id,description,unit,quantity,
    unit_price_cents,vat_rate,vat_category,vat_exemption_reason,position
  ) select v_result.id,v_source.organization_id,source.id,source.description,source.unit,
      (item->>'quantity')::numeric,source.unit_price_cents,source.vat_rate,source.vat_category,
      source.vat_exemption_reason,source.position
    from jsonb_array_elements(p_lines) item
    join public.invoice_items source on source.id::text = item->>'invoice_item_id'
    where source.invoice_id = v_source.id order by source.position,source.id;
  select * into v_result from public.invoices where id = v_result.id;
  return v_result;
end;
$$;
revoke all on function public.create_credit_note_draft(uuid,timestamptz,text,text,jsonb) from public, anon;
grant execute on function public.create_credit_note_draft(uuid,timestamptz,text,text,jsonb) to authenticated;

-- Compatibility for clients still using the original full-credit RPC.
create or replace function public.create_full_credit_note_draft(
  p_invoice_id uuid, p_expected_updated_at timestamptz, p_reason text
) returns public.invoices language plpgsql security invoker set search_path = '' as $$
declare v_lines jsonb; v_result public.invoices;
begin
  select jsonb_agg(jsonb_build_object('invoice_item_id',id,'quantity',quantity) order by position,id)
    into v_lines from public.invoice_items where invoice_id = p_invoice_id;
  select * into v_result from public.create_credit_note_draft(
    p_invoice_id,p_expected_updated_at,p_reason,'full',v_lines);
  return v_result;
end;
$$;

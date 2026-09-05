-- First credit-note workflow: one full credit note per issued invoice.
-- All creation is a draft. The original invoice and its counter stay untouched.
alter table public.invoices
  add column credit_note_reason text,
  add column corrected_invoice_reference text,
  add column corrected_invoice_issued_at timestamptz;

alter table public.invoices add constraint invoices_credit_note_details check (
  (document_type = 'invoice' and credit_note_reason is null
    and corrected_invoice_reference is null and corrected_invoice_issued_at is null)
  or (document_type = 'credit_note' and corrects_invoice_id is not null
    and length(btrim(credit_note_reason)) between 3 and 1000
    and credit_note_reason is not null and corrected_invoice_reference is not null
    and corrected_invoice_issued_at is not null)
);

-- This first workflow supports full credits only, including notes later marked cancelled.
-- Deleting an unissued draft releases the slot; issuing never does.
create unique index invoices_one_full_credit_note_idx on public.invoices (corrects_invoice_id)
  where document_type = 'credit_note';

create function app.enforce_full_credit_note()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_source public.invoices; v_old_lines jsonb; v_new_lines jsonb;
begin
  if tg_op = 'UPDATE' and (new.document_type is distinct from old.document_type
    or new.corrects_invoice_id is distinct from old.corrects_invoice_id) then
    raise exception 'Le type de document et sa facture d''origine ne peuvent pas changer.' using errcode = '23514';
  end if;
  if new.document_type <> 'credit_note' then return new; end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then return new; end if;
  select * into v_source from public.invoices where id = new.corrects_invoice_id for share;
  if not found or v_source.organization_id <> new.organization_id
    or v_source.document_type <> 'invoice' or v_source.status not in ('issued','sent','paid') then
    raise exception 'Un avoir doit reprendre une facture émise accessible de votre entreprise.' using errcode = '23514';
  end if;
  if new.id = v_source.id then raise exception 'Un avoir ne peut pas se référencer lui-même.' using errcode = '23514'; end if;
  new.corrected_invoice_reference := v_source.reference;
  new.corrected_invoice_issued_at := v_source.issued_at;
  if new.status <> 'draft' then
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
      raise exception 'L''avoir total doit conserver le destinataire et la devise de la facture d''origine.' using errcode = '23514';
    end if;
    -- Multiset comparison: neither extra lines, altered tax nor duplicated lines can pass.
    select jsonb_agg(to_jsonb(l) order by l.description,l.unit,l.quantity,l.unit_price_cents,l.vat_rate,l.vat_category,l.vat_exemption_reason)
      into v_old_lines from (select description,unit,quantity,unit_price_cents,vat_rate,vat_category,vat_exemption_reason
        from public.invoice_items where invoice_id = v_source.id) l;
    select jsonb_agg(to_jsonb(l) order by l.description,l.unit,l.quantity,l.unit_price_cents,l.vat_rate,l.vat_category,l.vat_exemption_reason)
      into v_new_lines from (select description,unit,quantity,unit_price_cents,vat_rate,vat_category,vat_exemption_reason
        from public.invoice_items where invoice_id = new.id) l;
    if v_old_lines is null or v_new_lines is distinct from v_old_lines then
      raise exception 'L''avoir total doit reprendre exactement les lignes et la TVA de la facture d''origine.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger invoices_credit_note before insert or update on public.invoices
  for each row execute function app.enforce_full_credit_note();
revoke all on function app.enforce_full_credit_note() from public, anon, authenticated;

create function public.create_full_credit_note_draft(
  p_invoice_id uuid, p_expected_updated_at timestamptz, p_reason text
) returns public.invoices language plpgsql security invoker set search_path = '' as $$
declare v_source public.invoices; v_result public.invoices; v_count integer;
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
  select * into v_result from public.invoices where corrects_invoice_id = v_source.id and document_type = 'credit_note';
  if found then
    if v_result.status = 'draft' then return v_result; end if;
    raise exception 'Un avoir existe déjà pour cette facture.' using errcode = '23514';
  end if;
  select count(*) into v_count from public.invoice_items where invoice_id = v_source.id;
  if v_count not between 1 and 500 or not exists (
    select 1 from public.invoice_totals where invoice_id = v_source.id and total_cents > 0
  ) then raise exception 'La facture doit contenir de 1 à 500 lignes et un total positif.' using errcode = '23514'; end if;
  insert into public.invoices (
    organization_id, document_type, corrects_invoice_id, credit_note_reason, title, customer_id, site_id, site_name,
    customer_name,customer_legal_name,customer_type,customer_registration_number,customer_vat_number,
    customer_address_line1,customer_address_line2,customer_postal_code,customer_city,customer_country,
    currency,service_date,operation_type,buyer_reference,purchase_order_reference,
    delivery_address_line1,delivery_address_line2,delivery_postal_code,delivery_city,delivery_country,
    vat_on_debits,due_date,payment_terms,payment_method,early_payment_terms,late_payment_terms,created_by
  ) values (
    v_source.organization_id,'credit_note',v_source.id,btrim(p_reason),'Avoir total sur ' || v_source.reference,
    v_source.customer_id,v_source.site_id,v_source.site_name,
    v_source.customer_name,v_source.customer_legal_name,v_source.customer_type,v_source.customer_registration_number,v_source.customer_vat_number,
    v_source.customer_address_line1,v_source.customer_address_line2,v_source.customer_postal_code,v_source.customer_city,v_source.customer_country,
    v_source.currency,v_source.service_date,v_source.operation_type,v_source.buyer_reference,v_source.purchase_order_reference,
    v_source.delivery_address_line1,v_source.delivery_address_line2,v_source.delivery_postal_code,v_source.delivery_city,v_source.delivery_country,
    v_source.vat_on_debits,(now() at time zone 'UTC')::date,
    'Modalités de remboursement ou d''imputation à convenir avec le client.',null,'Sans objet.','Sans objet.',auth.uid()
  ) returning * into v_result;
  insert into public.invoice_items (invoice_id,organization_id,description,unit,quantity,unit_price_cents,vat_rate,vat_category,vat_exemption_reason,position)
    select v_result.id,v_source.organization_id,description,unit,quantity,unit_price_cents,vat_rate,vat_category,vat_exemption_reason,position
    from public.invoice_items where invoice_id = v_source.id order by position,id;
  select * into v_result from public.invoices where id = v_result.id;
  return v_result;
end;
$$;
revoke all on function public.create_full_credit_note_draft(uuid,timestamptz,text) from public, anon;
grant execute on function public.create_full_credit_note_draft(uuid,timestamptz,text) to authenticated;

create function public.save_full_credit_note_draft(
  p_invoice_id uuid,p_expected_updated_at timestamptz,p_reason text,p_due_date date,p_payment_terms text
) returns public.invoices language plpgsql security invoker set search_path = '' as $$
declare v_result public.invoices;
begin
  select * into v_result from public.invoices where id = p_invoice_id for update;
  if not found or not app.has_org_permission(v_result.organization_id,'invoice.manage')
    or not app.can_use_pro_module(v_result.organization_id,'invoicing') then
    raise exception 'Modification d''avoir non autorisée.' using errcode = '42501';
  end if;
  if v_result.status <> 'draft' or v_result.document_type <> 'credit_note' then
    raise exception 'Seul un brouillon d''avoir peut être modifié.' using errcode = '23514';
  end if;
  if v_result.updated_at is distinct from p_expected_updated_at then
    raise exception 'Ce brouillon a changé. Actualisez-le avant de le modifier.' using errcode = '40001';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 3 and 1000
    or p_due_date is null or p_payment_terms is null or length(btrim(p_payment_terms)) not between 3 and 2000 then
    raise exception 'Renseignez le motif, la date et les modalités de remboursement ou d''imputation.' using errcode = '23514';
  end if;
  update public.invoices set credit_note_reason = btrim(p_reason),due_date = p_due_date,
    payment_terms = btrim(p_payment_terms) where id = p_invoice_id returning * into v_result;
  return v_result;
end;
$$;
revoke all on function public.save_full_credit_note_draft(uuid,timestamptz,text,date,text) from public, anon;
grant execute on function public.save_full_credit_note_draft(uuid,timestamptz,text,date,text) to authenticated;

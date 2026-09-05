-- Données portées par la facture et donc protégées par son immutabilité.
alter table public.invoices
  add column service_date date,
  add column operation_type text check (operation_type in ('goods','services','mixed')),
  add column buyer_reference text,
  add column purchase_order_reference text,
  add column delivery_address_line1 text,
  add column delivery_address_line2 text,
  add column delivery_postal_code text,
  add column delivery_city text,
  add column delivery_country text,
  add column early_payment_terms text,
  add column late_payment_terms text,
  add column vat_on_debits boolean;

create or replace function public.save_invoice_draft(
  p_invoice_id uuid, p_expected_updated_at timestamptz, p_patch jsonb, p_items jsonb
) returns public.invoices language plpgsql security invoker set search_path = '' as $$
declare v_invoice public.invoices; v_patch public.invoices; v_result public.invoices;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Facture inaccessible.' using errcode = '42501'; end if;
  if not app.has_org_permission(v_invoice.organization_id, 'invoice.manage')
    or not app.can_use_pro_module(v_invoice.organization_id, 'invoicing') then
    raise exception 'Modification non autorisée.' using errcode = '42501';
  end if;
  if v_invoice.status <> 'draft' then raise exception 'Cette facture est déjà émise.' using errcode = '23001'; end if;
  if v_invoice.updated_at is distinct from p_expected_updated_at then
    raise exception 'Ce brouillon a été modifié. Actualisez la facture.' using errcode = '40001';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Brouillon invalide.' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) as k where k <> all(array[
    'title','notes','customer_name','customer_legal_name','customer_type','customer_registration_number',
    'customer_vat_number','customer_address_line1','customer_address_line2','customer_postal_code',
    'customer_city','customer_country','due_date','payment_terms','payment_method',
    'service_date','operation_type','buyer_reference','purchase_order_reference','delivery_address_line1','delivery_address_line2','delivery_postal_code','delivery_city','delivery_country','early_payment_terms','late_payment_terms','vat_on_debits'
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
    service_date = v_patch.service_date,
    operation_type = v_patch.operation_type,
    buyer_reference = v_patch.buyer_reference,
    purchase_order_reference = v_patch.purchase_order_reference,
    delivery_address_line1 = v_patch.delivery_address_line1,
    delivery_address_line2 = v_patch.delivery_address_line2,
    delivery_postal_code = v_patch.delivery_postal_code,
    delivery_city = v_patch.delivery_city,
    delivery_country = v_patch.delivery_country,
    early_payment_terms = v_patch.early_payment_terms,
    late_payment_terms = v_patch.late_payment_terms,
    vat_on_debits = v_patch.vat_on_debits,
    due_date = v_patch.due_date, payment_terms = v_patch.payment_terms, payment_method = v_patch.payment_method
  where id = p_invoice_id returning * into v_result;
  if not found then raise exception 'Modification non autorisée.' using errcode = '42501'; end if;
  delete from public.invoice_items where invoice_id = p_invoice_id;
  insert into public.invoice_items (invoice_id, organization_id, description, unit, quantity, unit_price_cents, vat_rate, vat_category, vat_exemption_reason, position)
  select p_invoice_id, v_invoice.organization_id, item->>'description', item->>'unit',
    (item->>'quantity')::numeric, (item->>'unit_price_cents')::integer, (item->>'vat_rate')::numeric,
    coalesce(item->>'vat_category', 'S'), nullif(item->>'vat_exemption_reason', ''), ordinality - 1
  from jsonb_array_elements(p_items) with ordinality as lines(item, ordinality);
  select * into v_result from public.invoices where id = p_invoice_id;
  return v_result;
end;
$$;

create or replace function app.validate_invoice_business_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' or new.status = 'draft' then return new; end if;
  if nullif(btrim(new.seller_legal_form), '') is null
    or (upper(btrim(new.seller_legal_form)) in ('SAS','SASU','SARL','EURL','SA','SNC','SCA','SCS','SCI') and new.seller_share_capital_cents is null)
    or (new.seller_country = 'FR' and regexp_replace(coalesce(new.seller_registration_number,''), '\s', '', 'g') !~ '^(\d{9}|\d{14})$') then
    raise exception 'Complétez la forme juridique, l’identifiant et le capital social applicable.' using errcode = '23514';
  end if;
  if new.service_date is null or new.operation_type is null
    or nullif(btrim(new.early_payment_terms), '') is null then
    raise exception 'Complétez la date de prestation ou livraison, la nature de l’opération et les conditions d’escompte.' using errcode = '23514';
  end if;
  if new.customer_type in ('company','public_body') and nullif(btrim(new.late_payment_terms),'') is null then
    raise exception 'Précisez les pénalités de retard applicables au client professionnel.' using errcode = '23514';
  end if;
  if (new.delivery_address_line1 is not null or new.delivery_address_line2 is not null or new.delivery_city is not null or new.delivery_postal_code is not null or new.delivery_country is not null)
    and (nullif(btrim(new.delivery_address_line1),'') is null or nullif(btrim(new.delivery_city),'') is null or nullif(btrim(new.delivery_postal_code),'') is null or nullif(btrim(new.delivery_country),'') is null) then
    raise exception 'Complétez l’adresse de livraison distincte, ou effacez-la.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger invoices_validate_business_fields before update on public.invoices
for each row execute function app.validate_invoice_business_fields();
revoke all on function app.validate_invoice_business_fields() from public, anon, authenticated;
revoke all on function public.save_invoice_draft(uuid,timestamptz,jsonb,jsonb) from public, anon;
grant execute on function public.save_invoice_draft(uuid,timestamptz,jsonb,jsonb) to authenticated;

do $$
begin
  if (select count(*) from information_schema.columns where table_schema='public' and table_name='invoices'
      and column_name in ('service_date','operation_type','buyer_reference','purchase_order_reference','delivery_address_line1','delivery_address_line2','delivery_postal_code','delivery_city','delivery_country','early_payment_terms','late_payment_terms','vat_on_debits')) <> 12 then
    raise exception 'Données d’export incomplètes après migration.';
  end if;
end;
$$;
notify pgrst, 'reload schema';

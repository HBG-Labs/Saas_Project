-- Brouillons modifiables, émission contrôlée et numérotation à l'émission.
-- Les RPC restent sous RLS ; les triggers protègent aussi les écritures directes.

create or replace function app.generate_invoice_reference()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_year integer; v_next integer; v_prefix text;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.issued_at is not null then
      raise exception 'Créez un brouillon avant d''émettre la facture.' using errcode = '23514';
    end if;
    new.reference := 'BR-' || new.id::text;
    return new;
  end if;
  if old.status <> 'draft' then
    if new.status = 'draft' then
      raise exception 'Une facture émise ne redevient pas un brouillon.' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.status = 'draft' then
    new.reference := old.reference;
    new.issued_at := null;
    return new;
  end if;
  if new.status <> 'issued' then
    raise exception 'Émettez la facture avant de modifier son statut.' using errcode = '23514';
  end if;
  new.issued_at := clock_timestamp();
  v_year := extract(year from new.issued_at at time zone 'UTC')::integer;
  v_prefix := case when new.document_type = 'credit_note' then 'AV' else 'FAC' end;
  insert into public.invoice_counters as c (organization_id, year, document_type, last_value)
  values (new.organization_id, v_year, new.document_type, 1)
  on conflict (organization_id, year, document_type)
    do update set last_value = c.last_value + 1, updated_at = now()
  returning c.last_value into v_next;
  new.reference := v_prefix || '-' || v_year::text || '-' || lpad(v_next::text, greatest(5, length(v_next::text)), '0');
  return new;
end;
$$;

drop trigger if exists invoices_generate_reference on public.invoices;
create trigger invoices_generate_reference before insert or update on public.invoices
for each row execute function app.generate_invoice_reference();

-- Chaque écriture, y compris une ligne seule, invalide la version ouverte.
create or replace function app.set_invoice_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at before update on public.invoices
for each row execute function app.set_invoice_updated_at();

create or replace function app.touch_invoice_from_item()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.invoices set updated_at = clock_timestamp()
  where id = case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end
    and status = 'draft';
  return null;
end;
$$;
create trigger invoice_items_touch_parent after insert or update or delete on public.invoice_items
for each row execute function app.touch_invoice_from_item();
revoke all on function app.set_invoice_updated_at(), app.touch_invoice_from_item() from public, anon, authenticated;

-- Lecture verrouillée du parent : une modification de ligne et une émission
-- concurrentes ne peuvent pas passer leurs contrôles sur deux états différents.
create or replace function app.enforce_invoice_item_org()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status public.invoice_status;
begin
  if tg_op = 'UPDATE' and new.invoice_id <> old.invoice_id then
    raise exception 'Une ligne ne peut pas changer de facture.' using errcode = '23514';
  end if;
  select f.organization_id, f.status into new.organization_id, v_status
    from public.invoices f where f.id = new.invoice_id for update;
  if new.organization_id is null then
    raise exception 'Facture introuvable.' using errcode = '23503';
  end if;
  if v_status <> 'draft' then
    raise exception 'Facture déjà émise : ses lignes ne peuvent plus être modifiées.' using errcode = '23001';
  end if;
  return new;
end;
$$;

create or replace function app.enforce_invoice_item_deletable()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status public.invoice_status;
begin
  select f.status into v_status from public.invoices f where f.id = old.invoice_id for update;
  if v_status is not null and v_status <> 'draft' then
    raise exception 'Facture déjà émise : ses lignes ne peuvent plus être supprimées.' using errcode = '23001';
  end if;
  return old;
end;
$$;

-- Invariants de stockage. Le détail des corrections est présenté par les règles
-- TypeScript ; ce garde-fou ne dépend pas du bouton ni de la bonne foi du client.
create or replace function app.validate_invoice_issue()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status <> 'draft' or new.status = 'draft' then return new; end if;
  if nullif(btrim(coalesce(nullif(btrim(new.seller_legal_name), ''), new.seller_name)), '') is null
    or nullif(btrim(new.seller_registration_number), '') is null
    or nullif(btrim(new.seller_address_line1), '') is null
    or nullif(btrim(new.seller_postal_code), '') is null
    or nullif(btrim(new.seller_city), '') is null
    or nullif(btrim(new.seller_country), '') is null
    or new.seller_vat_regime is null
    or (new.seller_vat_regime <> 'franchise' and nullif(btrim(new.seller_vat_number), '') is null) then
    raise exception 'Complétez les informations de votre entreprise avant l''émission.' using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(nullif(new.customer_name, ''), new.customer_legal_name)), '') is null
    or new.customer_type is null
    or nullif(btrim(new.customer_address_line1), '') is null
    or nullif(btrim(new.customer_postal_code), '') is null
    or nullif(btrim(new.customer_city), '') is null
    or nullif(btrim(new.customer_country), '') is null
    or (new.customer_type in ('company', 'public_body') and nullif(btrim(new.customer_registration_number), '') is null) then
    raise exception 'Complétez le destinataire du brouillon avant l''émission.' using errcode = '23514';
  end if;
  if new.due_date is null or nullif(btrim(new.payment_terms), '') is null then
    raise exception 'Complétez l''échéance et les conditions de règlement.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.invoice_items where invoice_id = new.id)
    or exists (select 1 from public.invoice_items where invoice_id = new.id
      and (quantity <= 0 or nullif(btrim(description), '') is null or nullif(btrim(unit), '') is null)) then
    raise exception 'Ajoutez des prestations complètes avec une quantité positive.' using errcode = '23514';
  end if;
  if new.seller_vat_regime = 'franchise' and exists (
    select 1 from public.invoice_items where invoice_id = new.id and vat_rate <> 0
  ) then
    raise exception 'La TVA doit être à zéro sous le régime de franchise en base.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger invoices_validate_emission before update on public.invoices
for each row execute function app.validate_invoice_issue();

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
    'customer_city','customer_country','due_date','payment_terms','payment_method'
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

create or replace function public.issue_invoice(p_invoice_id uuid, p_expected_updated_at timestamptz)
returns public.invoices language plpgsql security invoker set search_path = '' as $$
declare v_invoice public.invoices;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Facture inaccessible.' using errcode = '42501'; end if;
  if v_invoice.status <> 'draft' or v_invoice.updated_at is distinct from p_expected_updated_at then
    raise exception 'Cette facture a changé. Actualisez la page avant de l''émettre.' using errcode = '40001';
  end if;
  update public.invoices set status = 'issued' where id = p_invoice_id returning * into v_invoice;
  if not found then raise exception 'Émission non autorisée.' using errcode = '42501'; end if;
  return v_invoice;
end;
$$;

revoke all on function public.save_invoice_draft(uuid, timestamptz, jsonb, jsonb) from public, anon;
revoke all on function public.issue_invoice(uuid, timestamptz) from public, anon;
grant execute on function public.save_invoice_draft(uuid, timestamptz, jsonb, jsonb) to authenticated;
grant execute on function public.issue_invoice(uuid, timestamptz) to authenticated;
revoke all on function app.validate_invoice_issue() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.save_invoice_draft(uuid,timestamptz,jsonb,jsonb)') is null
    or to_regprocedure('public.issue_invoice(uuid,timestamptz)') is null then
    raise exception 'Les fonctions du parcours de facturation sont absentes.';
  end if;
  if (select count(*) from pg_trigger where not tgisinternal
      and (tgrelid = 'public.invoices'::regclass and tgname in ('invoices_generate_reference', 'invoices_validate_emission', 'invoices_set_updated_at')
        or tgrelid = 'public.invoice_items'::regclass and tgname = 'invoice_items_touch_parent')) <> 4 then
    raise exception 'Un garde-fou du parcours de facturation est absent.';
  end if;
end;
$$;

notify pgrst, 'reload schema';

-- Durcissement pre-lancement : permissions, documents commerciaux et
-- operations qui doivent etre atomiques.
--
-- Cette migration est volontairement additive. Les migrations historiques
-- restent immuables conformement aux regles du depot.

-- =============================================================================
-- 1. Une invitation reactive le membre avec LE ROLE DE L'INVITATION
-- =============================================================================

create or replace function public.accept_organization_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.organization_invitations;
  v_user_id    uuid := (select auth.uid());
  v_email      text := lower((select auth.jwt() ->> 'email'));
begin
  if v_user_id is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invitation
  from public.organization_invitations
  where token = p_token and status = 'pending'
  for update;

  if not found then
    raise exception 'Invitation introuvable ou deja utilisee.' using errcode = 'no_data_found';
  end if;

  if v_invitation.expires_at < now() then
    update public.organization_invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'Cette invitation a expire.' using errcode = 'check_violation';
  end if;

  if lower(v_invitation.email) <> v_email then
    raise exception 'Cette invitation ne correspond pas a votre adresse e-mail.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.organization_members
    (organization_id, user_id, role, status, invited_by, joined_at)
  values
    (v_invitation.organization_id, v_user_id, v_invitation.role, 'active',
     v_invitation.invited_by, now())
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        invited_by = excluded.invited_by,
        joined_at = coalesce(public.organization_members.joined_at, now());

  update public.organization_invitations
  set status = 'accepted', accepted_at = now()
  where id = v_invitation.id;

  return v_invitation.organization_id;
end;
$$;

revoke all on function public.accept_organization_invitation(uuid) from public, anon;
grant execute on function public.accept_organization_invitation(uuid) to authenticated;

-- =============================================================================
-- 2. Un devis transmis est un document commercial fige
-- =============================================================================

create or replace function app.enforce_quote_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_payload jsonb;
  v_new_payload jsonb;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Un devis transmis ne peut plus etre supprime.'
        using errcode = 'restrict_violation';
    end if;
    return old;
  end if;

  if old.status = 'draft' then
    if new.status not in ('draft', 'sent') then
      raise exception 'Un devis doit etre envoye avant d etre accepte, refuse ou expire.'
        using errcode = 'check_violation';
    end if;
    if new.status = 'sent' then
      -- Le générateur PDF a rendu OLD puis effectue uniquement cette transition
      -- avec un verrou optimiste. Interdire un changement de contenu dans la
      -- même requête garantit que le PDF conservé décrit exactement la ligne
      -- contractuelle qui vient d'être figée.
      v_old_payload := to_jsonb(old) - array['status', 'sent_at', 'updated_at'];
      v_new_payload := to_jsonb(new) - array['status', 'sent_at', 'updated_at'];
      if v_old_payload is distinct from v_new_payload then
        raise exception 'Envoyez le devis sans modifier son contenu dans la meme operation.'
          using errcode = 'restrict_violation';
      end if;
    end if;
    return new;
  end if;

  -- Apres l'envoi, seuls le cycle de reponse et le reglage des relances
  -- peuvent evoluer. L'identite, les montants et les options du document sont
  -- contractuels et restent figes.
  v_old_payload := to_jsonb(old) - array[
    'status', 'client_responded_at', 'reminders_enabled', 'sent_at', 'updated_at'
  ];
  v_new_payload := to_jsonb(new) - array[
    'status', 'client_responded_at', 'reminders_enabled', 'sent_at', 'updated_at'
  ];

  if v_old_payload is distinct from v_new_payload then
    raise exception 'Ce devis a deja ete transmis : son contenu est fige.'
      using errcode = 'restrict_violation';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'sent' or new.status not in ('accepted', 'refused', 'expired') then
      raise exception 'Transition de statut du devis interdite.'
        using errcode = 'check_violation';
    end if;
  end if;

  if old.status <> 'sent' and new.reminders_enabled is distinct from old.reminders_enabled then
    raise exception 'Les relances ne peuvent etre modifiees que sur un devis envoye.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function app.enforce_quote_lifecycle() from public, anon, authenticated;

drop trigger if exists quotes_lifecycle_guard on public.quotes;
create trigger quotes_lifecycle_guard
  before update or delete on public.quotes
  for each row execute function app.enforce_quote_lifecycle();

create or replace function app.enforce_quote_item_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_status public.quote_status;
  v_new_status public.quote_status;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select q.status into v_old_status from public.quotes q where q.id = old.quote_id;
    if v_old_status is not null and v_old_status <> 'draft' then
      raise exception 'Les lignes d un devis transmis sont figees.'
        using errcode = 'restrict_violation';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select q.status into v_new_status from public.quotes q where q.id = new.quote_id;
    if v_new_status is null then
      raise exception 'Devis introuvable.' using errcode = 'foreign_key_violation';
    end if;
    if v_new_status <> 'draft' then
      raise exception 'Les lignes d un devis transmis sont figees.'
        using errcode = 'restrict_violation';
    end if;
    return new;
  end if;

  return old;
end;
$$;

revoke all on function app.enforce_quote_item_draft() from public, anon, authenticated;

drop trigger if exists quote_items_draft_guard on public.quote_items;
create trigger quote_items_draft_guard
  before insert or update or delete on public.quote_items
  for each row execute function app.enforce_quote_item_draft();

-- Une conversion commerciale ne produit qu'une facture active. L'index fait
-- aussi office de dernier verrou contre deux onglets ou deux utilisateurs.
create unique index if not exists invoices_one_active_per_quote_idx
  on public.invoices (quote_id)
  where quote_id is not null
    and document_type = 'invoice'
    and status <> 'cancelled';

-- =============================================================================
-- 3. Creation atomique devis + lignes
-- =============================================================================

create or replace function public.create_quote_draft(
  p_organization_id uuid,
  p_payload jsonb,
  p_items jsonb
)
returns public.quotes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quote public.quotes;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) > 500 then
    raise exception 'Brouillon de devis invalide.' using errcode = '23514';
  end if;
  if p_payload ? 'document_options'
     and jsonb_typeof(p_payload->'document_options') not in ('object', 'null') then
    raise exception 'Options du devis invalides.' using errcode = '23514';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) as lines(item)
    where jsonb_typeof(item) is distinct from 'object'
       or nullif(btrim(item->>'description'), '') is null
       or nullif(item->>'quantity', '') is null
       or nullif(item->>'unit_price_cents', '') is null
  ) then
    raise exception 'Une ligne du devis est invalide.' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_payload) as key
    where key <> all(array[
      'title','customer_id','site_id','customer_name','site_name','vat_rate',
      'discount_rate','document_options','notes','issue_date','valid_until'
    ])
  ) then
    raise exception 'Champs du devis invalides.' using errcode = '23514';
  end if;

  insert into public.quotes (
    organization_id, title, customer_id, site_id, customer_name, site_name,
    vat_rate, discount_rate, document_options, notes, issue_date, valid_until,
    created_by
  ) values (
    p_organization_id,
    nullif(p_payload->>'title', ''),
    nullif(p_payload->>'customer_id', '')::uuid,
    nullif(p_payload->>'site_id', '')::uuid,
    nullif(p_payload->>'customer_name', ''),
    nullif(p_payload->>'site_name', ''),
    coalesce((p_payload->>'vat_rate')::numeric, 20),
    coalesce((p_payload->>'discount_rate')::numeric, 0),
    case
      when jsonb_typeof(p_payload->'document_options') = 'object'
        then p_payload->'document_options'
      else '{}'::jsonb
    end,
    nullif(p_payload->>'notes', ''),
    coalesce(nullif(p_payload->>'issue_date', '')::date, current_date),
    nullif(p_payload->>'valid_until', '')::date,
    (select auth.uid())
  ) returning * into v_quote;

  insert into public.quote_items (
    quote_id, organization_id, description, unit, quantity,
    unit_price_cents, position
  )
  select
    v_quote.id,
    p_organization_id,
    item->>'description',
    item->>'unit',
    (item->>'quantity')::numeric,
    (item->>'unit_price_cents')::integer,
    ordinality - 1
  from jsonb_array_elements(p_items) with ordinality as lines(item, ordinality);

  return v_quote;
end;
$$;

revoke all on function public.create_quote_draft(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.create_quote_draft(uuid, jsonb, jsonb) to authenticated;

-- =============================================================================
-- 4. Creation atomique facture + lignes
-- =============================================================================

create or replace function public.create_invoice_draft(
  p_organization_id uuid,
  p_payload jsonb,
  p_items jsonb
)
returns public.invoices
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_quote public.quotes;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) > 500 then
    raise exception 'Brouillon de facture invalide.' using errcode = '23514';
  end if;
  if p_payload ? 'document_options'
     and jsonb_typeof(p_payload->'document_options') not in ('object', 'null') then
    raise exception 'Options de la facture invalides.' using errcode = '23514';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) as lines(item)
    where jsonb_typeof(item) is distinct from 'object'
       or nullif(btrim(item->>'description'), '') is null
       or nullif(item->>'quantity', '') is null
       or nullif(item->>'unit_price_cents', '') is null
       or nullif(item->>'vat_rate', '') is null
  ) then
    raise exception 'Une ligne de la facture est invalide.' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_payload) as key
    where key <> all(array[
      'title','customer_id','site_id','quote_id','customer_name','customer_legal_name',
      'customer_registration_number','customer_vat_number','customer_address_line1',
      'customer_address_line2','customer_postal_code','customer_city','customer_country',
      'customer_type','site_name','due_date','payment_terms','payment_method','operation_type',
      'early_payment_terms','late_payment_terms','vat_on_debits','service_date','buyer_reference',
      'purchase_order_reference','delivery_address_line1','delivery_address_line2',
      'delivery_postal_code','delivery_city','delivery_country','notes','document_options',
      'discount_rate'
    ])
  ) then
    raise exception 'Champs de la facture invalides.' using errcode = '23514';
  end if;

  if nullif(p_payload->>'quote_id', '') is not null then
    select * into v_quote
    from public.quotes q
    where q.id = (p_payload->>'quote_id')::uuid
    for share;
    if not found or v_quote.organization_id <> p_organization_id then
      raise exception 'Devis inaccessible.' using errcode = '42501';
    end if;
    if v_quote.status <> 'accepted' then
      raise exception 'Seul un devis accepte peut etre facture.' using errcode = '23514';
    end if;
  end if;

  insert into public.invoices (
    organization_id, title, customer_id, site_id, quote_id,
    customer_name, customer_legal_name, customer_registration_number,
    customer_vat_number, customer_address_line1, customer_address_line2,
    customer_postal_code, customer_city, customer_country, customer_type,
    site_name, due_date, payment_terms, payment_method, operation_type,
    early_payment_terms, late_payment_terms, vat_on_debits, service_date,
    buyer_reference, purchase_order_reference, delivery_address_line1,
    delivery_address_line2, delivery_postal_code, delivery_city,
    delivery_country, notes, document_options, discount_rate, created_by
  ) values (
    p_organization_id,
    nullif(p_payload->>'title', ''),
    nullif(p_payload->>'customer_id', '')::uuid,
    nullif(p_payload->>'site_id', '')::uuid,
    nullif(p_payload->>'quote_id', '')::uuid,
    nullif(p_payload->>'customer_name', ''),
    nullif(p_payload->>'customer_legal_name', ''),
    nullif(p_payload->>'customer_registration_number', ''),
    nullif(p_payload->>'customer_vat_number', ''),
    nullif(p_payload->>'customer_address_line1', ''),
    nullif(p_payload->>'customer_address_line2', ''),
    nullif(p_payload->>'customer_postal_code', ''),
    nullif(p_payload->>'customer_city', ''),
    nullif(p_payload->>'customer_country', ''),
    nullif(p_payload->>'customer_type', '')::public.customer_type,
    nullif(p_payload->>'site_name', ''),
    nullif(p_payload->>'due_date', '')::date,
    nullif(p_payload->>'payment_terms', ''),
    nullif(p_payload->>'payment_method', ''),
    nullif(p_payload->>'operation_type', ''),
    nullif(p_payload->>'early_payment_terms', ''),
    nullif(p_payload->>'late_payment_terms', ''),
    case when p_payload ? 'vat_on_debits' then (p_payload->>'vat_on_debits')::boolean else null end,
    nullif(p_payload->>'service_date', '')::date,
    nullif(p_payload->>'buyer_reference', ''),
    nullif(p_payload->>'purchase_order_reference', ''),
    nullif(p_payload->>'delivery_address_line1', ''),
    nullif(p_payload->>'delivery_address_line2', ''),
    nullif(p_payload->>'delivery_postal_code', ''),
    nullif(p_payload->>'delivery_city', ''),
    nullif(p_payload->>'delivery_country', ''),
    nullif(p_payload->>'notes', ''),
    case
      when jsonb_typeof(p_payload->'document_options') = 'object'
        then p_payload->'document_options'
      else '{}'::jsonb
    end,
    coalesce((p_payload->>'discount_rate')::numeric, 0),
    (select auth.uid())
  ) returning * into v_invoice;

  insert into public.invoice_items (
    invoice_id, organization_id, description, unit, quantity,
    unit_price_cents, vat_rate, vat_category, vat_exemption_reason, position
  )
  select
    v_invoice.id,
    p_organization_id,
    item->>'description',
    item->>'unit',
    (item->>'quantity')::numeric,
    (item->>'unit_price_cents')::integer,
    (item->>'vat_rate')::numeric,
    coalesce(nullif(item->>'vat_category', ''), 'S'),
    nullif(item->>'vat_exemption_reason', ''),
    ordinality - 1
  from jsonb_array_elements(p_items) with ordinality as lines(item, ordinality);

  return v_invoice;
end;
$$;

revoke all on function public.create_invoice_draft(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.create_invoice_draft(uuid, jsonb, jsonb) to authenticated;

-- =============================================================================
-- 5. Clients, contacts et fin d'intervention atomiques
-- =============================================================================

create or replace function public.create_customer_with_primary_site(
  p_organization_id uuid,
  p_customer jsonb,
  p_site jsonb default null
)
returns public.customers
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_customer public.customers;
begin
  if jsonb_typeof(p_customer) is distinct from 'object'
     or (p_site is not null and jsonb_typeof(p_site) is distinct from 'object') then
    raise exception 'Client invalide.' using errcode = '23514';
  end if;

  insert into public.customers (
    organization_id, name, legal_name, registration_number, vat_number,
    customer_type, email, phone, address_line1, address_line2, postal_code,
    city, country, notes, created_by
  ) values (
    p_organization_id,
    p_customer->>'name',
    nullif(p_customer->>'legal_name', ''),
    nullif(p_customer->>'registration_number', ''),
    nullif(p_customer->>'vat_number', ''),
    nullif(p_customer->>'customer_type', '')::public.customer_type,
    nullif(p_customer->>'email', ''),
    nullif(p_customer->>'phone', ''),
    nullif(p_customer->>'address_line1', ''),
    nullif(p_customer->>'address_line2', ''),
    nullif(p_customer->>'postal_code', ''),
    nullif(p_customer->>'city', ''),
    nullif(p_customer->>'country', ''),
    nullif(p_customer->>'notes', ''),
    (select auth.uid())
  ) returning * into v_customer;

  if p_site is not null then
    insert into public.sites (
      customer_id, organization_id, name, address_line1, address_line2,
      postal_code, city, country, latitude, longitude
    ) values (
      v_customer.id,
      p_organization_id,
      coalesce(nullif(p_site->>'name', ''), 'Site principal'),
      nullif(p_site->>'address_line1', ''),
      nullif(p_site->>'address_line2', ''),
      nullif(p_site->>'postal_code', ''),
      nullif(p_site->>'city', ''),
      nullif(p_site->>'country', ''),
      nullif(p_site->>'latitude', '')::numeric,
      nullif(p_site->>'longitude', '')::numeric
    );
  end if;

  return v_customer;
end;
$$;

revoke all on function public.create_customer_with_primary_site(uuid, jsonb, jsonb)
  from public, anon;
grant execute on function public.create_customer_with_primary_site(uuid, jsonb, jsonb)
  to authenticated;

create or replace function public.set_primary_customer_contact(
  p_customer_id uuid,
  p_contact_id uuid
)
returns public.customer_contacts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contact public.customer_contacts;
begin
  perform 1 from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'Client inaccessible.' using errcode = '42501';
  end if;

  select * into v_contact
  from public.customer_contacts
  where id = p_contact_id and customer_id = p_customer_id
  for update;
  if not found then
    raise exception 'Contact inaccessible.' using errcode = '42501';
  end if;

  update public.customer_contacts
  set is_primary = false
  where customer_id = p_customer_id and is_primary;

  update public.customer_contacts
  set is_primary = true
  where id = p_contact_id
  returning * into v_contact;

  return v_contact;
end;
$$;

revoke all on function public.set_primary_customer_contact(uuid, uuid) from public, anon;
grant execute on function public.set_primary_customer_contact(uuid, uuid) to authenticated;

create or replace function public.complete_intervention_atomic(
  p_intervention_id uuid,
  p_notes text default null
)
returns public.interventions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_intervention public.interventions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_intervention_id::text, 0));

  select * into v_intervention
  from public.interventions
  where id = p_intervention_id
  for update;
  if not found then
    raise exception 'Intervention inaccessible.' using errcode = '42501';
  end if;

  if v_intervention.status = 'completed' then
    return v_intervention;
  end if;

  update public.intervention_time_entries
  set ended_at = clock_timestamp()
  where intervention_id = p_intervention_id and ended_at is null;

  update public.interventions
  set status = 'completed',
      notes = coalesce(p_notes, notes)
  where id = p_intervention_id
  returning * into v_intervention;

  return v_intervention;
end;
$$;

revoke all on function public.complete_intervention_atomic(uuid, text) from public, anon;
grant execute on function public.complete_intervention_atomic(uuid, text) to authenticated;

create or replace function public.append_mission_note(
  p_mission_id uuid,
  p_note text
)
returns public.missions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mission public.missions;
begin
  if length(trim(coalesce(p_note, ''))) = 0 or length(p_note) > 20000 then
    raise exception 'Note technique invalide.' using errcode = '23514';
  end if;

  update public.missions
  set notes = case
    when nullif(trim(notes), '') is null then trim(p_note)
    else notes || E'\n\n' || trim(p_note)
  end
  where id = p_mission_id
  returning * into v_mission;

  if not found then
    raise exception 'Mission inaccessible.' using errcode = '42501';
  end if;
  return v_mission;
end;
$$;

revoke all on function public.append_mission_note(uuid, text) from public, anon;
grant execute on function public.append_mission_note(uuid, text) to authenticated;

-- =============================================================================
-- 6. Portail : reservation atomique du quota de codes
-- =============================================================================

create or replace function public.claim_portal_code_request(
  p_contact_id uuid,
  p_organization_id uuid,
  p_window_seconds integer default 900,
  p_max_requests integer default 3
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_window_seconds not between 60 and 86400
     or p_max_requests not between 1 and 20 then
    raise exception 'Parametres de quota invalides.' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_contact_id::text, 0));

  if not exists (
    select 1 from public.customer_contacts c
    where c.id = p_contact_id and c.organization_id = p_organization_id
  ) then
    return false;
  end if;

  select count(*) into v_count
  from public.audit_logs a
  where a.entity_type = 'customer_contact'
    and a.entity_id = p_contact_id
    and a.action = 'portal.code_requested'
    and a.created_at >= now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max_requests then
    return false;
  end if;

  insert into public.audit_logs (
    organization_id, user_id, actor_label, action, entity_type, entity_id, metadata
  ) values (
    p_organization_id, null, 'portail client', 'portal.code_requested',
    'customer_contact', p_contact_id, '{}'::jsonb
  );

  return true;
end;
$$;

revoke all on function public.claim_portal_code_request(uuid, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_portal_code_request(uuid, uuid, integer, integer)
  to service_role;

-- =============================================================================
-- 7. IA : remplacement des fragments et etat ready dans UNE transaction
-- =============================================================================

create or replace function public.replace_ai_document_chunks(
  p_document_id uuid,
  p_chunks jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.ai_documents;
  v_count integer;
begin
  if jsonb_typeof(p_chunks) is distinct from 'array'
     or jsonb_array_length(p_chunks) > 2000 then
    raise exception 'Fragments invalides.' using errcode = '23514';
  end if;

  select * into v_document
  from public.ai_documents
  where id = p_document_id
  for update;
  if not found then
    raise exception 'Document introuvable.' using errcode = 'P0002';
  end if;
  if v_document.status <> 'processing' then
    raise exception 'Le document n est pas en cours d indexation.' using errcode = '55000';
  end if;

  delete from public.ai_document_chunks where document_id = p_document_id;

  insert into public.ai_document_chunks (
    document_id, organization_id, content, chunk_index, embedding, metadata
  )
  select
    p_document_id,
    v_document.organization_id,
    chunk->>'content',
    (chunk->>'chunk_index')::integer,
    (chunk->>'embedding')::extensions.vector,
    coalesce(chunk->'metadata', '{}'::jsonb)
  from jsonb_array_elements(p_chunks) as rows(chunk);

  get diagnostics v_count = row_count;

  update public.ai_documents
  set status = 'ready', error_message = null
  where id = p_document_id;

  return v_count;
end;
$$;

revoke all on function public.replace_ai_document_chunks(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_ai_document_chunks(uuid, jsonb)
  to service_role;

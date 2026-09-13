-- =============================================================================
-- Portail client — lecture par fonctions, colonnes choisies
-- =============================================================================
--
-- POURQUOI DES FONCTIONS ET NON DES POLICIES SUR LES TABLES DU CŒUR
--
-- Une policy raisonne par ligne, jamais par colonne (ARCHITECTURE.md). Ouvrir
-- `missions` à un contact par une policy exposerait `notes`, `customer_phone`,
-- le technicien affecté — tout ce que le client n'a pas à voir. Et ajouter une
-- policy permissive à une table qui protège aujourd'hui de vrais clients
-- élargit l'accès de tout le monde d'un cran.
--
-- Chaque fonction ci-dessous est `security definer`, commence par exiger un
-- contact portail authentifié, filtre sur SES clients, applique la règle de
-- visibilité de la donnée, et ÉNUMÈRE ses colonnes. Aucun `select *`.
--
-- CE QUE LE CLIENT VOIT, ET CE QU'IL NE VOIT JAMAIS
--
--   missions       tout sauf `draft` (pas encore décidé) et `rejected`
--                  (état interne de relecture du compte rendu)
--   comptes rendus `approved` uniquement — c'est le rapport validé qu'il signe
--   devis          hors `draft`
--   factures       hors `draft`
--   photos         `shared_with_client` uniquement, une par une ou en lot
--   documents      partagés un à un, ou d'une catégorie ouverte par l'entreprise
--
-- Décisions de l'exploitant du 13/09/2026, reprises telles quelles.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Correctif du socle : le privilège que la policy de partage attendait
-- -----------------------------------------------------------------------------
--
-- `20260913054246_portail_client_socle.sql` a posé la policy
-- `intervention_attachments_update_share` sans le `grant update` qui la rend
-- opérante : une policy filtre ce qu'un privilège autorise, elle n'en tient
-- pas lieu. Trouvé par la suite 08 avant l'application de ce fichier. La
-- migration d'origine est appliquée, donc immuable : le grant vit ici.

grant update on public.intervention_attachments to authenticated;

-- -----------------------------------------------------------------------------
-- Garde commune
-- -----------------------------------------------------------------------------

create or replace function app.assert_portal_contact()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_portal_contact() then
    raise exception 'Accès réservé aux contacts du portail.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function app.assert_portal_contact() from public, anon;
grant execute on function app.assert_portal_contact() to authenticated;

-- -----------------------------------------------------------------------------
-- Contexte : qui suis-je, chez qui, avec quels modules
-- -----------------------------------------------------------------------------

create or replace function public.portal_my_context()
returns table (
  organization_id        uuid,
  organization_name      text,
  contact_id             uuid,
  contact_first_name     text,
  contact_last_name      text,
  contact_email          text,
  customer_id            uuid,
  customer_name          text,
  allow_client_initiated boolean,
  -- Les modules réellement actifs pour cette organisation : le portail
  -- n'affiche pas un bloc « Factures » à un client d'entreprise qui n'a pas
  -- le module. Le frontend ne décide de rien ; il lit.
  features               jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.organization_id,
    coalesce(nullif(s.display_name, ''), o.name),
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    c.customer_id,
    cu.name,
    s.allow_client_initiated,
    jsonb_build_object(
      'missions',      app.org_has_feature(c.organization_id, 'missions'),
      'interventions', app.org_has_feature(c.organization_id, 'interventions'),
      'quotes',        app.org_has_feature(c.organization_id, 'quotes'),
      'invoicing',     app.org_has_feature(c.organization_id, 'invoicing'),
      'documents',     app.org_has_feature(c.organization_id, 'documents')
    )
  from public.customer_contacts c
  join public.customers cu on cu.id = c.customer_id
  join public.organizations o on o.id = c.organization_id
  join public.client_portal_settings s on s.organization_id = c.organization_id
  where c.id in (select app.my_portal_contact_ids())
  order by o.name;
$$;

revoke all on function public.portal_my_context() from public, anon;
grant execute on function public.portal_my_context() to authenticated;

-- Marque le passage et le journalise. Appelée à l'ouverture du portail.
create or replace function public.portal_touch_last_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare r record;
begin
  perform app.assert_portal_contact();
  for r in
    update public.customer_contacts
       set portal_last_seen_at = now()
     where id in (select app.my_portal_contact_ids())
    returning organization_id, id
  loop
    perform app.write_audit_log(r.organization_id, 'portal.access', 'customer_contact', r.id, '{}'::jsonb);
  end loop;
end;
$$;

revoke all on function public.portal_touch_last_seen() from public, anon;
grant execute on function public.portal_touch_last_seen() to authenticated;

-- -----------------------------------------------------------------------------
-- Interventions (missions, dans le vocabulaire du cœur)
-- -----------------------------------------------------------------------------

create or replace function public.portal_list_missions()
returns table (
  id                        uuid,
  organization_id           uuid,
  reference                 text,
  title                     text,
  status                    text,
  priority                  text,
  scheduled_start           timestamptz,
  scheduled_end             timestamptz,
  actual_start              timestamptz,
  actual_end                timestamptz,
  location_label            text,
  address_line1             text,
  postal_code               text,
  city                      text,
  site_name                 text,
  has_approved_report       boolean,
  shared_attachments_count  integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id, m.organization_id, m.reference, m.title, m.status::text, m.priority::text,
    m.scheduled_start, m.scheduled_end, m.actual_start, m.actual_end,
    m.location_label, m.address_line1, m.postal_code, m.city,
    st.name,
    exists (
      select 1 from public.interventions i
      join public.intervention_reports r on r.intervention_id = i.id
      where i.mission_id = m.id and r.status = 'approved'
    ),
    (
      select count(*)::integer from public.interventions i
      join public.intervention_attachments a on a.intervention_id = i.id
      where i.mission_id = m.id and a.shared_with_client
    )
  from public.missions m
  left join public.sites st on st.id = m.site_id
  where app.is_portal_contact()
    and m.customer_id in (select app.portal_customer_ids())
    and m.status not in ('draft', 'rejected')
  order by coalesce(m.scheduled_start, m.created_at) desc;
$$;

revoke all on function public.portal_list_missions() from public, anon;
grant execute on function public.portal_list_missions() to authenticated;

-- Le détail est un document : une mission, ses passages, son compte rendu
-- s'il est validé, ses photos si elles sont partagées. Renvoie NULL — jamais
-- une erreur qui dirait « existe mais interdit » — quand la mission n'est pas
-- visible du contact.
create or replace function public.portal_mission_detail(p_mission_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'organization_id', m.organization_id,
    'reference', m.reference,
    'title', m.title,
    'description', m.description,
    'status', m.status::text,
    'priority', m.priority::text,
    'scheduled_start', m.scheduled_start,
    'scheduled_end', m.scheduled_end,
    'actual_start', m.actual_start,
    'actual_end', m.actual_end,
    'location_label', m.location_label,
    'address_line1', m.address_line1,
    'address_line2', m.address_line2,
    'postal_code', m.postal_code,
    'city', m.city,
    'site_name', st.name,
    'interventions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'status', i.status::text, 'start_time', i.start_time, 'end_time', i.end_time
      ) order by i.start_time nulls last)
      from public.interventions i where i.mission_id = m.id
    ), '[]'::jsonb),
    'report', (
      select jsonb_build_object(
        'work_description', r.work_description,
        'materials_used', r.materials_used,
        'submitted_at', r.submitted_at,
        'customer_signature_name', r.customer_signature_name
      )
      from public.interventions i
      join public.intervention_reports r on r.intervention_id = i.id
      where i.mission_id = m.id and r.status = 'approved'
      order by r.reviewed_at desc nulls last
      limit 1
    ),
    'attachments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'kind', a.kind::text, 'file_name', a.file_name, 'mime_type', a.mime_type,
        'size_bytes', a.size_bytes, 'caption', a.caption, 'storage_path', a.storage_path,
        'created_at', a.created_at
      ) order by a.created_at)
      from public.interventions i
      join public.intervention_attachments a on a.intervention_id = i.id
      where i.mission_id = m.id and a.shared_with_client
    ), '[]'::jsonb)
  )
  from public.missions m
  left join public.sites st on st.id = m.site_id
  where app.is_portal_contact()
    and m.id = p_mission_id
    and m.customer_id in (select app.portal_customer_ids())
    and m.status not in ('draft', 'rejected');
$$;

revoke all on function public.portal_mission_detail(uuid) from public, anon;
grant execute on function public.portal_mission_detail(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Devis et factures
-- -----------------------------------------------------------------------------

create or replace function public.portal_list_quotes()
returns table (
  id               uuid,
  organization_id  uuid,
  reference        text,
  title            text,
  status           text,
  valid_until      date,
  created_at       timestamptz,
  subtotal_cents   bigint,
  vat_cents        bigint,
  total_cents      bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.organization_id, q.reference, q.title, q.status::text, q.valid_until, q.created_at,
         t.subtotal_cents, t.vat_cents, t.total_cents
  from public.quotes q
  left join public.quote_totals t on t.quote_id = q.id
  where app.is_portal_contact()
    and app.org_has_feature(q.organization_id, 'quotes')
    and q.customer_id in (select app.portal_customer_ids())
    and q.status <> 'draft'
  order by q.created_at desc;
$$;

revoke all on function public.portal_list_quotes() from public, anon;
grant execute on function public.portal_list_quotes() to authenticated;

create or replace function public.portal_list_invoices()
returns table (
  id               uuid,
  organization_id  uuid,
  reference        text,
  document_type    text,
  title            text,
  status           text,
  issued_at        date,
  due_date         date,
  subtotal_cents   bigint,
  vat_cents        bigint,
  total_cents      bigint,
  pdf_path         text
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.organization_id, i.reference, i.document_type::text, i.title, i.status::text,
         i.issued_at, i.due_date, t.subtotal_cents, t.vat_cents, t.total_cents, d.object_path
  from public.invoices i
  left join public.invoice_totals t on t.invoice_id = i.id
  left join public.invoice_electronic_documents d on d.invoice_id = i.id
  where app.is_portal_contact()
    and app.org_has_feature(i.organization_id, 'invoicing')
    and i.customer_id in (select app.portal_customer_ids())
    and i.status <> 'draft'
  order by coalesce(i.issued_at, i.created_at::date) desc, i.created_at desc;
$$;

revoke all on function public.portal_list_invoices() from public, anon;
grant execute on function public.portal_list_invoices() to authenticated;

-- -----------------------------------------------------------------------------
-- Documents de l'entreprise
-- -----------------------------------------------------------------------------

create or replace function public.portal_list_documents()
returns table (
  id               uuid,
  organization_id  uuid,
  name             text,
  category         text,
  mime_type        text,
  file_size        bigint,
  storage_path     text,
  created_at       timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.organization_id, d.name, d.category, d.mime_type, d.file_size, d.storage_path, d.created_at
  from public.organization_documents d
  join public.client_portal_settings s on s.organization_id = d.organization_id
  where app.is_portal_contact()
    and app.org_has_feature(d.organization_id, 'documents')
    and d.organization_id in (
      select c.organization_id from public.customer_contacts c
      where c.id in (select app.my_portal_contact_ids())
    )
    and (d.shared_with_client or d.category = any (s.visible_document_categories))
  order by d.created_at desc;
$$;

revoke all on function public.portal_list_documents() from public, anon;
grant execute on function public.portal_list_documents() to authenticated;

-- -----------------------------------------------------------------------------
-- Autorisation de téléchargement — vérifiée AVANT toute URL signée
-- -----------------------------------------------------------------------------
--
-- Le bucket reste privé. La fonction de bord demande ici, sous l'identité du
-- contact, si ce chemin lui est ouvert ; elle ne signe qu'après un `true`.
-- Chaque bucket a sa règle, et une règle absente vaut refus.

create or replace function public.portal_can_read_file(p_bucket text, p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_portal_contact() and case p_bucket
    when 'intervention-attachments' then exists (
      select 1 from public.intervention_attachments a
      join public.interventions i on i.id = a.intervention_id
      join public.missions m on m.id = i.mission_id
      where a.storage_path = p_path
        and a.shared_with_client
        and m.customer_id in (select app.portal_customer_ids())
        and m.status not in ('draft', 'rejected')
    )
    when 'organization-documents' then exists (
      select 1 from public.portal_list_documents() d where d.storage_path = p_path
    )
    when 'invoice-electronic-documents' then exists (
      select 1 from public.portal_list_invoices() i where i.pdf_path = p_path
    )
    when 'client-message-attachments' then exists (
      select 1 from public.client_message_attachments a
      join public.client_messages m on m.id = a.message_id
      join public.client_conversations c on c.id = m.conversation_id
      where a.storage_path = p_path
        and c.contact_id in (select app.my_portal_contact_ids())
    )
    else false
  end;
$$;

revoke all on function public.portal_can_read_file(text, text) from public, anon;
grant execute on function public.portal_can_read_file(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Contrôles
-- -----------------------------------------------------------------------------

do $$
begin
  -- Sans session, chaque fonction doit se taire, pas se tromper.
  if exists (select 1 from public.portal_my_context())
     or exists (select 1 from public.portal_list_missions())
     or exists (select 1 from public.portal_list_quotes())
     or exists (select 1 from public.portal_list_invoices())
     or exists (select 1 from public.portal_list_documents()) then
    raise exception 'Une fonction du portail renvoie des lignes hors de toute session.';
  end if;
  if public.portal_can_read_file('intervention-attachments', 'x') then
    raise exception 'portal_can_read_file autorise hors session.';
  end if;
  if public.portal_mission_detail(gen_random_uuid()) is not null then
    raise exception 'portal_mission_detail renvoie un document hors session.';
  end if;
end
$$;

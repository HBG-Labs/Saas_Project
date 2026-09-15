-- =============================================================================
-- PDF du devis, consultable et téléchargeable depuis le portail client
-- =============================================================================
--
-- Même patron que `invoice_electronic_documents` (`20260904025716`), en plus
-- simple : un devis n'a aucune contrainte réglementaire (pas de Factur-X, pas
-- de PDF/A3, pas de XML embarqué). Une page pdfkit ordinaire suffit.
--
-- GÉNÉRÉ QUAND, ET PAR QUI
--
-- À l'envoi au client (bouton « Envoyer au client » / « Marquer comme
-- envoyé »), le navigateur appelle `generate-quote-pdf` avec le jeton de
-- l'appelant — même geste que `ensureFacturX` pour les factures. Le document
-- est ensuite IMMUABLE : un devis accepté ou refusé reste ce que le client a
-- vu, quoi que devienne le devis ensuite.
-- =============================================================================

create table public.quote_documents (
  quote_id         uuid primary key references public.quotes(id) on delete restrict,
  organization_id  uuid not null references public.organizations(id) on delete restrict,
  generator_version text not null check (length(generator_version) between 1 and 80),
  object_path      text not null unique,
  pdf_sha256       text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size        integer not null check (byte_size between 1 and 5000000),
  generated_at     timestamptz not null default now(),
  check (object_path = organization_id::text || '/' || quote_id::text || '/devis.pdf')
);

create index quote_documents_organization_idx on public.quote_documents(organization_id);

alter table public.quote_documents enable row level security;
revoke all on public.quote_documents from public, anon, authenticated, service_role;
grant select on public.quote_documents to authenticated;
grant select, insert on public.quote_documents to service_role;

create policy quote_documents_select
  on public.quote_documents for select to authenticated
  using (exists (
    select 1 from public.quotes q where q.id = quote_id and q.organization_id = quote_documents.organization_id
  ));

create function app.guard_quote_document() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Un document de devis conservé ne peut être remplacé ou supprimé.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.quotes q where q.id = new.quote_id
      and q.organization_id = new.organization_id
      and q.status <> 'draft'
  ) then
    raise exception 'Un devis non brouillon de la même organisation est requis.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function app.guard_quote_document() from public, anon, authenticated;
create trigger quote_document_guard
  before insert or update or delete on public.quote_documents
  for each row execute function app.guard_quote_document();

comment on table public.quote_documents is
  'PDF du devis, conservé une fois à l''envoi. Écriture serveur uniquement ; ce stockage ne constitue pas un SAE certifié.';

-- -----------------------------------------------------------------------------
-- Stockage
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quote-documents', 'quote-documents', false, 5000000, array['application/pdf']);

create policy quote_documents_files_select
  on storage.objects for select to authenticated
  using (bucket_id = 'quote-documents' and exists (
    select 1 from public.quote_documents d where d.object_path = storage.objects.name
  ));
create policy quote_documents_files_no_insert on storage.objects
  as restrictive for insert to anon, authenticated
  with check (bucket_id <> 'quote-documents');
create policy quote_documents_files_no_update on storage.objects
  as restrictive for update to anon, authenticated
  using (bucket_id <> 'quote-documents')
  with check (bucket_id <> 'quote-documents');
create policy quote_documents_files_no_delete on storage.objects
  as restrictive for delete to anon, authenticated
  using (bucket_id <> 'quote-documents');
create policy quote_documents_files_read_scope on storage.objects
  as restrictive for select to authenticated
  using (bucket_id <> 'quote-documents' or exists (
    select 1 from public.quote_documents d where d.object_path = storage.objects.name
  ));
create policy quote_documents_files_no_anon_read on storage.objects
  as restrictive for select to anon
  using (bucket_id <> 'quote-documents');

-- -----------------------------------------------------------------------------
-- Portail client : exposer le chemin, autoriser la lecture du fichier
-- -----------------------------------------------------------------------------
-- `create or replace` refuse de changer la forme d'une table renvoyée (nouvelle
-- colonne `pdf_path`) : il faut déposer la fonction avant de la recréer.
drop function if exists public.portal_list_quotes();

create function public.portal_list_quotes()
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
  total_cents      bigint,
  pdf_path         text
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.organization_id, q.reference, q.title, q.status::text, q.valid_until, q.created_at,
         t.subtotal_cents, t.vat_cents, t.total_cents, d.object_path
  from public.quotes q
  left join public.quote_totals t on t.quote_id = q.id
  left join public.quote_documents d on d.quote_id = q.id
  where app.is_portal_contact()
    and app.org_has_feature(q.organization_id, 'quotes')
    and q.customer_id in (select app.portal_customer_ids())
    and q.status <> 'draft'
  order by q.created_at desc;
$$;

revoke all on function public.portal_list_quotes() from public, anon;
grant execute on function public.portal_list_quotes() to authenticated;

create or replace function public.portal_quote_detail(p_quote_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', q.id,
    'organization_id', q.organization_id,
    'reference', q.reference,
    'title', q.title,
    'status', q.status::text,
    'notes', q.notes,
    'valid_until', q.valid_until,
    'vat_rate', q.vat_rate,
    'created_at', q.created_at,
    'client_responded_at', q.client_responded_at,
    'site_name', q.site_name,
    'subtotal_cents', coalesce(t.subtotal_cents, 0),
    'vat_cents', coalesce(t.vat_cents, 0),
    'total_cents', coalesce(t.total_cents, 0),
    'pdf_path', d.object_path,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'description', i.description,
        'unit', i.unit,
        'quantity', i.quantity,
        'unit_price_cents', i.unit_price_cents,
        'line_total_cents', round(i.quantity * i.unit_price_cents)::bigint
      ) order by i.position, i.created_at)
      from public.quote_items i where i.quote_id = q.id
    ), '[]'::jsonb)
  )
  from public.quotes q
  left join public.quote_totals t on t.quote_id = q.id
  left join public.quote_documents d on d.quote_id = q.id
  where app.is_portal_contact()
    and app.org_has_feature(q.organization_id, 'quotes')
    and q.id = p_quote_id
    and q.customer_id in (select app.portal_customer_ids())
    and q.status <> 'draft';
$$;

revoke all on function public.portal_quote_detail(uuid) from public, anon;
grant execute on function public.portal_quote_detail(uuid) to authenticated;

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
    when 'quote-documents' then exists (
      select 1 from public.portal_list_quotes() q where q.pdf_path = p_path
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
  if exists (select 1 from public.portal_list_quotes()) then
    raise exception 'portal_list_quotes renvoie des lignes hors de toute session.';
  end if;
  if public.portal_quote_detail(gen_random_uuid()) is not null then
    raise exception 'portal_quote_detail renvoie un document hors session.';
  end if;
  if public.portal_can_read_file('quote-documents', 'x') then
    raise exception 'portal_can_read_file autorise quote-documents hors session.';
  end if;
end
$$;

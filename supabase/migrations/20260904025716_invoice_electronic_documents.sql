-- Documents générés depuis les instantanés émis, jamais téléversés par le client.
create table public.invoice_electronic_documents (
  invoice_id uuid primary key references public.invoices(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  format text not null default 'factur_x' check (format = 'factur_x'),
  profile text not null check (profile = 'EN 16931'),
  generator_version text not null check (length(generator_version) between 1 and 80),
  object_path text not null unique,
  xml_sha256 text not null check (xml_sha256 ~ '^[0-9a-f]{64}$'),
  pdf_sha256 text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size integer not null check (byte_size between 1 and 5000000),
  generated_at timestamptz not null default now(),
  check (object_path = organization_id::text || '/' || invoice_id::text || '/factur-x.pdf')
);
create index invoice_electronic_documents_organization_idx
  on public.invoice_electronic_documents(organization_id);

alter table public.invoice_electronic_documents enable row level security;
revoke all on public.invoice_electronic_documents from public, anon, authenticated, service_role;
grant select on public.invoice_electronic_documents to authenticated;
grant select, insert on public.invoice_electronic_documents to service_role;
create policy invoice_electronic_documents_select
  on public.invoice_electronic_documents for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and i.organization_id = invoice_electronic_documents.organization_id));

create function app.guard_invoice_electronic_document() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Un document de facture conservé ne peut être remplacé ou supprimé.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.invoices i where i.id = new.invoice_id
      and i.organization_id = new.organization_id
      and i.document_type = 'invoice' and i.status in ('issued', 'sent', 'paid')
  ) then
    raise exception 'Une facture émise de la même organisation est requise.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function app.guard_invoice_electronic_document() from public, anon, authenticated;
create trigger invoice_electronic_document_guard
  before insert or update or delete on public.invoice_electronic_documents
  for each row execute function app.guard_invoice_electronic_document();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoice-electronic-documents', 'invoice-electronic-documents', false, 5000000, array['application/pdf']);

-- La RLS de la table applique les mêmes droits et accès au module que la facture.
create policy invoice_electronic_files_select
  on storage.objects for select to authenticated
  using (bucket_id = 'invoice-electronic-documents' and exists (
    select 1 from public.invoice_electronic_documents d where d.object_path = storage.objects.name
  ));
-- Aucune policy INSERT/UPDATE/DELETE pour les clients.
-- Restrictions explicites : une autre policy de bucket ne peut pas ouvrir celui-ci.
create policy invoice_electronic_files_no_insert on storage.objects
  as restrictive for insert to anon, authenticated
  with check (bucket_id <> 'invoice-electronic-documents');
create policy invoice_electronic_files_no_update on storage.objects
  as restrictive for update to anon, authenticated
  using (bucket_id <> 'invoice-electronic-documents')
  with check (bucket_id <> 'invoice-electronic-documents');
create policy invoice_electronic_files_no_delete on storage.objects
  as restrictive for delete to anon, authenticated
  using (bucket_id <> 'invoice-electronic-documents');
create policy invoice_electronic_files_read_scope on storage.objects
  as restrictive for select to authenticated
  using (bucket_id <> 'invoice-electronic-documents' or exists (
    select 1 from public.invoice_electronic_documents d where d.object_path = storage.objects.name
  ));
create policy invoice_electronic_files_no_anon_read on storage.objects
  as restrictive for select to anon
  using (bucket_id <> 'invoice-electronic-documents');
comment on table public.invoice_electronic_documents is
  'PDF Factur-X conservé avec empreintes SHA-256. Écriture serveur uniquement ; ce stockage ne constitue pas un SAE certifié.';

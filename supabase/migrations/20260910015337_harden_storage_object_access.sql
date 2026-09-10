-- =============================================================================
-- Storage : un chemin de tenant ne suffit plus à rendre un objet lisible
-- =============================================================================
--
-- Les anciennes policies validaient seulement le premier segment du chemin.
-- Un membre de l'organisation connaissant/devinant le nom d'un objet orphelin
-- pouvait donc en obtenir une URL signée, même sans ligne métier visible.
-- Désormais, toute lecture exige une référence exacte dans la table protégée
-- par RLS. Les policies INSERT/DELETE restent séparées : le fichier est déposé
-- avant la ligne et supprimé après elle.

drop policy if exists "intervention_attachments_read" on storage.objects;
create policy "intervention_attachments_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'intervention-attachments'
    and exists (
      select 1
      from public.intervention_attachments attachment
      where attachment.storage_path = storage.objects.name
    )
  );

drop policy if exists "organization_documents_storage_read" on storage.objects;
create policy "organization_documents_storage_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'organization-documents'
    and exists (
      select 1
      from public.organization_documents document
      where document.storage_path = storage.objects.name
    )
  );

drop policy if exists "ai_documents_storage_read" on storage.objects;
create policy "ai_documents_storage_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ai-documents'
    and exists (
      select 1
      from public.ai_documents document
      where document.storage_path = storage.objects.name
    )
  );

-- =============================================================================
-- Les métadonnées métier sont dérivées de l'objet réellement déposé
-- =============================================================================

create or replace function app.verify_intervention_attachment_object()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := (select auth.uid())::text;
  v_owner text;
  v_mime text;
  v_size text;
  v_org uuid;
  v_mission uuid;
begin
  select i.organization_id, i.mission_id
  into v_org, v_mission
  from public.interventions i
  where i.id = new.intervention_id;

  if v_org is null then
    raise exception 'Intervention introuvable.' using errcode = 'foreign_key_violation';
  end if;

  if split_part(new.storage_path, '/', 1) <> v_org::text
     or split_part(new.storage_path, '/', 2) <> v_mission::text
     or split_part(new.storage_path, '/', 3) <> new.intervention_id::text then
    raise exception 'Le chemin du fichier ne correspond pas à son intervention.'
      using errcode = 'check_violation';
  end if;

  select o.owner_id, o.metadata ->> 'mimetype',
         coalesce(o.metadata ->> 'size', o.metadata ->> 'contentLength')
  into v_owner, v_mime, v_size
  from storage.objects o
  where o.bucket_id = 'intervention-attachments'
    and o.name = new.storage_path;

  if not found then
    raise exception 'Le fichier Storage doit exister avant sa référence.'
      using errcode = 'foreign_key_violation';
  end if;
  if v_actor is not null and v_owner is distinct from v_actor then
    raise exception 'Le fichier doit avoir été déposé par l''utilisateur courant.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_mime is null or v_size is null or v_size !~ '^[0-9]+$' then
    raise exception 'Les métadonnées du fichier sont incomplètes.' using errcode = 'check_violation';
  end if;

  new.organization_id := v_org;
  new.mime_type := v_mime;
  new.size_bytes := v_size::bigint;
  if v_actor is not null then new.uploaded_by := v_actor::uuid; end if;
  return new;
end;
$$;

revoke all on function app.verify_intervention_attachment_object() from public, anon, authenticated;

drop trigger if exists intervention_attachments_verify_object on public.intervention_attachments;
create trigger intervention_attachments_verify_object
  before insert on public.intervention_attachments
  for each row execute function app.verify_intervention_attachment_object();

create or replace function app.verify_organization_document_object()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := (select auth.uid())::text;
  v_owner text;
  v_mime text;
  v_size text;
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id
       or new.storage_path is distinct from old.storage_path
       or new.original_filename is distinct from old.original_filename
       or new.mime_type is distinct from old.mime_type
       or new.file_size is distinct from old.file_size
       or new.uploaded_by is distinct from old.uploaded_by then
      raise exception 'Le fichier et ses métadonnées techniques sont immuables.'
        using errcode = 'restrict_violation';
    end if;
    return new;
  end if;

  if split_part(new.storage_path, '/', 1) <> new.organization_id::text then
    raise exception 'Le chemin du document ne correspond pas à son organisation.'
      using errcode = 'check_violation';
  end if;

  select o.owner_id, o.metadata ->> 'mimetype',
         coalesce(o.metadata ->> 'size', o.metadata ->> 'contentLength')
  into v_owner, v_mime, v_size
  from storage.objects o
  where o.bucket_id = 'organization-documents'
    and o.name = new.storage_path;

  if not found then
    raise exception 'Le fichier Storage doit exister avant sa référence.'
      using errcode = 'foreign_key_violation';
  end if;
  if v_actor is not null and v_owner is distinct from v_actor then
    raise exception 'Le fichier doit avoir été déposé par l''utilisateur courant.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_mime is null or v_size is null or v_size !~ '^[0-9]+$' then
    raise exception 'Les métadonnées du fichier sont incomplètes.' using errcode = 'check_violation';
  end if;

  new.mime_type := v_mime;
  new.file_size := v_size::bigint;
  if v_actor is not null then new.uploaded_by := v_actor::uuid; end if;
  return new;
end;
$$;

revoke all on function app.verify_organization_document_object() from public, anon, authenticated;

drop trigger if exists organization_documents_verify_object on public.organization_documents;
create trigger organization_documents_verify_object
  before insert or update on public.organization_documents
  for each row execute function app.verify_organization_document_object();

create or replace function app.verify_ai_document_object()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := (select auth.uid())::text;
  v_owner text;
  v_mime text;
  v_size text;
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id
       or new.storage_path is distinct from old.storage_path
       or new.filename is distinct from old.filename
       or new.mime_type is distinct from old.mime_type
       or new.file_size is distinct from old.file_size
       or new.uploaded_by is distinct from old.uploaded_by then
      raise exception 'Le fichier IA et ses métadonnées techniques sont immuables.'
        using errcode = 'restrict_violation';
    end if;
    return new;
  end if;

  if split_part(new.storage_path, '/', 1) <> new.organization_id::text then
    raise exception 'Le chemin du document IA ne correspond pas à son organisation.'
      using errcode = 'check_violation';
  end if;

  select o.owner_id, o.metadata ->> 'mimetype',
         coalesce(o.metadata ->> 'size', o.metadata ->> 'contentLength')
  into v_owner, v_mime, v_size
  from storage.objects o
  where o.bucket_id = 'ai-documents'
    and o.name = new.storage_path;

  if not found then
    raise exception 'Le fichier Storage doit exister avant sa référence.'
      using errcode = 'foreign_key_violation';
  end if;
  if v_actor is not null and v_owner is distinct from v_actor then
    raise exception 'Le fichier doit avoir été déposé par l''utilisateur courant.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_mime <> 'application/pdf' or v_size is null or v_size !~ '^[0-9]+$' then
    raise exception 'Le document IA doit être un PDF avec une taille vérifiable.'
      using errcode = 'check_violation';
  end if;

  new.mime_type := v_mime;
  new.file_size := v_size::bigint;
  if v_actor is not null then new.uploaded_by := v_actor::uuid; end if;
  return new;
end;
$$;

revoke all on function app.verify_ai_document_object() from public, anon, authenticated;

drop trigger if exists ai_documents_verify_object on public.ai_documents;
create trigger ai_documents_verify_object
  before insert or update on public.ai_documents
  for each row execute function app.verify_ai_document_object();

-- Le navigateur ne doit jamais pouvoir remplacer un objet en place.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'UPDATE'
      and policyname in (
        'intervention_attachments_update',
        'organization_documents_storage_update',
        'ai_documents_storage_update'
      )
  ) then
    raise exception 'Une policy UPDATE inattendue permet de remplacer un fichier en place.';
  end if;
end
$$;

-- =============================================================================
-- Assistant IA — bibliothèque documentaire (RAG)
-- =============================================================================
--
-- L'Edge Function `ai-assistant` existe déjà et répond à partir des données
-- métier (missions, stock, devis...). Elle n'a en revanche aucun accès à la
-- documentation technique de l'entreprise (procédures, notices, normes) : deux
-- techniciens posant la même question sur une notice PDF reçoivent aujourd'hui
-- une réponse générique du modèle, jamais un extrait du document réel.
--
-- Cette migration pose le stockage : un document déposé (`ai_documents`) est
-- découpé en fragments indexés (`ai_document_chunks`), chacun porteur d'un
-- embedding. `app.match_ai_document_chunks` est le seul point d'entrée pour
-- les lire — jamais un `select *` : la fonction applique le filtre
-- organisationnel elle-même, pour rester sûre même appelée hors du contexte
-- prévu.
--
-- `pgvector` (extension `vector`) est disponible sur ce projet mais pas encore
-- activé : c'est cette migration qui l'active, dans le schéma `extensions` —
-- celui où vivent déjà `pgcrypto` et `uuid-ossp`.
-- =============================================================================

create extension if not exists vector with schema extensions;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
-- Déposer/retirer un document engage l'entreprise (c'est sa documentation
-- interne, potentiellement confidentielle) : réservé à owner/admin/manager,
-- même tier que `quote.manage`. `ai.use` (interroger l'assistant) est semé
-- dans la migration suivante, avec les tables de conversation.
insert into public.role_permissions (role, permission) values
  ('owner',   'ai.manage_documents'),
  ('admin',   'ai.manage_documents'),
  ('manager', 'ai.manage_documents')
on conflict (role, permission) do nothing;

-- -----------------------------------------------------------------------------
-- ai_documents
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_document_status') then
    create type public.ai_document_status as enum ('pending', 'processing', 'ready', 'error');
  end if;
end
$$;

create table if not exists public.ai_documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title           text not null check (char_length(title) between 2 and 200),
  description     text,
  category        text,
  filename        text not null,
  mime_type       text,
  storage_path    text not null,
  file_size       bigint,
  status          public.ai_document_status not null default 'pending',
  -- Message d'erreur exploitable si l'indexation échoue (PDF illisible,
  -- extraction vide...). Jamais affiché brut au technicien terrain, mais utile
  -- à l'administrateur qui a déposé le document et à qui le diagnostique.
  error_message   text,
  uploaded_by     uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (organization_id, storage_path)
);

create index if not exists ai_documents_organization_idx
  on public.ai_documents (organization_id, status);

drop trigger if exists ai_documents_set_updated_at on public.ai_documents;
create trigger ai_documents_set_updated_at
  before update on public.ai_documents
  for each row execute function public.set_updated_at();

drop trigger if exists ai_documents_organization_immutable on public.ai_documents;
create trigger ai_documents_organization_immutable
  before update on public.ai_documents
  for each row execute function app.enforce_organization_immutable();

-- -----------------------------------------------------------------------------
-- ai_document_chunks
-- -----------------------------------------------------------------------------
-- `organization_id` est dénormalisé pour que les policies et la recherche
-- vectorielle filtrent sans jointure — même raisonnement que `quote_items`.
-- ÉCRASÉ PAR TRIGGER, jamais fourni par l'appelant.
--
-- Dimension 1536 : celle de `text-embedding-3-small`, le modèle d'embedding
-- retenu (voir `docs/ai-assistant.md`). Changer de modèle d'embedding plus
-- tard exige de réindexer tous les documents, pas seulement cette colonne —
-- la dimension doit donc rester alignée sur `OPENAI_EMBEDDING_MODEL`.
create table if not exists public.ai_document_chunks (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.ai_documents (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  content         text not null,
  chunk_index     integer not null,
  embedding       extensions.vector(1536),
  -- { "page": 12, "section": "Mesure OTDR", "document_title": "...", "category": "fibre" }
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),

  unique (document_id, chunk_index)
);

create index if not exists ai_document_chunks_organization_idx
  on public.ai_document_chunks (organization_id);

-- HNSW plutôt qu'IVFFlat : pas d'étape d'entraînement préalable requise, et le
-- volume attendu (documentation technique d'une PME, pas un corpus massif)
-- reste dans sa zone de confort. `vector_cosine_ops` parce que les embeddings
-- OpenAI se comparent par similarité cosinus.
create index if not exists ai_document_chunks_embedding_idx
  on public.ai_document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create or replace function app.enforce_ai_document_chunk_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select d.organization_id into new.organization_id
  from public.ai_documents d
  where d.id = new.document_id;

  if new.organization_id is null then
    raise exception 'Document introuvable.' using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists ai_document_chunks_enforce_org on public.ai_document_chunks;
create trigger ai_document_chunks_enforce_org
  before insert or update on public.ai_document_chunks
  for each row execute function app.enforce_ai_document_chunk_org();

-- -----------------------------------------------------------------------------
-- Recherche vectorielle
-- -----------------------------------------------------------------------------
-- Unique point d'entrée pour lire des fragments. Le filtre organisationnel est
-- appliqué ICI, dans la fonction — jamais délégué à l'appelant — pour rester
-- correct même si un jour cette fonction est atteinte autrement que par la
-- Edge Function `ai-assistant`. `least(p_match_count, 20)` plafonne un appel
-- qui demanderait un nombre de résultats déraisonnable.
--
-- `OPERATOR(extensions.<=>)` plutôt que `<=>` nu : `search_path = ''` empêche
-- la résolution implicite de l'opérateur par nom seul, comme pour toute
-- fonction ou table non qualifiée dans ce fichier.
create or replace function app.match_ai_document_chunks(
  p_organization_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_threshold float default 0.70,
  p_match_count integer default 8
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    1 - (c.embedding OPERATOR(extensions.<=>) p_query_embedding) as similarity
  from public.ai_document_chunks c
  where app.is_org_member(p_organization_id)
    and c.organization_id = p_organization_id
    and c.embedding is not null
    and 1 - (c.embedding OPERATOR(extensions.<=>) p_query_embedding) >= p_match_threshold
  order by c.embedding OPERATOR(extensions.<=>) p_query_embedding
  limit least(p_match_count, 20);
$$;

revoke all on function app.match_ai_document_chunks(uuid, extensions.vector, float, integer) from public, anon;
grant execute on function app.match_ai_document_chunks(uuid, extensions.vector, float, integer) to authenticated;

comment on function app.match_ai_document_chunks(uuid, extensions.vector, float, integer) is
  'Recherche vectorielle des fragments documentaires, filtree par organisation. Seul point d''entree en lecture de ai_document_chunks.';

-- -----------------------------------------------------------------------------
-- Storage — documents source de l'assistant
-- -----------------------------------------------------------------------------
-- Même convention que `intervention-attachments` : le premier segment du
-- chemin est l'organisation, seul segment que les policies inspectent.
-- PDF uniquement au lancement — le pipeline d'indexation (Phase 6) ne sait
-- lire que ça.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ai-documents',
  'ai-documents',
  false,
  26214400, -- 25 Mio : une notice technique volumineuse passe
  array['application/pdf']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ai_documents_storage_read" on storage.objects;
create policy "ai_documents_storage_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'ai-documents'
    and (storage.foldername(name))[1] in (
      select org_id::text from app.my_organization_ids() as org_id
    )
  );

drop policy if exists "ai_documents_storage_upload" on storage.objects;
create policy "ai_documents_storage_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'ai-documents'
    and (storage.foldername(name))[1] in (
      select org_id::text from app.my_organization_ids() as org_id
    )
    and (select app.org_has_feature(((storage.foldername(name))[1])::uuid, 'ai_assistant'))
    and (select app.has_org_permission(((storage.foldername(name))[1])::uuid, 'ai.manage_documents'))
  );

-- Pas de policy UPDATE : un PDF corrigé se redépose, il ne se remplace pas en
-- place — même raisonnement que les pièces jointes d'intervention.

drop policy if exists "ai_documents_storage_delete" on storage.objects;
create policy "ai_documents_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'ai-documents'
    and (storage.foldername(name))[1] in (
      select org_id::text from app.my_organization_ids() as org_id
    )
    and (select app.has_org_permission(((storage.foldername(name))[1])::uuid, 'ai.manage_documents'))
  );

-- -----------------------------------------------------------------------------
-- Privilèges et RLS des tables
-- -----------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array['ai_documents', 'ai_document_chunks'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', v_table);
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end
$$;

grant select, insert, update, delete on public.ai_documents to authenticated;

-- `ai_document_chunks` : lecture seule pour le client, en défense en
-- profondeur derrière `match_ai_document_chunks`. Aucun grant insert/update/
-- delete à `authenticated` : seul le pipeline d'indexation (rôle de service,
-- qui contourne RLS) y écrit.
grant select on public.ai_document_chunks to authenticated;

-- ------------------------------------------------------------- ai_documents
drop policy if exists "ai_documents_select" on public.ai_documents;
create policy "ai_documents_select"
  on public.ai_documents for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'ai_assistant'))
    and (select app.has_org_permission(organization_id, 'ai.use'))
  );

drop policy if exists "ai_documents_insert" on public.ai_documents;
create policy "ai_documents_insert"
  on public.ai_documents for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'ai_assistant'))
    and (select app.has_org_permission(organization_id, 'ai.manage_documents'))
  );

drop policy if exists "ai_documents_update" on public.ai_documents;
create policy "ai_documents_update"
  on public.ai_documents for update
  to authenticated
  using ((select app.has_org_permission(organization_id, 'ai.manage_documents')))
  with check ((select app.has_org_permission(organization_id, 'ai.manage_documents')));

drop policy if exists "ai_documents_delete" on public.ai_documents;
create policy "ai_documents_delete"
  on public.ai_documents for delete
  to authenticated
  using ((select app.has_org_permission(organization_id, 'ai.manage_documents')));

-- ------------------------------------------------------- ai_document_chunks
drop policy if exists "ai_document_chunks_select" on public.ai_document_chunks;
create policy "ai_document_chunks_select"
  on public.ai_document_chunks for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'ai_assistant'))
    and (select app.has_org_permission(organization_id, 'ai.use'))
  );

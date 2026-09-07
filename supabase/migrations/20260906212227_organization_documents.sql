-- =============================================================================
-- Bibliotheque de documents partages par organisation
-- =============================================================================
--
-- Un espace commun a l'organisation, la ou `intervention_attachments` reste
-- attache a une intervention precise. Meme socle : bucket prive, chemin dont le
-- premier segment porte l'organisation, isolation par `app.my_organization_ids`.
--
-- CHEMIN STORAGE VOLONTAIREMENT PLAT : `{organization_id}/{uuid}-{nom}`.
--
-- Le dossier vit en base, pas dans le chemin. Deplacer un document est donc une
-- seule mise a jour SQL, la ou un dossier dans le chemin imposerait copie puis
-- suppression puis mise a jour — trois operations non atomiques, dont le premier
-- echec reseau laisse un orphelin ou un doublon. Le binaire n'est jamais touche
-- apres son depot, et son `uuid` reste son identite.

-- -----------------------------------------------------------------------------
-- Dossiers
-- -----------------------------------------------------------------------------
--
-- `parent_folder_id` existe des maintenant pour ne pas avoir a migrer le jour ou
-- l'arborescence sera utile. L'interface de cette version reste plate : les
-- dossiers y servent de filtre et de cible de deplacement.

create table public.document_folders (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  parent_folder_id uuid references public.document_folders(id) on delete set null,
  name             text not null check (char_length(btrim(name)) between 1 and 120),
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint document_folders_name_not_blank check (btrim(name) <> ''),
  constraint document_folders_not_self_parent check (parent_folder_id is distinct from id)
);

create unique index document_folders_unique_name_idx
  on public.document_folders(organization_id, coalesce(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));

create index document_folders_organization_idx
  on public.document_folders(organization_id, name);

comment on table public.document_folders is
  'Dossiers de la bibliotheque documentaire. Le dossier vit ici, jamais dans le chemin Storage.';

-- -----------------------------------------------------------------------------
-- Documents
-- -----------------------------------------------------------------------------

create table public.organization_documents (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  folder_id         uuid references public.document_folders(id) on delete set null,
  uploaded_by       uuid references public.profiles(id) on delete set null,
  name              text not null check (char_length(btrim(name)) between 1 and 200),
  original_filename text,
  storage_path      text not null unique,
  mime_type         text,
  file_size         bigint check (file_size is null or file_size >= 0),
  description       text check (description is null or char_length(description) <= 2000),
  category          text check (category is null or char_length(btrim(category)) between 1 and 80),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint organization_documents_name_not_blank check (btrim(name) <> ''),
  -- Le premier segment du chemin DOIT etre l'organisation : c'est sur lui que
  -- reposent les policies Storage. Une ligne qui mentirait la-dessus ouvrirait
  -- un fichier a la mauvaise organisation.
  constraint organization_documents_path_scoped
    check (storage_path like organization_id::text || '/%')
);

create index organization_documents_recent_idx
  on public.organization_documents(organization_id, created_at desc);

create index organization_documents_folder_idx
  on public.organization_documents(organization_id, folder_id);

-- PAS D'INDEX DE RECHERCHE DEDIE, ET C'EST DELIBERE.
--
-- Un index plein texte ne repondrait pas au besoin : dans une bibliotheque on
-- tape « fact » pour trouver « facture », or `to_tsvector` compare des lexemes
-- entiers. Un index trigramme le ferait, au prix d'une extension de plus en
-- production — pour un gain nul a l'echelle annoncee.
--
-- La restriction qui compte est deja posee : `organization_documents_recent_idx`
-- ramene toute recherche aux seules lignes d'UNE organisation. Filtrer quelques
-- milliers de lignes par `ilike` s'y mesure en millisecondes. Le jour ou une
-- organisation en comptera assez pour que cela se voie, la mesure dira quel
-- index poser — plutot que de le deviner aujourd'hui.

comment on table public.organization_documents is
  'Bibliotheque documentaire d''une organisation. Les binaires vivent dans le bucket prive organization-documents.';

-- -----------------------------------------------------------------------------
-- Trace des nettoyages Storage manques
-- -----------------------------------------------------------------------------
--
-- Supprimer un document touche deux systemes qui ne partagent aucune
-- transaction. L'ordre retenu est : ligne SQL d'abord, fichier ensuite.
--
-- Ce sens est deliberé. Si le fichier resiste, il reste un orphelin : invisible,
-- sans danger, qui ne coute que du stockage. Le sens inverse laisserait une
-- ligne pointant vers un fichier disparu — visible par l'utilisateur, et
-- impossible a distinguer d'une panne.
--
-- L'orphelin est consigne ici pour qu'un nettoyage ulterieur puisse le retrouver.

create table public.document_storage_orphans (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id     uuid,
  storage_path    text not null,
  error_message   text,
  recorded_at     timestamptz not null default now()
);

create index document_storage_orphans_pending_idx
  on public.document_storage_orphans(organization_id, recorded_at desc);

comment on table public.document_storage_orphans is
  'Fichiers dont la suppression Storage a echoue apres celle de leur ligne. A rejouer par une tache de nettoyage.';

-- -----------------------------------------------------------------------------
-- Horodatage
-- -----------------------------------------------------------------------------

create trigger document_folders_set_updated_at
  before update on public.document_folders
  for each row execute function public.set_updated_at();

create trigger organization_documents_set_updated_at
  before update on public.organization_documents
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Permissions RBAC
-- -----------------------------------------------------------------------------
--
-- Convention du projet : domaine au singulier, granularite vue/gestion, la
-- suppression separee quand elle est destructrice — comme `customer.*`.
--
-- La lecture est ouverte a tous les roles : une bibliotheque partagee n'a de
-- sens que si l'equipe y accede. Le depot s'arrete au chef d'equipe, la
-- suppression au responsable.

insert into public.role_permissions (role, permission) values
  ('owner', 'document.view'), ('owner', 'document.manage'), ('owner', 'document.delete'),
  ('admin', 'document.view'), ('admin', 'document.manage'), ('admin', 'document.delete'),
  ('manager', 'document.view'), ('manager', 'document.manage'), ('manager', 'document.delete'),
  ('team_leader', 'document.view'), ('team_leader', 'document.manage'),
  ('technician', 'document.view'),
  ('employee', 'document.view')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Formule
-- -----------------------------------------------------------------------------
--
-- Exactement les formules qui disposent deja de `attachments`, c'est-a-dire de
-- la capacite de stockage deja vendue. Aucune offre commerciale n'est modifiee.
-- `limit_value` reste nul : le quota du paragraphe 15 se posera ici le jour
-- voulu, sans nouvelle machinerie.
--
-- Les trois codes sont ecrits en toutes lettres plutot que copies par un
-- `select ... where feature_key = 'attachments'`. Le resultat est le meme --
-- verification faite, `attachments` porte exactement pro, business et
-- enterprise -- mais cette forme-ci est LISIBLE par le garde-fou
-- `entitlements.test.ts`, qui compare le miroir TypeScript au SQL seme. Un
-- `insert ... select` lui serait opaque : la cle n'apparaitrait ni d'un cote ni
-- de l'autre, et le test resterait vert en ne verifiant rien.

insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('pro', 'documents', null),
  ('business', 'documents', null),
  ('enterprise', 'documents', null)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.document_folders enable row level security;
alter table public.organization_documents enable row level security;
alter table public.document_storage_orphans enable row level security;

revoke all on public.document_folders from public, anon, authenticated;
revoke all on public.organization_documents from public, anon, authenticated;
revoke all on public.document_storage_orphans from public, anon, authenticated;

grant select, insert, update, delete on public.document_folders to authenticated;
grant select, insert, update, delete on public.organization_documents to authenticated;
grant insert on public.document_storage_orphans to authenticated;
grant select on public.document_storage_orphans to authenticated;

create policy "document_folders_select"
  on public.document_folders for select to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'documents'))
    and (select app.has_org_permission(organization_id, 'document.view'))
  );

create policy "document_folders_write"
  on public.document_folders for insert to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'documents'))
    and (select app.has_org_permission(organization_id, 'document.manage'))
  );

create policy "document_folders_update"
  on public.document_folders for update to authenticated
  using ((select app.has_org_permission(organization_id, 'document.manage')))
  with check ((select app.has_org_permission(organization_id, 'document.manage')));

create policy "document_folders_delete"
  on public.document_folders for delete to authenticated
  using ((select app.has_org_permission(organization_id, 'document.delete')));

create policy "organization_documents_select"
  on public.organization_documents for select to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'documents'))
    and (select app.has_org_permission(organization_id, 'document.view'))
  );

create policy "organization_documents_insert"
  on public.organization_documents for insert to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'documents'))
    and (select app.has_org_permission(organization_id, 'document.manage'))
  );

-- Renommage, deplacement et description. L'organisation ne peut pas changer :
-- le chemin Storage la porte, et le trigger ci-dessous le verifie.
create policy "organization_documents_update"
  on public.organization_documents for update to authenticated
  using ((select app.has_org_permission(organization_id, 'document.manage')))
  with check ((select app.has_org_permission(organization_id, 'document.manage')));

create policy "organization_documents_delete"
  on public.organization_documents for delete to authenticated
  using ((select app.has_org_permission(organization_id, 'document.delete')));

-- La trace d'orphelin est ecrite par celui qui vient de supprimer, et relue par
-- ceux qui consultent le journal d'activite.
create policy "document_storage_orphans_insert"
  on public.document_storage_orphans for insert to authenticated
  with check ((select app.has_org_permission(organization_id, 'document.delete')));

create policy "document_storage_orphans_select"
  on public.document_storage_orphans for select to authenticated
  using ((select app.has_org_permission(organization_id, 'audit.view')));

-- -----------------------------------------------------------------------------
-- Invariants
-- -----------------------------------------------------------------------------
--
-- L'organisation et le chemin forment l'identite du document. Les laisser
-- mutables permettrait de deplacer une ligne vers une autre organisation tout en
-- gardant son fichier — ou l'inverse. La policy Storage repose sur le premier
-- segment du chemin : elle serait contournee.

create or replace function app.guard_organization_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.storage_path is distinct from old.storage_path then
    raise exception 'L''organisation et le fichier d''un document ne peuvent pas etre modifies.'
      using errcode = 'restrict_violation';
  end if;

  -- Un document ne se range que dans un dossier de SA propre organisation.
  if new.folder_id is not null and not exists (
    select 1 from public.document_folders f
    where f.id = new.folder_id and f.organization_id = new.organization_id
  ) then
    raise exception 'Ce dossier appartient a une autre organisation.'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

create trigger organization_documents_guard
  before update on public.organization_documents
  for each row execute function app.guard_organization_document();

revoke all on function app.guard_organization_document() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Audit
-- -----------------------------------------------------------------------------
--
-- Par trigger, comme `app.audit_customer` : `authenticated` n'ecrit pas dans
-- `audit_logs`, et une trace que le client pourrait omettre ne vaudrait rien.

create or replace function app.audit_organization_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_audit_log(
      new.organization_id, 'document.uploaded', 'organization_document', new.id,
      jsonb_build_object('name', new.name, 'mime_type', new.mime_type, 'file_size', new.file_size)
    );
  elsif tg_op = 'UPDATE' then
    if new.name is distinct from old.name then
      perform app.write_audit_log(
        new.organization_id, 'document.renamed', 'organization_document', new.id,
        jsonb_build_object('from', old.name, 'to', new.name)
      );
    end if;
    if new.folder_id is distinct from old.folder_id then
      perform app.write_audit_log(
        new.organization_id, 'document.moved', 'organization_document', new.id,
        jsonb_build_object('from', old.folder_id, 'to', new.folder_id)
      );
    end if;
  elsif tg_op = 'DELETE' then
    perform app.write_audit_log(
      old.organization_id, 'document.deleted', 'organization_document', old.id,
      jsonb_build_object('name', old.name, 'storage_path', old.storage_path)
    );
    return old;
  end if;

  return new;
end;
$$;

create trigger organization_documents_audit
  after insert or update or delete on public.organization_documents
  for each row execute function app.audit_organization_document();

revoke all on function app.audit_organization_document() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Bucket prive
-- -----------------------------------------------------------------------------
--
-- Le type MIME et la taille sont controles ICI, par le serveur. La constante du
-- frontend n'en est qu'un miroir destine a l'experience utilisateur : elle
-- evite un televersement voue a l'echec, elle ne protege rien.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-documents',
  'organization-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Policies Storage
-- -----------------------------------------------------------------------------
--
-- Le premier segment du chemin porte l'organisation, et c'est sur lui que
-- reposent les trois regles. `app.can_use_pro_module` verifie a la fois
-- l'appartenance ACTIVE et la disponibilite de la formule ; la permission est
-- verifiee en plus, pour que la securite du fichier dise la meme chose que celle
-- de sa ligne. Masquer dans l'interface ne suffirait pas : sans ces regles, un
-- chemin devine suffirait a signer une URL.
--
-- Aucune policy UPDATE : le chemin ne change jamais apres le depot. Renommer et
-- deplacer ne touchent que la base. Ouvrir UPDATE elargirait la surface sans
-- servir a quoi que ce soit.

create policy "organization_documents_storage_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'organization-documents'
    and (select app.can_use_pro_module(((storage.foldername(name))[1])::uuid, 'documents'))
    and (select app.has_org_permission(((storage.foldername(name))[1])::uuid, 'document.view'))
  );

create policy "organization_documents_storage_upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'organization-documents'
    and (select app.can_use_pro_module(((storage.foldername(name))[1])::uuid, 'documents'))
    and (select app.has_org_permission(((storage.foldername(name))[1])::uuid, 'document.manage'))
  );

create policy "organization_documents_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'organization-documents'
    and (select app.can_use_pro_module(((storage.foldername(name))[1])::uuid, 'documents'))
    and (select app.has_org_permission(((storage.foldername(name))[1])::uuid, 'document.delete'))
  );

-- -----------------------------------------------------------------------------
-- Controles
-- -----------------------------------------------------------------------------
--
-- Ce bloc echoue bruyamment plutot que de laisser la migration passer en ne
-- faisant rien — le depot affirmerait alors une protection inexistante.

do $$
declare
  v_manquantes integer;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.organization_documents'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.document_folders'::regclass) then
    raise exception 'La RLS doit etre active sur les tables de la bibliotheque.';
  end if;

  if (select public from storage.buckets where id = 'organization-documents') then
    raise exception 'Le bucket de la bibliotheque ne doit jamais etre public.';
  end if;

  if (select count(*) from storage.buckets
      where id = 'organization-documents' and allowed_mime_types is null) > 0 then
    raise exception 'Le bucket doit restreindre explicitement les types de fichiers.';
  end if;

  select count(*) into v_manquantes
  from (values ('document.view'), ('document.manage'), ('document.delete')) as attendu(permission)
  where not exists (
    select 1 from public.role_permissions r where r.permission = attendu.permission
  );
  if v_manquantes > 0 then
    raise exception '% permission(s) de la bibliotheque absente(s) du RBAC.', v_manquantes;
  end if;

  if not exists (select 1 from public.plan_features where feature_key = 'documents') then
    raise exception 'La cle de formule « documents » n''a pas ete posee.';
  end if;

  if (select count(*) from pg_policy p join pg_class c on c.oid = p.polrelid
      where c.relname = 'objects'
        and p.polname like 'organization_documents_storage_%') <> 3 then
    raise exception 'Les trois policies Storage de la bibliotheque doivent exister.';
  end if;
end
$$;

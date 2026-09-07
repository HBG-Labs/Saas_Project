import { supabase, unwrap } from '@/services/supabase';
import type { DocumentFolder, OrganizationDocument } from '@/types/domain';

import { DOCUMENTS_PAR_PAGE, type FiltreFamille } from '../constants';

const BUCKET = 'organization-documents';

/**
 * Types MIME de chaque famille, pour filtrer côté serveur.
 *
 * Le filtre porte sur le type MIME enregistré au dépôt, jamais sur l'extension
 * du nom : celle-ci se renomme librement.
 */
const MIMES_PAR_FAMILLE: Record<Exclude<FiltreFamille, 'tous'>, string[]> = {
  pdf: ['application/pdf'],
  image: ['image/jpeg', 'image/png', 'image/webp'],
  document: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  tableur: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],
};

/**
 * Chemin de stockage : `{organization_id}/{uuid}-{nom assaini}`.
 *
 * Le premier segment porte l'organisation — les policies Storage ne regardent
 * que lui. Le `uuid` garantit l'unicité : deux « plan.pdf » déposés le même jour
 * ne se recouvrent pas, et le nom d'origine ne sert jamais d'identifiant.
 *
 * L'assainissement écarte tout ce qui n'est pas alphanumérique, point, tiret ou
 * souligné. C'est ce qui rend une traversée de répertoire impossible : ni `/`
 * ni `..` ne survivent, et le segment d'organisation ne peut donc pas être
 * quitté depuis le nom du fichier.
 *
 * Le dossier n'apparaît PAS ici : il vit en base. Déplacer un document est ainsi
 * une seule écriture SQL, jamais un déplacement de fichier.
 */
export function buildDocumentPath(input: { organizationId: string; fileName: string }): string {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  return `${input.organizationId}/${crypto.randomUUID()}-${safeName}`;
}

export interface DocumentListInput {
  organizationId: string;
  search?: string;
  famille?: FiltreFamille;
  folderId?: string | null;
  page?: number;
}

export interface DocumentListResult {
  documents: OrganizationDocument[];
  total: number;
}

/**
 * Page de documents, filtrée et comptée par la base.
 *
 * Rien n'est filtré côté navigateur : à plusieurs milliers de documents, tout
 * rapatrier pour en afficher vingt-quatre coûterait à chaque ouverture. Aucune
 * URL signée n'est produite ici non plus — elles se demandent à l'unité, au
 * moment où un fichier est réellement ouvert.
 */
export async function listDocuments(input: DocumentListInput): Promise<DocumentListResult> {
  const page = input.page ?? 0;
  const debut = page * DOCUMENTS_PAR_PAGE;

  let query = supabase
    .from('organization_documents')
    .select('*', { count: 'exact' })
    .eq('organization_id', input.organizationId);

  if (input.folderId !== undefined) {
    query = input.folderId === null ? query.is('folder_id', null) : query.eq('folder_id', input.folderId);
  }

  if (input.famille && input.famille !== 'tous') {
    query = query.in('mime_type', MIMES_PAR_FAMILLE[input.famille]);
  }

  const terme = input.search?.trim();
  if (terme) {
    const motif = `%${terme.replace(/[%_]/g, '\\$&')}%`;
    query = query.or(`name.ilike.${motif},description.ilike.${motif},category.ilike.${motif}`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(debut, debut + DOCUMENTS_PAR_PAGE - 1);

  if (error) throw error;
  return { documents: data ?? [], total: count ?? 0 };
}

export async function listFolders(organizationId: string): Promise<DocumentFolder[]> {
  return unwrap(
    supabase
      .from('document_folders')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true }),
  );
}

export async function createFolder(input: {
  organizationId: string;
  name: string;
  createdBy: string;
}): Promise<DocumentFolder> {
  return unwrap(
    supabase
      .from('document_folders')
      .insert({
        organization_id: input.organizationId,
        name: input.name.trim(),
        created_by: input.createdBy,
      })
      .select('*')
      .single(),
  );
}

/**
 * URL temporaire, produite à la demande.
 *
 * Le bucket est privé : sans signature, le chemin exact ne suffit pas. Une heure
 * couvre largement une consultation, et reste trop court pour qu'un lien
 * circule durablement hors de l'organisation.
 */
export async function getDocumentUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}

/** URL signée forçant le téléchargement plutôt que l'affichage. */
export async function getDocumentDownloadUrl(
  storagePath: string,
  fileName: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600, { download: fileName });

  if (error) throw error;
  return data.signedUrl;
}

export interface UploadDocumentInput {
  organizationId: string;
  file: File;
  name: string;
  uploadedBy: string;
  folderId?: string | null;
  description?: string;
  category?: string;
}

/**
 * Dépose le fichier, puis enregistre sa référence.
 *
 * Cet ordre est le bon : tant que la ligne n'existe pas, le fichier n'est
 * atteignable par personne — le bucket est privé et rien ne le référence. Si
 * l'enregistrement échoue, le fichier est retiré ; sans ce rattrapage, le
 * bucket accumulerait des objets invisibles et impossibles à retrouver.
 */
export async function uploadDocument(input: UploadDocumentInput): Promise<OrganizationDocument> {
  const path = buildDocumentPath({
    organizationId: input.organizationId,
    fileName: input.file.name,
  });

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, input.file, { contentType: input.file.type, upsert: false });

  if (uploadError) throw uploadError;

  try {
    return await unwrap(
      supabase
        .from('organization_documents')
        .insert({
          organization_id: input.organizationId,
          storage_path: path,
          name: input.name.trim(),
          original_filename: input.file.name,
          mime_type: input.file.type,
          file_size: input.file.size,
          uploaded_by: input.uploadedBy,
          folder_id: input.folderId ?? null,
          ...(input.description ? { description: input.description.trim() } : {}),
          ...(input.category ? { category: input.category.trim() } : {}),
        })
        .select('*')
        .single(),
    );
  } catch (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

export async function updateDocument(
  documentId: string,
  patch: { name?: string; description?: string | null; category?: string | null; folder_id?: string | null },
): Promise<OrganizationDocument> {
  return unwrap(
    supabase
      .from('organization_documents')
      .update({
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.folder_id !== undefined ? { folder_id: patch.folder_id } : {}),
      })
      .eq('id', documentId)
      .select('*')
      .single(),
  );
}

/**
 * Supprime un document des deux systèmes qui le portent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POSTGRESQL ET STORAGE NE PARTAGENT AUCUNE TRANSACTION
 *
 * L'un des deux peut donc échouer seul, et il faut choisir lequel on préfère.
 *
 * La ligne part EN PREMIER. Si la suppression du fichier échoue ensuite, il
 * reste un orphelin : invisible, inatteignable — le bucket est privé et plus
 * rien ne le référence — et qui ne coûte que du stockage.
 *
 * L'ordre inverse laisserait une ligne pointant vers un fichier disparu :
 * visible dans la bibliothèque, impossible à ouvrir, indiscernable d'une panne
 * réseau. C'est le pire des deux, parce qu'il se voit et qu'il ment.
 *
 * L'orphelin est consigné dans `document_storage_orphans` pour qu'un nettoyage
 * ultérieur le retrouve. L'échec de cette trace n'est pas remonté à
 * l'utilisateur : sa suppression, elle, a bien eu lieu.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function deleteDocument(document: OrganizationDocument): Promise<void> {
  const { error } = await supabase
    .from('organization_documents')
    .delete()
    .eq('id', document.id);

  if (error) throw error;

  const { error: erreurFichier } = await supabase.storage
    .from(BUCKET)
    .remove([document.storage_path]);

  if (erreurFichier) {
    await supabase
      .from('document_storage_orphans')
      .insert({
        organization_id: document.organization_id,
        document_id: document.id,
        storage_path: document.storage_path,
        error_message: erreurFichier.message.slice(0, 500),
      })
      .then(undefined, () => undefined);
  }
}

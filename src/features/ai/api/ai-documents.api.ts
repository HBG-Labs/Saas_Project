import { supabase, unwrap } from '@/services/supabase';
import type { TablesUpdate } from '@/types/database';
import type { AiDocument } from '@/types/domain';

/**
 * Bibliothèque documentaire de l'Assistant IA (RAG).
 *
 * Même patron que `uploadAttachment` (`interventions.api.ts`) : dépôt dans
 * Storage d'abord, ligne `ai_documents` ensuite, et retrait du fichier si
 * l'enregistrement échoue — un bucket ne doit jamais accumuler d'objets
 * qu'aucune ligne ne référence.
 *
 * L'INDEXATION N'EST PAS ICI. `uploadAiDocument` déclenche la Edge Function
 * `index-ai-document` en tâche de fond une fois la ligne créée, mais ne
 * bloque pas dessus : l'upload répond dès que le document existe en base,
 * avec le statut `pending` puis `processing` visible côté liste — c'est ce
 * que l'UI affiche pendant que l'indexation tourne, plutôt qu'un spinner sur
 * toute la durée de l'extraction et des embeddings.
 */

const BUCKET = 'ai-documents';

export async function listAiDocuments(organizationId: string): Promise<AiDocument[]> {
  return unwrap(
    supabase
      .from('ai_documents')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),
  );
}

/**
 * Chemin de stockage : organisation en premier segment, seul segment que les
 * policies `storage.objects` inspectent (voir
 * `20260902150000_ai_assistant_documents.sql`).
 */
function buildAiDocumentPath(organizationId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  return `${organizationId}/${crypto.randomUUID()}-${safeName}`;
}

export interface UploadAiDocumentInput {
  organizationId: string;
  title: string;
  category?: string;
  file: File;
}

export async function uploadAiDocument(input: UploadAiDocumentInput): Promise<AiDocument> {
  const path = buildAiDocumentPath(input.organizationId, input.file.name);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, input.file, { contentType: input.file.type, upsert: false });

  if (uploadError) throw uploadError;

  let document: AiDocument;
  try {
    document = await unwrap(
      supabase
        .from('ai_documents')
        .insert({
          organization_id: input.organizationId,
          title: input.title,
          filename: input.file.name,
          mime_type: input.file.type,
          storage_path: path,
          file_size: input.file.size,
          ...(input.category ? { category: input.category } : {}),
        })
        .select('*')
        .single(),
    );
  } catch (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }

  // Déclenché sans attendre : une indexation qui échoue laisse le document en
  // `error` avec un message exploitable (lu par la liste, pas ici) — ce n'est
  // pas une raison d'échouer l'upload, qui a réellement réussi.
  void indexAiDocument(document.id).catch((err) => {
    console.error('Déclenchement de l’indexation échoué :', err);
  });

  return document;
}

export interface IndexAiDocumentResult {
  status: 'ready';
  chunksCount: number;
}

/** Relance l'indexation — utilisé après un upload et pour réessayer un document en erreur. */
export async function indexAiDocument(documentId: string): Promise<IndexAiDocumentResult> {
  const response = await supabase.functions.invoke<IndexAiDocumentResult>('index-ai-document', {
    body: { documentId },
  });

  if (response.error) throw response.error;
  if (!response.data) throw new Error("La fonction d'indexation n'a renvoyé aucune donnée.");

  return response.data;
}

export async function updateAiDocument(
  id: string,
  patch: TablesUpdate<'ai_documents'>,
): Promise<AiDocument> {
  return unwrap(supabase.from('ai_documents').update(patch).eq('id', id).select('*').single());
}

/** Retire le document ET son fichier — la ligne seule laisserait un objet orphelin dans le bucket. */
export async function deleteAiDocument(document: Pick<AiDocument, 'id' | 'storage_path'>): Promise<void> {
  const { error } = await supabase.from('ai_documents').delete().eq('id', document.id);
  if (error) throw error;

  await supabase.storage.from(BUCKET).remove([document.storage_path]);
}

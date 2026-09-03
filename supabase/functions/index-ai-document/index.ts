import { CORS_HEADERS, adminClient, env, extractJwt, json } from '../_shared/billing.ts';
import { createEmbeddings, requireAiAccess, requireAiFeature } from '../_shared/ai.ts';
import { extractPdfChunks } from '../_shared/pdf.ts';

/**
 * Edge Function : pipeline d'indexation des documents de l'Assistant IA.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE PIPELINE (§ Phase 6)
 *
 *   1. Le client a DÉJÀ déposé le PDF dans le bucket `ai-documents` et créé la
 *      ligne `ai_documents` (statut `pending`) — cette fonction ne fait ni
 *      l'un ni l'autre, elle prend le relais ensuite.
 *   2. `processing`
 *   3. Téléchargement du fichier depuis Storage
 *   4. Extraction du texte + découpage (`_shared/pdf.ts`)
 *   5. Embeddings par lot (`_shared/ai.ts`)
 *   6. Remplacement des fragments existants (réindexation idempotente)
 *   7. `ready`, ou `error` avec un message exploitable
 *
 * Appelée SYNCHRONE depuis le client, comme `ai-assistant` : pas de file
 * d'attente ni de webhook Storage pour ce volume (documentation technique
 * d'une PME, déposée par un administrateur, pas un flux à haute fréquence).
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface RequestBody {
  documentId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Méthode non autorisée' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Authentification requise' }, 401);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corps de requête invalide.' }, 400);
  }

  const { documentId } = body;
  if (!documentId) {
    return json({ error: 'documentId est requis' }, 400);
  }

  const admin = adminClient();
  const jwt = extractJwt(authHeader);

  // Le document est lu AVANT toute vérification d'accès : c'est lui qui porte
  // l'organisation à vérifier, et `admin` contourne la RLS pour cette seule
  // lecture. Rien n'est modifié tant que `requireAiAccess`/`requireAiFeature`
  // n'ont pas répondu.
  const { data: document, error: documentError } = await admin
    .from('ai_documents')
    .select('id, organization_id, title, category, storage_path')
    .eq('id', documentId)
    .maybeSingle();

  if (documentError || !document) {
    return json({ error: 'Document introuvable.' }, 404);
  }

  const access = await requireAiAccess({
    admin,
    jwt,
    organizationId: document.organization_id,
    permission: 'ai.manage_documents',
  });
  if ('error' in access) return access.error;

  const feature = await requireAiFeature(admin, document.organization_id);
  if ('error' in feature) return feature.error;

  /** Bascule le document en erreur, avec un message exploitable pour l'administrateur qui l'a déposé. */
  async function markAsError(message: string): Promise<Response> {
    await admin
      .from('ai_documents')
      .update({ status: 'error', error_message: message })
      .eq('id', documentId);
    return json({ error: message }, 422);
  }

  await admin.from('ai_documents').update({ status: 'processing', error_message: null }).eq('id', documentId);

  try {
    // Lu À L'INTÉRIEUR du bloc `try` : une variable d'environnement absente
    // lève exactement comme un appel réseau qui échoue, et doit être
    // rattrapée par le même filet — jamais remonter en erreur brute sans
    // repasser le document en `error` avec un message exploitable.
    const openaiApiKey = env('OPENAI_API_KEY');

    const { data: fileBlob, error: downloadError } = await admin.storage
      .from('ai-documents')
      .download(document.storage_path);

    if (downloadError || !fileBlob) {
      console.error('Téléchargement du document échoué:', documentId, downloadError);
      return await markAsError('Impossible de récupérer le fichier déposé.');
    }

    const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());

    let chunks;
    try {
      chunks = await extractPdfChunks(fileBytes);
    } catch (extractionError) {
      console.error('Extraction PDF échouée:', documentId, extractionError);
      return await markAsError(
        extractionError instanceof Error
          ? extractionError.message
          : 'Le PDF est illisible ou ne contient aucun texte exploitable.',
      );
    }

    const embeddings = await createEmbeddings(
      chunks.map((chunk) => chunk.content),
      openaiApiKey,
    );

    // Réindexation idempotente : un document redéposé (correction, nouvelle
    // version) remplace intégralement ses fragments plutôt que de les
    // accumuler à côté de versions périmées.
    await admin.from('ai_document_chunks').delete().eq('document_id', documentId);

    const rows = chunks.map((chunk, index) => ({
      document_id: documentId,
      content: chunk.content,
      chunk_index: chunk.chunkIndex,
      embedding: embeddings[index],
      metadata: {
        page: chunk.page,
        document_title: document.title,
        ...(document.category ? { category: document.category } : {}),
      },
    }));

    const { error: insertError } = await admin.from('ai_document_chunks').insert(rows);
    if (insertError) {
      console.error('Insertion des fragments échouée:', documentId, insertError);
      return await markAsError("Échec de l'enregistrement des fragments indexés.");
    }

    await admin
      .from('ai_documents')
      .update({ status: 'ready', error_message: null })
      .eq('id', documentId);

    return json({ status: 'ready', chunksCount: rows.length });
  } catch (err) {
    console.error('Erreur inattendue index-ai-document:', documentId, err);
    return await markAsError('Erreur inattendue lors du traitement du document.');
  }
});

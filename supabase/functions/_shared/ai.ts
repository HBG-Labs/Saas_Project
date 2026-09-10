import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import { json } from './billing.ts';

/**
 * Socle commun à l'Assistant IA — configuration, embeddings, recherche
 * vectorielle, quota et appel au modèle de complétion.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONFIGURATION CENTRALISÉE (Phase 23)
 *
 * Un seul endroit pour le modèle, le seuil de similarité et les plafonds de
 * contexte — plutôt que ces valeurs dispersées dans `ai-assistant/index.ts`
 * et une future fonction d'indexation. Changer de modèle ou ajuster le seuil
 * de pertinence devient une ligne à modifier, pas une recherche dans le code.
 *
 * `AI_EMBEDDING_DIMENSIONS` DOIT rester aligné sur la colonne
 * `ai_document_chunks.embedding vector(1536)` (migration
 * `20260902150000_ai_assistant_documents.sql`) : changer de modèle
 * d'embedding exige de réindexer tous les documents, pas seulement de
 * modifier cette constante.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const AI_MODEL = 'gpt-5.6-luna';
export const AI_EMBEDDING_MODEL = 'text-embedding-3-small';
export const AI_EMBEDDING_DIMENSIONS = 1536;
export const AI_TOP_K = 8;
/*
  SEUIL DE SIMILARITE — MESURE, PAS INTUITION.

  Il valait 0.70, et rien ne remontait jamais : l'assistant repondait « aucun
  document indexe n'est disponible » alors que les documents etaient bien
  indexes, fragments et vecteurs compris.

  La mesure qui tranche : les DEUX FRAGMENTS D'UNE MEME FACTURE — meme
  document, meme vocabulaire, meme mise en page — obtiennent entre eux une
  similarite de 0.7146. A peine au-dessus du seuil.

  Une question d'utilisateur est formulee tout autrement que le texte qu'elle
  cherche : « combien ai-je paye ? » face a « INVOICE / Supabase Pte. Ltd. ».
  Si deux moities du meme document se qualifient de justesse, une question ne
  se qualifie jamais. Le seuil ne filtrait pas le bruit, il coupait tout.

  0.30 laisse passer ce qui est reellement proche sans ouvrir la porte au
  hors-sujet : le classement par distance et `AI_TOP_K` font le tri, le seuil
  ne sert qu'a ne rien injecter quand rien ne correspond.

  Avant de le relever, refaire la mesure ci-dessus. Un seuil trop haut ne
  produit aucune erreur : il rend seulement l'assistant amnesique.
*/
export const AI_SIMILARITY_THRESHOLD = 0.3;
export const AI_MAX_OUTPUT_TOKENS = 1200;

/** Tarif `gpt-5.6-luna`, en dollars par million de tokens. */
const AI_INPUT_PRICE_PER_MILLION = 0.2;
const AI_OUTPUT_PRICE_PER_MILLION = 1.2;

/**
 * Coût estimé d'un appel de complétion, pour `ai_usage.estimated_cost`.
 *
 * N'inclut PAS le coût de l'embedding de la question (négligeable : environ
 * cent fois moins cher que la complétion pour un volume de texte comparable)
 * — simplification assumée, sans incidence sur le quota lui-même, qui compte
 * des REQUÊTES et non des dollars (voir `ai_quota_status`).
 */
export function estimateCompletionCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * AI_INPUT_PRICE_PER_MILLION +
    (outputTokens / 1_000_000) * AI_OUTPUT_PRICE_PER_MILLION
  );
}

/** Nombre de textes envoyés par appel à l'API embeddings — voir `createEmbeddings`. */
const EMBEDDING_BATCH_SIZE = 64;

/**
 * Embeddings OpenAI d'un lot de textes, par lots de {@link EMBEDDING_BATCH_SIZE}.
 *
 * Seul point d'appel à `api.openai.com/v1/embeddings` du projet : la clé ne
 * transite nulle part ailleurs. Le lot plutôt qu'un appel par texte : indexer
 * un document de 80 fragments en 80 requêtes séquentielles serait lent et
 * inutilement coûteux en round-trips — l'endpoint accepte un tableau `input`
 * en une seule requête. Une réponse non-2xx ou une dimension inattendue lève
 * une erreur plutôt que de renvoyer un vecteur partiel — un embedding tronqué
 * pollue silencieusement toute recherche ultérieure sans qu'aucun symptôme
 * visible ne le signale.
 */
export async function createEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE);

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_EMBEDDING_MODEL,
        input: batch,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenAI embeddings a refusé la requête (${response.status}) : ${detail}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ index: number; embedding: number[] }>;
    };
    const rows = payload.data ?? [];

    if (rows.length !== batch.length) {
      throw new Error(
        `OpenAI embeddings a renvoyé ${rows.length} vecteur(s) pour ${batch.length} texte(s) envoyés.`,
      );
    }

    // L'API garantit l'ordre, mais trier par `index` coûte peu et élimine
    // toute dépendance à cette garantie non documentée comme contractuelle.
    for (const row of [...rows].sort((a, b) => a.index - b.index)) {
      if (row.embedding.length !== AI_EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Embedding OpenAI de dimension inattendue (${row.embedding.length}, attendu ${AI_EMBEDDING_DIMENSIONS}).`,
        );
      }
      embeddings.push(row.embedding);
    }
  }

  return embeddings;
}

/** Embedding d'un texte unique — la question posée à l'assistant, par exemple. */
export async function createEmbedding(text: string, apiKey: string): Promise<number[]> {
  const [embedding] = await createEmbeddings([text], apiKey);
  if (!embedding) {
    throw new Error('OpenAI embeddings a renvoyé une réponse vide.');
  }
  return embedding;
}

export interface DocumentChunkMatch {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

/**
 * Recherche vectorielle des fragments documentaires pertinents pour une
 * question, filtrés par organisation.
 *
 * Passe TOUJOURS par le RPC `match_ai_document_chunks` (schéma `public` —
 * voir `20260902170000_ai_assistant_public_rpc.sql`, qui corrige leur
 * emplacement d'origine dans `app`, non exposé par PostgREST). Jamais un
 * `select` direct sur `ai_document_chunks` : ce serait contourner le filtre
 * organisationnel que porte la fonction elle-même, pas seulement la policy
 * RLS de lecture.
 *
 * Une erreur RPC renvoie un tableau vide plutôt que de lever : l'absence de
 * contexte documentaire n'est pas fatale pour le contexte métier (Phase 12),
 * qui reste utilisable seul.
 */
export async function searchDocumentChunks(params: {
  admin: SupabaseClient;
  organizationId: string;
  query: string;
  openaiApiKey: string;
}): Promise<DocumentChunkMatch[]> {
  const embedding = await createEmbedding(params.query, params.openaiApiKey);

  const { data, error } = await params.admin.rpc('match_ai_document_chunks', {
    p_organization_id: params.organizationId,
    p_query_embedding: embedding,
    p_match_threshold: AI_SIMILARITY_THRESHOLD,
    p_match_count: AI_TOP_K,
  });

  if (error) {
    console.error('Erreur recherche vectorielle ai-assistant:', error);
    return [];
  }

  return (
    (data ?? []) as Array<{
      id: string;
      document_id: string;
      content: string;
      metadata: Record<string, unknown> | null;
      similarity: number;
    }>
  ).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    content: row.content,
    metadata: row.metadata ?? {},
    similarity: row.similarity,
  }));
}

export interface AiQuotaStatus {
  used: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
}

export interface AiQuotaReservation {
  id: string;
  usedBefore: number;
  limit: number | null;
  remainingAfter: number | null;
  unlimited: boolean;
}

/**
 * Réserve atomiquement une place du quota avant l'appel payant.
 *
 * `null` signifie soit quota épuisé, soit accès/plan refusé. L'appelant a déjà
 * produit les messages précis d'autorisation ; ici on ne rouvre aucune porte.
 */
export async function reserveAiUsage(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<AiQuotaReservation | null> {
  const { data, error } = await admin
    .rpc('reserve_ai_usage', {
      p_organization_id: organizationId,
      p_user_id: userId,
    })
    .maybeSingle();

  if (error) {
    console.error('Réservation du quota IA impossible:', error);
    throw new Error('Quota IA momentanément indisponible.');
  }
  if (!data) return null;

  const row = data as {
    reservation_id: string;
    used_before: number;
    quota_limit: number | null;
    remaining_after: number | null;
    unlimited: boolean;
  };

  return {
    id: row.reservation_id,
    usedBefore: row.used_before,
    limit: row.quota_limit,
    remainingAfter: row.remaining_after,
    unlimited: row.unlimited,
  };
}

/** Rend une réservation si aucun appel payant n'a finalement eu lieu. */
export async function releaseAiUsage(
  admin: SupabaseClient,
  reservationId: string,
  organizationId: string,
  userId: string,
): Promise<void> {
  const { error } = await admin
    .from('ai_usage')
    .delete()
    .eq('id', reservationId)
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('request_type', 'chat_reserved');

  if (error) console.error('Libération de la réservation IA échouée:', error);
}

/** Convertit la réservation en consommation réelle après la réponse OpenAI. */
export async function finalizeAiUsage(params: {
  admin: SupabaseClient;
  reservationId: string;
  organizationId: string;
  userId: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const { error } = await params.admin
    .from('ai_usage')
    .update({
      request_type: 'chat',
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      estimated_cost: estimateCompletionCost(params.inputTokens, params.outputTokens),
    })
    .eq('id', params.reservationId)
    .eq('organization_id', params.organizationId)
    .eq('user_id', params.userId)
    .eq('request_type', 'chat_reserved');

  // On ne supprime surtout pas la réservation en cas d'échec de finalisation :
  // l'appel a déjà coûté de l'argent et doit continuer de compter dans le quota.
  if (error) console.error('Finalisation de la consommation IA échouée:', error);
}

/**
 * Consommation IA du mois civil en cours, comparée au plafond du plan.
 *
 * DOIT être appelée AVANT tout appel au modèle — jamais après, sans quoi le
 * quota se vérifie sur la consommation d'hier, pas sur celle qui s'apprête à
 * survenir. `null` signale une erreur de lecture (organisation introuvable,
 * fonction injoignable) : l'appelant décide alors s'il refuse par prudence ou
 * laisse passer en mode dégradé — jamais cette fonction elle-même.
 */
export async function getAiQuotaStatus(
  admin: SupabaseClient,
  organizationId: string,
): Promise<AiQuotaStatus | null> {
  const { data, error } = await admin
    .rpc('ai_quota_status', { p_organization_id: organizationId })
    .maybeSingle();

  if (error || !data) {
    console.error('Erreur lecture quota IA:', error);
    return null;
  }

  const row = data as {
    used: number;
    quota_limit: number | null;
    remaining: number | null;
    unlimited: boolean;
  };

  return {
    used: row.used,
    limit: row.quota_limit,
    remaining: row.remaining,
    unlimited: row.unlimited,
  };
}

export interface ChatCompletionResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Appel du modèle de complétion.
 *
 * Un seul fournisseur — le repli Gemini précédemment présent dans
 * `ai-assistant/index.ts` a été retiré par décision explicite (02/09/2026) :
 * plus simple à raisonner et à sécuriser qu'un double fournisseur, pour un
 * gain de résilience jugé marginal ici.
 *
 * Une réponse vide ou un statut non-2xx lève : c'est à l'appelant de décider
 * du repli (mode dégradé côté client, Phase 17), jamais à cette fonction de
 * masquer l'échec derrière une chaîne vide qui se rendrait à l'écran.
 */
export async function createChatCompletion(params: {
  apiKey: string;
  systemPrompt: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  query: string;
}): Promise<ChatCompletionResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: params.systemPrompt },
        ...params.history,
        { role: 'user', content: params.query },
      ],
      // `gpt-5.6-luna` (famille de modèles à effort de raisonnement
      // réglable) refuse les deux réglages classiques — confirmé par deux
      // appels réels distincts, pas par la documentation :
      //   • `max_tokens` → "Use 'max_completion_tokens' instead."
      //   • `temperature: 0.2` → "Only the default (1) value is supported."
      // Aucun des deux n'est donc envoyé ; le modèle tourne à ses réglages
      // par défaut.
      max_completion_tokens: AI_MAX_OUTPUT_TOKENS,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI a refusé la requête (${response.status}) : ${detail}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = payload.choices?.[0]?.message?.content ?? '';
  if (!content) {
    throw new Error('OpenAI a renvoyé une réponse vide.');
  }

  return {
    content,
    inputTokens: payload.usage?.prompt_tokens ?? 0,
    outputTokens: payload.usage?.completion_tokens ?? 0,
  };
}

export interface AiAccessContext {
  userId: string;
  organizationId: string;
  role: string;
}

/**
 * Vérifie qu'un utilisateur authentifié peut agir sur l'Assistant IA d'une
 * organisation, et avec quel niveau : `ai.use` pour poser une question,
 * `ai.manage_documents` pour déposer/retirer un document.
 *
 * Trois conditions, TOUJOURS dans cet ordre — chacune répond « non » avant que
 * la suivante ait besoin d'être évaluée, pour ne jamais renseigner par la
 * durée de réponse si une organisation existe ou non :
 *   1. le jeton désigne un utilisateur réel ;
 *   2. cet utilisateur appartient bien à l'organisation visée ;
 *   3. son rôle porte la permission demandée.
 *
 * Ne vérifie PAS ici la fonctionnalité du plan (`ai_assistant` dans
 * `plan_features`) : c'est distinct de « qui a le droit », et les appelants
 * qui doivent aussi refuser une formule qui n'inclut pas l'Assistant IA
 * appellent `requireAiFeature` en plus.
 *
 * Interroge `organization_members` et `role_permissions` directement plutôt
 * que `app.has_org_permission` : cette dernière est `security definer` mais
 * vit dans le schéma `app`, non exposé par PostgREST (voir
 * `20260902170000_ai_assistant_public_rpc.sql`) — un `.rpc()` depuis
 * supabase-js échouerait exactement de la même façon que les deux fonctions
 * que cette migration a dû déplacer.
 */
export async function requireAiAccess(params: {
  admin: SupabaseClient;
  jwt: string;
  organizationId: string;
  permission: 'ai.use' | 'ai.manage_documents';
}): Promise<{ context: AiAccessContext } | { error: Response }> {
  const { data: authData, error: authError } = await params.admin.auth.getUser(params.jwt);
  if (authError || !authData?.user) {
    return { error: json({ error: 'Session utilisateur invalide ou expirée.' }, 401) };
  }
  const userId = authData.user.id;

  const { data: membership } = await params.admin
    .from('organization_members')
    .select('role, status')
    .eq('organization_id', params.organizationId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) {
    return { error: json({ error: 'Accès non autorisé à cette organisation.' }, 403) };
  }

  const { data: permissionRow } = await params.admin
    .from('role_permissions')
    .select('permission')
    .eq('role', membership.role)
    .eq('permission', params.permission)
    .maybeSingle();

  if (!permissionRow) {
    return {
      error: json({ error: "Vous n'avez pas la permission nécessaire pour cette action." }, 403),
    };
  }

  return {
    context: { userId, organizationId: params.organizationId, role: membership.role },
  };
}

/**
 * La formule de l'organisation inclut-elle l'Assistant IA ?
 *
 * Relit `organizations.plan_code` — un cache maintenu par trigger depuis
 * `subscriptions` (voir `20260808100300_billing.sql`), pas la table
 * `subscriptions` elle-même : c'est exactement ce que lit
 * `app.org_plan_code`, en évitant d'en reproduire la logique de résolution
 * (essai en cours, `past_due` toléré...) alors que le résultat est déjà
 * disponible en une colonne. Même contrainte d'exposition PostgREST que
 * `requireAiAccess` ci-dessus : aucune fonction du schéma `app` n'est
 * appelable ici, donc lecture directe des tables plutôt qu'un
 * `app.org_has_feature`.
 */
export async function requireAiFeature(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ ok: true } | { error: Response }> {
  const { data: org } = await admin
    .from('organizations')
    .select('plan_code')
    .eq('id', organizationId)
    .maybeSingle();

  const planCode = org?.plan_code ?? 'free';

  const { data: feature } = await admin
    .from('plan_features')
    .select('limit_value')
    .eq('plan_code', planCode)
    .eq('feature_key', 'ai_assistant')
    .maybeSingle();

  const included = feature != null && (feature.limit_value === null || feature.limit_value > 0);

  if (!included) {
    return {
      error: json(
        {
          error: 'AI_FEATURE_NOT_INCLUDED',
          message: "Cette formule ne comprend pas l'Assistant IA.",
        },
        403,
      ),
    };
  }

  return { ok: true };
}

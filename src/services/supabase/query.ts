import { AppError, mapPostgrestError, type SupabaseLikeError } from '@/lib/errors';

/**
 * Réponse minimale d'un builder PostgREST.
 * Typée localement pour éviter de dépendre des internes de supabase-js.
 */
interface PostgrestLikeResponse {
  data: unknown;
  error: SupabaseLikeError | null;
}

/**
 * Type de la donnée portée par une réponse.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE DÉTOUR PLUTÔT QU'UN SIMPLE `<T>` SUR `data: T | null`
 *
 * supabase-js ne renvoie pas un objet mais une UNION discriminée :
 *
 *     { data: Row;  error: null }          — succès
 *   | { data: null; error: PostgrestError } — échec
 *
 * Confronter cette union à `data: T | null` fait échouer l'inférence : la
 * première branche propose `T = Row`, la seconde `T = never`, et TypeScript
 * retient `never`. Le résultat perd alors tout type, silencieusement.
 *
 * Le défaut était invisible parce que tous les appelants annotent leur valeur
 * de retour — `Promise<Plan | null>` absorbe `never | null`. Il s'est révélé au
 * premier appel qui lisait une propriété du résultat sans l'annoter.
 *
 * `infer` distribué sur l'union règle le cas : chaque branche donne son `data`,
 * `null` est écarté, et l'union des restes est le type de ligne attendu.
 * ─────────────────────────────────────────────────────────────────────────────
 */
type RowOf<R> = R extends { data: infer D } ? Exclude<D, null> : never;

/**
 * Déballe une requête Supabase : renvoie les données ou lance une AppError.
 *
 * Sans cet utilitaire, chaque appel dupliquerait le même bloc
 * `if (error) throw ...` — et un oubli laisserait passer un `null` silencieux.
 */
export async function unwrap<R extends PostgrestLikeResponse>(
  query: PromiseLike<R>,
): Promise<RowOf<R>> {
  const { data, error } = await query;

  if (error) throw mapPostgrestError(error);

  if (data === null) {
    throw new AppError('not_found', 'La ressource demandée est introuvable.');
  }

  return data as RowOf<R>;
}

/**
 * Variante tolérante à l'absence de résultat : `null` est une réponse valide.
 * À utiliser pour les recherches par identifiant qui peuvent légitimement
 * ne rien trouver.
 */
export async function unwrapMaybe<R extends PostgrestLikeResponse>(
  query: PromiseLike<R>,
): Promise<RowOf<R> | null> {
  const { data, error } = await query;

  if (error) {
    // PGRST116 = « aucune ligne » sur un .single() : attendu ici, pas une erreur.
    if (error.code === 'PGRST116') return null;
    throw mapPostgrestError(error);
  }

  return (data ?? null) as RowOf<R> | null;
}

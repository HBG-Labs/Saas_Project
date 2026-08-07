import { AppError, mapPostgrestError, type SupabaseLikeError } from '@/lib/errors';

/**
 * Réponse minimale d'un builder PostgREST.
 * Typée localement pour éviter de dépendre des internes de supabase-js.
 */
interface PostgrestLikeResponse<T> {
  data: T | null;
  error: SupabaseLikeError | null;
}

/**
 * Déballe une requête Supabase : renvoie les données ou lance une AppError.
 *
 * Sans cet utilitaire, chaque appel dupliquerait le même bloc
 * `if (error) throw ...` — et un oubli laisserait passer un `null` silencieux.
 */
export async function unwrap<T>(query: PromiseLike<PostgrestLikeResponse<T>>): Promise<T> {
  const { data, error } = await query;

  if (error) throw mapPostgrestError(error);

  if (data === null) {
    throw new AppError('not_found', 'La ressource demandée est introuvable.');
  }

  return data;
}

/**
 * Variante tolérante à l'absence de résultat : `null` est une réponse valide.
 * À utiliser pour les recherches par identifiant qui peuvent légitimement
 * ne rien trouver.
 */
export async function unwrapMaybe<T>(
  query: PromiseLike<PostgrestLikeResponse<T>>,
): Promise<T | null> {
  const { data, error } = await query;

  if (error) {
    // PGRST116 = « aucune ligne » sur un .single() : attendu ici, pas une erreur.
    if (error.code === 'PGRST116') return null;
    throw mapPostgrestError(error);
  }

  return data;
}

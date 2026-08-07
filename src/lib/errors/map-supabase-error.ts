import { AppError, type AppErrorCode } from './app-error';

/**
 * Forme minimale commune aux erreurs PostgREST et GoTrue.
 * On ne dépend pas des types de @supabase/supabase-js ici pour garder `lib/`
 * indépendant de toute librairie tierce (cf. ARCHITECTURE.md).
 */
export interface SupabaseLikeError {
  message: string;
  code?: string | undefined;
  status?: number | undefined;
}

/** Messages utilisateur — jamais le message brut de Postgres. */
const MESSAGES: Record<AppErrorCode, string> = {
  unauthenticated: 'Vous devez être connecté pour effectuer cette action.',
  forbidden: "Vous n'avez pas les droits nécessaires pour accéder à cette ressource.",
  not_found: 'La ressource demandée est introuvable.',
  conflict: 'Cet élément existe déjà.',
  validation: 'Les données envoyées sont invalides.',
  network: 'Connexion au serveur impossible. Vérifiez votre accès à Internet.',
  unknown: "Une erreur inattendue s'est produite.",
};

/**
 * Traduit une erreur PostgREST en AppError.
 *
 * Les champs `details` et `hint` de Postgres ne sont volontairement jamais
 * repris : ils divulguent la structure de la base.
 */
export function mapPostgrestError(error: SupabaseLikeError): AppError {
  const code = mapPostgrestCode(error);
  return new AppError(code, MESSAGES[code], { cause: error });
}

function mapPostgrestCode(error: SupabaseLikeError): AppErrorCode {
  switch (error.code) {
    case '23505': // unique_violation
      return 'conflict';
    case '23503': // foreign_key_violation
    case '23502': // not_null_violation
    case '22P02': // invalid_text_representation
      return 'validation';
    case '42501': // insufficient_privilege — typiquement un refus RLS
      return 'forbidden';
    case 'PGRST116': // aucune ligne retournée alors qu'une seule était attendue
      return 'not_found';
    default:
      break;
  }

  if (error.status === 401) return 'unauthenticated';
  if (error.status === 403) return 'forbidden';
  if (error.status === 404) return 'not_found';
  if (error.status === 409) return 'conflict';
  if (error.status !== undefined && error.status >= 500) return 'network';

  return 'unknown';
}

/** Traduit une erreur d'authentification (GoTrue) en AppError. */
export function mapAuthError(error: SupabaseLikeError): AppError {
  if (error.status === 400 || error.code === 'invalid_credentials') {
    return new AppError('validation', 'Identifiants incorrects.', { cause: error });
  }
  if (error.status === 401) {
    return new AppError('unauthenticated', MESSAGES.unauthenticated, { cause: error });
  }
  if (error.status === 422) {
    return new AppError('validation', MESSAGES.validation, { cause: error });
  }
  if (error.status === 429) {
    return new AppError('network', 'Trop de tentatives. Réessayez dans quelques instants.', {
      cause: error,
    });
  }

  return new AppError('unknown', MESSAGES.unknown, { cause: error });
}

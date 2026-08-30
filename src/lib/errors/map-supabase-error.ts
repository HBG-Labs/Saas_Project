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
 * Motifs des messages produits par PostgreSQL lui-même.
 *
 * Ils nomment tables, colonnes, contraintes et policies — « new row violates
 * row-level security policy for table "missions" ». Les afficher divulguerait
 * la structure de la base à qui provoque une erreur exprès.
 */
const POSTGRES_INTERNALS = /violates|constraint|relation\s|column\s|duplicate key|permission denied/i;

/**
 * Message écrit POUR être lu, s'il y en a un.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CETTE EXCEPTION À LA RÈGLE
 *
 * Les triggers du schéma lèvent des messages rédigés en français, à l'intention
 * de l'utilisateur : « Transition interdite : in_progress → submitted. »,
 * « Impossible de retirer le dernier propriétaire de l'organisation. »,
 * « Le quota de membres de votre formule est atteint. »
 *
 * Les remplacer par « une erreur inattendue s'est produite » gaspille la seule
 * information utile — celle qui dit quoi faire ensuite. L'utilisateur reste
 * bloqué sans savoir pourquoi.
 *
 * Le filtre reste strict : tout message portant la signature de PostgreSQL est
 * écarté. Ne passent que les phrases que nous avons nous-mêmes écrites.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function readableMessage(error: SupabaseLikeError): string | null {
  const message = error.message?.trim();

  if (message === undefined || message === '') return null;
  if (POSTGRES_INTERNALS.test(message)) return null;

  return message;
}

/**
 * Traduit une erreur PostgREST en AppError.
 *
 * Les champs `details` et `hint` de Postgres ne sont volontairement jamais
 * repris : ils divulguent la structure de la base. Le `message`, lui, n'est
 * retenu que s'il vient d'un de nos triggers — voir `readableMessage`.
 */
export function mapPostgrestError(error: SupabaseLikeError): AppError {
  const code = mapPostgrestCode(error);

  // `23514` (check_violation) et `42501` (insufficient_privilege) sont les deux
  // codes que nos triggers emploient pour refuser une opération en l'expliquant.
  const carriesBusinessRule = error.code === '23514' || error.code === '42501';
  const message = (carriesBusinessRule ? readableMessage(error) : null) ?? MESSAGES[code];

  return new AppError(code, message, { cause: error });
}

function mapPostgrestCode(error: SupabaseLikeError): AppErrorCode {
  switch (error.code) {
    case '23505': // unique_violation
      return 'conflict';
    // `23514` (check_violation) est une contrainte CHECK, mais AUSSI le code que
    // nos triggers emploient pour refuser une opération — transition de statut
    // interdite, dernier propriétaire, quota de membres. Sans cette entrée, ces
    // refus parfaitement explicites tombaient en « erreur inattendue ».
    case '23503': // foreign_key_violation
    case '23502': // not_null_violation
    case '22P02': // invalid_text_representation
    case '23514': // check_violation
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
  const msg = (error.message ?? '').toLowerCase();
  const code = (error.code ?? '').toLowerCase();

  if (
    code === 'same_password' ||
    msg.includes('should be different') ||
    msg.includes('same password') ||
    msg.includes('same as the old password')
  ) {
    return new AppError(
      'validation',
      "Le nouveau mot de passe doit être différent de l'ancien mot de passe.",
      { cause: error },
    );
  }

  if (
    code === 'weak_password' ||
    msg.includes('weak password') ||
    msg.includes('password should be at least') ||
    msg.includes('pwned')
  ) {
    return new AppError(
      'validation',
      'Le mot de passe est trop simple ou ne respecte pas les critères de sécurité.',
      { cause: error },
    );
  }

  if (
    msg.includes('error sending confirmation email') ||
    msg.includes('error sending email') ||
    msg.includes('smtp') ||
    code === 'email_provider_disabled' ||
    code === 'email_address_invalid'
  ) {
    return new AppError(
      'validation',
      "Impossible d'envoyer l'e-mail de confirmation. Veuillez renseigner une adresse e-mail valide (ex. @gmail.com, @entreprise.fr) ou réessayer dans quelques minutes.",
      { cause: error },
    );
  }

  if (
    msg.includes('already registered') ||
    msg.includes('user already exists') ||
    code === 'user_already_exists'
  ) {
    return new AppError('conflict', 'Cette adresse e-mail est déjà utilisée. Connectez-vous.', {
      cause: error,
    });
  }

  if (error.status === 400 || code === 'invalid_credentials') {
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

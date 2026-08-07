/**
 * Erreur applicative normalisée.
 *
 * Toute erreur qui remonte jusqu'à l'UI doit être une AppError : son `message`
 * est sûr à afficher, contrairement aux erreurs brutes de PostgREST qui
 * exposent des détails de schéma (noms de tables, contraintes, requêtes).
 */
export type AppErrorCode =
  'unauthenticated' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'network' | 'unknown';

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;

    // Nécessaire pour que `instanceof AppError` fonctionne après transpilation.
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convertit n'importe quelle valeur lancée en AppError affichable.
 * Utilisé en dernier recours par les frontières d'erreur.
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (error instanceof Error) {
    return new AppError('unknown', "Une erreur inattendue s'est produite.", { cause: error });
  }

  return new AppError('unknown', "Une erreur inattendue s'est produite.", { cause: error });
}

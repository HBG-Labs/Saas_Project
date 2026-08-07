import { Button } from '@/components/ui/Button';
import { toAppError } from '@/lib/errors';

interface ErrorFallbackProps {
  error: unknown;
  reset?: (() => void) | undefined;
  title?: string;
}

/**
 * Écran d'erreur pleine page (frontière racine et `errorElement` des routes).
 *
 * Le message affiché provient toujours d'une `AppError` : jamais le message
 * brut d'une erreur technique, qui pourrait divulguer la structure de la base.
 */
export function ErrorFallback({
  error,
  reset,
  title = 'Une erreur est survenue',
}: ErrorFallbackProps) {
  const appError = toAppError(error);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center"
    >
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-content-muted text-sm">{appError.message}</p>

      <div className="flex gap-2">
        {reset ? (
          <Button onClick={reset} variant="primary">
            Réessayer
          </Button>
        ) : null}
        <Button onClick={() => (window.location.href = '/')} variant="secondary">
          Retour à l&apos;accueil
        </Button>
      </div>
    </div>
  );
}

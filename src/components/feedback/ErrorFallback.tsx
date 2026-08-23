import { useState } from 'react';
import { useRouteError } from 'react-router';

import { Button } from '@/components/ui/Button';
import { toAppError } from '@/lib/errors';

interface ErrorFallbackProps {
  error?: unknown;
  reset?: (() => void) | undefined;
  title?: string;
}

/**
 * Écran d'erreur pleine page (frontière racine et `errorElement` des routes).
 */
export function ErrorFallback({
  error,
  reset,
  title = 'Une erreur est survenue',
}: ErrorFallbackProps) {
  const routeError = useRouteError();
  const rawError = error ?? routeError;
  const appError = toAppError(rawError);
  const [showDetails, setShowDetails] = useState(false);

  const rawMessage =
    rawError instanceof Error
      ? rawError.message
      : typeof rawError === 'object' && rawError !== null && 'statusText' in rawError
        ? String((rawError as any).statusText)
        : null;

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center"
    >
      <div className="size-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-black text-xl mb-2">
        !
      </div>
      <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="text-muted-foreground text-sm">
        {rawMessage || appError.message}
      </p>

      {rawError instanceof Error && rawError.stack && (
        <div className="w-full text-left">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-primary underline mb-2 cursor-pointer"
          >
            {showDetails ? 'Masquer les détails techniques' : 'Afficher les détails techniques'}
          </button>
          {showDetails && (
            <pre className="p-3 bg-slate-900 text-slate-200 text-3xs font-mono rounded-lg overflow-x-auto max-h-48 whitespace-pre-wrap">
              {rawError.stack}
            </pre>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-2">
        {reset ? (
          <Button onClick={reset} variant="primary">
            Réessayer
          </Button>
        ) : (
          <Button onClick={() => window.location.reload()} variant="primary">
            Recharger la page
          </Button>
        )}
        <Button onClick={() => (window.location.href = '/')} variant="secondary">
          Retour à l&apos;accueil
        </Button>
      </div>
    </div>
  );
}


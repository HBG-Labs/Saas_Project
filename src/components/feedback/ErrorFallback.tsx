import { useState } from 'react';
import { useRouteError } from 'react-router';

import { Button } from '@/components/ui/Button';
import { isChunkLoadError } from '@/lib/chunk-load-recovery';
import { toAppError } from '@/lib/errors';

import { StatusVisual } from './StatusVisual';

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
  const chunkLoadFailed = isChunkLoadError(rawError);

  const displayedTitle = chunkLoadFailed ? 'Actualisation nécessaire' : title;
  const displayedMessage = chunkLoadFailed
    ? 'Cette page n’a pas pu être chargée après une mise à jour ou une coupure réseau. Actualisez REZO360 pour continuer. Vos données sont conservées.'
    : appError.message;

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[60dvh] max-w-lg items-center justify-center px-4 py-10"
    >
      <div className="border-border/80 bg-surface/95 shadow-overlay w-full rounded-3xl border p-5 sm:p-6">
        <div className="flex items-center gap-3.5">
          <StatusVisual kind={chunkLoadFailed ? 'refresh' : 'error'} />
          <div className="min-w-0">
            <p className="text-primary text-3xs font-extrabold tracking-[0.08em] uppercase">
              Petit contretemps
            </p>
            <h1 className="text-foreground mt-0.5 text-lg leading-tight font-extrabold tracking-tight">
              {displayedTitle}
            </h1>
          </div>
        </div>

        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">{displayedMessage}</p>

        {import.meta.env.DEV && rawError instanceof Error && rawError.stack && (
          <div className="border-border mt-4 border-t pt-3 text-left">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-primary atelier-touch-target cursor-pointer text-xs font-semibold underline underline-offset-4"
            >
              {showDetails ? 'Masquer les détails techniques' : 'Afficher les détails techniques'}
            </button>
            {showDetails && (
              <pre className="bg-surface-sunken text-muted-foreground text-3xs mt-2 max-h-48 overflow-x-auto rounded-xl p-3 font-mono whitespace-pre-wrap">
                {rawError.stack}
              </pre>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {chunkLoadFailed ? (
            <Button onClick={() => window.location.reload()} variant="primary">
              Actualiser REZO360
            </Button>
          ) : reset ? (
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

        <p className="text-subtle-foreground mt-3 text-center text-xs">
          Vos données restent en sécurité.
        </p>
      </div>
    </div>
  );
}

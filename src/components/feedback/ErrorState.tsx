import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { toAppError } from '@/lib/errors';

import { StatusVisual } from './StatusVisual';

export interface ErrorStateProps {
  error: unknown;
  onRetry?: (() => unknown) | undefined;
  title?: string;
  className?: string;
}

/**
 * État d'erreur intégré dans une zone de contenu.
 *
 * À distinguer d'`ErrorFallback`, qui occupe la page entière. Celui-ci sert
 * quand seule une section a échoué et que le reste de l'écran reste valide.
 *
 * Le message affiché provient d'une `AppError` : jamais le message technique
 * brut, qui divulguerait la structure de la base.
 */
export function ErrorState({
  error,
  onRetry,
  title = 'Chargement impossible',
  className,
}: ErrorStateProps) {
  const appError = toAppError(error);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } catch {
      // L'erreur actualisée reste présentée par le composant appelant.
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className={cn(
        'border-border/80 bg-surface/75 flex flex-col items-center gap-3 rounded-2xl border px-4 py-5 text-center shadow-xs sm:flex-row sm:px-5 sm:text-left',
        className,
      )}
    >
      <StatusVisual kind="error" className="size-12 rounded-xl" />

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-foreground text-sm font-bold">{title}</p>
        <p className="text-muted-foreground max-w-lg text-xs leading-relaxed">{appError.message}</p>
      </div>

      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          isLoading={isRetrying}
          loadingLabel="Nouvelle tentative en cours"
          onClick={() => void handleRetry()}
          className="sm:self-center"
        >
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}

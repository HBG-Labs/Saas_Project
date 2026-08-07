import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { toAppError } from '@/lib/errors';

export interface ErrorStateProps {
  error: unknown;
  onRetry?: (() => void) | undefined;
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

  return (
    <div
      role="alert"
      className={cn(
        'border-error-border bg-error-subtle flex flex-col items-center gap-3 rounded-lg border px-6 py-10 text-center',
        className,
      )}
    >
      <AlertTriangle className="text-error size-5" aria-hidden="true" />

      <div className="space-y-1">
        <p className="text-foreground text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto max-w-sm text-xs">{appError.message}</p>
      </div>

      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}

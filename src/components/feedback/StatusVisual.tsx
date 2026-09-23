import { AlertTriangle, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/cn';

type StatusVisualKind = 'error' | 'loading' | 'refresh';

interface StatusVisualProps {
  kind: StatusVisualKind;
  className?: string;
}

/**
 * Repère visuel commun aux états transitoires et aux incidents.
 *
 * Le texte adjacent porte toujours le sens : ce dessin reste décoratif. La
 * rotation lente et la vague sont automatiquement neutralisées lorsque la
 * réduction des mouvements est demandée au système.
 */
export function StatusVisual({ kind, className }: StatusVisualProps) {
  const Icon = kind === 'refresh' ? RefreshCw : AlertTriangle;

  return (
    <span
      aria-hidden="true"
      data-status-visual={kind}
      className={cn(
        'relative isolate flex size-14 shrink-0 items-center justify-center rounded-2xl border',
        kind === 'error'
          ? 'border-error-border/80 bg-error-subtle text-error'
          : 'border-primary/15 bg-primary-subtle/70 text-primary',
        className,
      )}
    >
      <span
        className={cn(
          'rezo-status-orbit absolute inset-2 rounded-full border border-dashed',
          kind === 'error' ? 'border-error/25' : 'border-primary/25',
        )}
      />

      {kind === 'loading' ? (
        <span className="rezo-status-wave relative flex h-5 items-end gap-0.5">
          <span />
          <span />
          <span />
          <span />
        </span>
      ) : (
        <Icon className="relative size-5" strokeWidth={2} />
      )}
    </span>
  );
}

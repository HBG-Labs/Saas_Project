import { StatusVisual } from './StatusVisual';

interface LoadingScreenProps {
  label?: string;
  /** `page` occupe la hauteur d'écran ; `inline` s'insère dans une zone. */
  variant?: 'page' | 'inline';
}

/**
 * Indicateur de chargement.
 *
 * `role="status"` + `aria-live="polite"` : le changement d'état est annoncé aux
 * lecteurs d'écran, qui ne perçoivent pas l'animation (§12).
 */
export function LoadingScreen({ label = 'Chargement…', variant = 'page' }: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        variant === 'page'
          ? 'flex min-h-[60dvh] items-center justify-center px-4 py-10'
          : 'flex items-center justify-center py-8'
      }
    >
      <div
        className={
          variant === 'page'
            ? 'border-border/80 bg-surface/90 shadow-raised flex w-full max-w-xs items-center gap-3.5 rounded-2xl border px-4 py-3.5'
            : 'flex items-center gap-3'
        }
      >
        <StatusVisual kind="loading" className={variant === 'inline' ? 'size-11 rounded-xl' : ''} />
        <div className="min-w-0 text-left">
          {variant === 'page' ? (
            <p className="text-primary text-3xs font-extrabold tracking-[0.08em] uppercase">
              REZO360
            </p>
          ) : null}
          <p className="text-muted-foreground text-sm font-medium">{label}</p>
        </div>
      </div>
    </div>
  );
}

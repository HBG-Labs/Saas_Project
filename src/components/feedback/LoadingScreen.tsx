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
          ? 'flex min-h-[60dvh] flex-col items-center justify-center gap-3'
          : 'flex items-center justify-center gap-3 py-8'
      }
    >
      <span
        aria-hidden="true"
        className="border-border border-t-brand-600 size-6 animate-spin rounded-full border-2"
      />
      <span className="text-content-muted text-sm">{label}</span>
    </div>
  );
}

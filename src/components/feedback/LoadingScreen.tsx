import './loading-screen.css';

interface LoadingScreenProps {
  label?: string;
  /** `page` occupe la hauteur d'écran ; `inline` s'insère dans une zone. */
  variant?: 'page' | 'inline';
  /** Point discret pour une vérification ; aperçu pour l'ouverture d'un espace. */
  appearance?: 'quiet' | 'workspace';
}

/**
 * Indicateur de chargement.
 *
 * `role="status"` + `aria-live="polite"` : le changement d'état est annoncé aux
 * lecteurs d'écran, qui ne perçoivent pas l'animation (§12).
 */
export function LoadingScreen({
  label,
  variant = 'page',
  appearance = 'quiet',
}: LoadingScreenProps) {
  const workspace = appearance === 'workspace' && variant === 'page';
  const message = label ?? (workspace ? 'Préparation de vos informations…' : 'Chargement…');

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={
        variant === 'page' ? 'rezo-loading rezo-loading--page' : 'rezo-loading rezo-loading--inline'
      }
    >
      {workspace ? (
        <div className="rezo-loading-workspace">
          <p className="rezo-loading-title">Votre espace de travail</p>
          <div className="rezo-loading-lines" data-status-visual="loading" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="rezo-loading-message">{message}</p>
        </div>
      ) : (
        <div className="rezo-loading-quiet">
          <span className="rezo-loading-dot" data-status-visual="loading" aria-hidden="true" />
          <div>
            {variant === 'page' ? <p className="rezo-loading-title">Un instant…</p> : null}
            <p className="rezo-loading-message">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

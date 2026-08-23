import { Link } from 'react-router';

import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

/**
 * Marque REZO360.
 *
 * Pas de logotype graphique en Phase 2 : un symbole mal dessiné nuit plus qu'il
 * n'apporte. Le contraste typographique entre les deux moitiés du nom suffit à
 * créer une identité reconnaissable.
 */
export function Logo({
  className,
  showIcon = true,
  to = ROUTES.home,
}: {
  className?: string;
  showIcon?: boolean;
  to?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'text-foreground inline-flex items-center gap-2 rounded-md font-semibold tracking-tight',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
    >
      {showIcon && (
        <img
          src="/favicon.svg"
          alt="REZO360"
          className="size-6 sm:size-7 shrink-0 rounded-lg shadow-2xs"
          width="28"
          height="28"
        />
      )}
      <span className="shrink-0">
        REZO<span className="text-primary">360</span>
      </span>
    </Link>
  );
}

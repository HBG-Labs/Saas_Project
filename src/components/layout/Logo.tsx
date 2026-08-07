import { Link } from 'react-router';

import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

/**
 * Marque NexoraTech.
 *
 * Pas de logotype graphique en Phase 2 : un symbole mal dessiné nuit plus qu'il
 * n'apporte. Le contraste typographique entre les deux moitiés du nom suffit à
 * créer une identité reconnaissable.
 */
export function Logo({ className, to = ROUTES.home }: { className?: string; to?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'text-foreground rounded-md text-base font-semibold tracking-tight',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
    >
      Nexora<span className="text-primary">Tech</span>
    </Link>
  );
}

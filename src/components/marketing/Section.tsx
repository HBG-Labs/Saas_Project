import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Centre l'en-tête. Par défaut aligné à gauche, plus lisible sur du texte long. */
  centered?: boolean;
}

/**
 * Section de page marketing.
 *
 * Factorise l'en-tête et le rythme vertical : sans ce composant, chaque section
 * redéfinirait ses marges et l'espacement finirait par diverger d'une section à
 * l'autre.
 */
export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
  centered = false,
}: SectionProps) {
  return (
    <section id={id} className={cn('px-4 py-20 sm:px-6 sm:py-24', className)}>
      <div className="mx-auto max-w-6xl">
        <div className={cn('max-w-2xl', centered && 'mx-auto text-center')}>
          {eyebrow ? (
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">{eyebrow}</p>
          ) : null}
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
          {description ? (
            <p className="text-muted-foreground mt-4 text-base">{description}</p>
          ) : null}
        </div>

        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

import { Tooltip as RadixTooltip } from 'radix-ui';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Délai avant apparition, en ms. */
  delay?: number;
}

/**
 * Infobulle.
 *
 * ⚠️ Une infobulle n'est **jamais** le seul porteur d'une information : elle est
 * inaccessible au tactile. Elle complète un libellé, elle ne le remplace pas.
 * Pour un bouton à icône seule, l'`aria-label` reste obligatoire.
 *
 * Radix la rend visible au focus clavier, pas seulement au survol.
 */
export function Tooltip({ content, children, side = 'top', delay = 300 }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delay}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            className={cn(
              'bg-foreground text-background shadow-overlay z-50 max-w-56 rounded-md px-2 py-1 text-xs',
              'data-[state=delayed-open]:animate-in',
            )}
          >
            {content}
            <RadixTooltip.Arrow className="fill-foreground" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

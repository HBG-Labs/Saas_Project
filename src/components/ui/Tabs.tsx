import { Tabs as RadixTabs } from 'radix-ui';
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/cn';

/**
 * Onglets.
 *
 * Radix implémente le motif ARIA complet : navigation par flèches, `Home`/`End`,
 * et association `aria-controls` entre chaque onglet et son panneau.
 *
 * La liste défile horizontalement sur mobile plutôt que de passer à la ligne :
 * un retour à la ligne ferait sauter la mise en page à chaque changement
 * d'onglet.
 */
export function Tabs(props: ComponentPropsWithoutRef<typeof RadixTabs.Root>) {
  return <RadixTabs.Root {...props} />;
}

export function TabsList({ className, ...props }: ComponentPropsWithoutRef<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn(
        'border-border flex gap-1 overflow-x-auto border-b',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'text-muted-foreground relative -mb-px shrink-0 border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap',
        'transition-colors duration-[120ms]',
        'hover:text-foreground',
        'data-[state=active]:border-primary data-[state=active]:text-foreground',
        'focus-visible:ring-ring rounded-t-md focus-visible:ring-2 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixTabs.Content>) {
  return (
    <RadixTabs.Content
      className={cn(
        'focus-visible:ring-ring mt-4 focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  );
}

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
        'border-border scroll-x flex gap-1 border-b',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        /*
          Sur téléphone, la bande d'onglets déborde jusqu'aux bords de l'écran.

          Elle défilait déjà, mais rien ne le disait : la barre de défilement
          est masquée, et le dernier onglet s'arrêtait proprement à la marge
          intérieure de la page — un alignement net qui se lit comme une fin de
          liste. En annulant la marge du contenu (`-mx-4`) puis en la rendant
          à l'intérieur (`px-4`), l'onglet suivant est coupé par le bord de
          l'écran : on voit qu'il continue.

          La marge de la page vaut 1 rem, celle du `main`, jusqu'à `sm`.
        */
        '-mx-4 px-4 sm:mx-0 sm:px-0',
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
        // `min-h-touch` : un onglet se change au pouce, souvent en marchant.
        'text-muted-foreground relative -mb-px flex min-h-touch shrink-0 items-center border-b-2 border-transparent px-3 text-xs font-medium whitespace-nowrap sm:min-h-0 sm:py-2 sm:text-sm',
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

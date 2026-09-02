import { Command } from 'cmdk';
import { Lock, Search } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useNavigate } from 'react-router';

import { FALLBACK_NAV_ICON, NAV_ICONS } from '@/components/layout/nav-icons';
import { FALLBACK_TOOL_ICON, TOOL_ICONS } from '@/components/ui/icons';
import {
  ACCOUNT_NAV,
  ROOT_NAV,
  SIDEBAR_GROUPS,
  type ResolvedNavItem,
} from '@/config/navigation';
import { ROUTES } from '@/config/routes';
import { useVisibleNavGroups } from '@/features/organizations';
import { CATEGORY_METADATA, listTools } from '@/features/tools';
import { cn } from '@/lib/cn';

export interface CommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ITEM_CLASSES = cn(
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm outline-none select-none',
  'text-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-subtle-foreground',
  'data-[selected=true]:bg-surface-hover',
);

/**
 * Palette de commandes (⌘K / Ctrl+K).
 *
 * Accélérateur central de l'application : atteindre n'importe quelle page ou
 * n'importe quel outil sans quitter le clavier. Construite sur `cmdk`, qui
 * fournit le filtrage flou et la navigation par flèches, dans un `Dialog` Radix
 * pour le piège de focus.
 *
 * Composant de présentation pur : l'état d'ouverture et le raccourci ⌘K sont
 * détenus par `CommandBarProvider`, qui la monte une seule fois pour toute
 * l'application.
 */
export function CommandBar({ open, onOpenChange }: CommandBarProps) {
  const navigate = useNavigate();
  const tools = listTools();

  /*
    La palette ne listait que le catalogue et le compte : les missions, les
    clients et les équipes — ce qu'un utilisateur ouvre le plus souvent —
    n'étaient atteignables qu'à la souris.

    Le même filtrage que la barre latérale, et pour la même raison : proposer
    « Journal » à qui n'a pas `audit.view` mènerait à une page vide.
  */
  const visibleGroups = useVisibleNavGroups(SIDEBAR_GROUPS);

  // Le tableau de bord et le compte n'appartiennent à aucune formule : ils sont
  // marqués ouverts explicitement, sinon le type de la liste se réduirait au
  // plus petit dénominateur et le cadenas disparaîtrait pour tout le monde.
  const destinations: readonly ResolvedNavItem[] = [
    ...ROOT_NAV.map((item) => ({ ...item, locked: false })),
    ...visibleGroups.flatMap((group) => group.items),
    ...ACCOUNT_NAV.map((item) => ({ ...item, locked: false })),
  ];

  const go = (path: string) => {
    onOpenChange(false);
    void navigate(path);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-label="Palette de commandes"
          className={cn(
            'bg-surface-raised border-border fixed top-[15%] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg',
            'shadow-modal -translate-x-1/2 overflow-hidden rounded-xl border',
          )}
        >
          <Dialog.Title className="sr-only">Rechercher</Dialog.Title>

          <Command loop className="max-h-[60vh] overflow-hidden">
            <div className="border-border flex items-center gap-2 border-b px-3">
              <Search className="text-subtle-foreground size-4 shrink-0" aria-hidden="true" />
              <Command.Input
                placeholder="Rechercher un outil, une page…"
                className="placeholder:text-subtle-foreground h-12 w-full bg-transparent text-sm outline-none"
              />
            </div>

            <Command.List className="overflow-y-auto p-2">
              <Command.Empty className="text-muted-foreground py-8 text-center text-xs">
                Aucun résultat.
              </Command.Empty>

              {tools.length > 0 ? (
                <Command.Group
                  heading="Outils"
                  className="[&_[cmdk-group-heading]]:text-subtle-foreground [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium"
                >
                  {tools.map((tool) => {
                    const Icon = TOOL_ICONS[tool.icon] ?? FALLBACK_TOOL_ICON;
                    return (
                      <Command.Item
                        key={tool.slug}
                        value={`${tool.title} ${tool.keywords.join(' ')}`}
                        onSelect={() => {
                          go(ROUTES.tool(tool.slug));
                        }}
                        className={ITEM_CLASSES}
                      >
                        <Icon />
                        {tool.title}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ) : null}

              <Command.Group
                heading="Catégories"
                className="[&_[cmdk-group-heading]]:text-subtle-foreground [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium"
              >
                {CATEGORY_METADATA.map((category) => {
                  const Icon = TOOL_ICONS[category.icon] ?? FALLBACK_TOOL_ICON;
                  return (
                    <Command.Item
                      key={category.slug}
                      value={category.name}
                      onSelect={() => {
                        go(ROUTES.category(category.slug));
                      }}
                      className={ITEM_CLASSES}
                    >
                      <Icon />
                      {category.name}
                    </Command.Item>
                  );
                })}
              </Command.Group>

              <Command.Group
                heading="Navigation"
                className="[&_[cmdk-group-heading]]:text-subtle-foreground [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium"
              >
                {destinations.map((item) => {
                  const Icon = NAV_ICONS[item.icon] ?? FALLBACK_NAV_ICON;
                  return (
                    <Command.Item
                      key={item.to}
                      value={item.label}
                      onSelect={() => {
                        go(item.to);
                      }}
                      className={ITEM_CLASSES}
                    >
                      <Icon />
                      <span className={cn(item.locked && 'text-subtle-foreground')}>
                        {item.label}
                      </span>
                      {item.locked ? (
                        <span className="text-subtle-foreground ml-auto flex items-center gap-1 text-3xs">
                          <Lock className="size-3" aria-hidden="true" />
                          Formule supérieure
                        </span>
                      ) : null}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

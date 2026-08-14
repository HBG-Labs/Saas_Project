import { Moon, Sun } from 'lucide-react';

import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { cn } from '@/lib/cn';

import { useTheme } from './useTheme';
import type { Theme } from './theme-context';

const OPTIONS: readonly { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
];

/**
 * Sélecteur de thème.
 *
 * Trois choix et non deux : « Système » est un état distinct de « Clair », qui
 * suit le réglage du système d'exploitation en continu. Un simple interrupteur
 * clair/sombre rendrait ce comportement impossible à retrouver une fois quitté.
 */
export function ThemeToggle() {
  const { resolvedTheme } = useTheme();
  const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <Dropdown
      trigger={
        <button
          type="button"
          aria-label="Changer de thème"
          className="text-muted-foreground hover:bg-surface-hover hover:text-foreground hidden size-9 items-center justify-center rounded-md transition-colors sm:flex"
        >
          <CurrentIcon className="size-4" aria-hidden="true" />
        </button>
      }
    >
      <ThemeMenuItems />
    </Dropdown>
  );
}

/**
 * Les mêmes choix, réutilisables dans un autre menu.
 *
 * Sur téléphone, la barre supérieure n'a pas la place d'aligner cinq commandes
 * de 44 px. Le thème se règle une fois puis s'oublie : il rejoint le menu du
 * compte, et les commandes qui restent en haut retrouvent une taille que le
 * pouce atteint. Le déclencheur ci-dessus ne réapparaît qu'à partir de `sm`.
 */
export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();

  return (
    <>
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        return (
          <DropdownItem
            key={option.value}
            onSelect={() => {
              setTheme(option.value);
            }}
            className={cn(theme === option.value && 'text-primary font-medium')}
          >
            <Icon />
            {option.label}
          </DropdownItem>
        );
      })}
    </>
  );
}

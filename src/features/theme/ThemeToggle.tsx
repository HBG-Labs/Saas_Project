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
  const { theme, resolvedTheme, setTheme } = useTheme();
  const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <Dropdown
      trigger={
        <button
          type="button"
          aria-label="Changer de thème"
          className="text-muted-foreground hover:bg-surface-hover hover:text-foreground flex size-9 items-center justify-center rounded-md transition-colors"
        >
          <CurrentIcon className="size-4" aria-hidden="true" />
        </button>
      }
    >
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
    </Dropdown>
  );
}

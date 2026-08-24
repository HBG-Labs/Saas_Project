import { Moon, Paintbrush, Sun } from 'lucide-react';

import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';
import { cn } from '@/lib/cn';

import { useTheme } from './useTheme';
import type { Theme } from './theme-context';

const OPTIONS: readonly { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
];

/**
 * Sélecteur et bouton de thème REZO360.
 * Visible et accessible sur mobile comme sur ordinateur.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <Dropdown
      trigger={
        <button
          type="button"
          aria-label="Changer de thème"
          className={cn(
            'text-muted-foreground hover:bg-surface-hover hover:text-foreground flex size-8 sm:size-9 items-center justify-center rounded-lg transition-colors cursor-pointer shrink-0',
            className,
          )}
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
 * Choix de thèmes et personnalisation réutilisables.
 */
export function ThemeMenuItems() {
  const { theme, setTheme, setIsCustomizerOpen } = useTheme();

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
            className={cn(theme === option.value && 'text-primary font-bold')}
          >
            <Icon />
            <span>{option.label}</span>
          </DropdownItem>
        );
      })}

      <DropdownSeparator />

      <DropdownItem
        onSelect={(e) => {
          e.preventDefault();
          setIsCustomizerOpen(true);
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsCustomizerOpen(true);
        }}
        className="text-xs font-semibold text-primary cursor-pointer"
      >
        <Paintbrush className="size-3.5" />
        <span>Personnaliser l’ambiance</span>
      </DropdownItem>
    </>
  );
}

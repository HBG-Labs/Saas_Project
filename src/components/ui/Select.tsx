import { Check, ChevronDown } from 'lucide-react';
import { Select as RadixSelect } from 'radix-ui';
import { useId } from 'react';

import { cn } from '@/lib/cn';
import { definedProps } from '@/lib/defined-props';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: readonly SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  hideLabel?: boolean;
}

/**
 * Liste déroulante.
 *
 * Radix Select plutôt que `<select>` natif : le natif ne peut pas être stylé de
 * façon cohérente entre navigateurs et systèmes, et son rendu mobile diverge
 * complètement. Radix conserve en revanche le comportement clavier attendu
 * (flèches, saisie prédictive, `Échap`).
 */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Sélectionner…',
  label,
  hint,
  error,
  disabled,
  id,
  className,
  hideLabel = false,
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;

  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <label
          htmlFor={selectId}
          className={cn('text-foreground mb-1.5 block text-xs font-medium', hideLabel && 'sr-only')}
        >
          {label}
        </label>
      ) : null}

      <RadixSelect.Root {...definedProps({ value, defaultValue, onValueChange, disabled })}>
        <RadixSelect.Trigger
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            'bg-surface text-foreground flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm',
            'transition-colors duration-[120ms]',
            'focus-visible:ring-ring focus-visible:border-primary focus-visible:ring-2 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'data-[placeholder]:text-subtle-foreground',
            error ? 'border-error' : 'border-border-strong',
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown className="text-subtle-foreground size-4" aria-hidden="true" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={6}
            className="bg-surface-raised border-border shadow-overlay z-50 max-h-64 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border p-1"
          >
            <RadixSelect.Viewport>
              {options.map((option) => (
                <RadixSelect.Item
                  key={option.value}
                  value={option.value}
                  {...definedProps({ disabled: option.disabled })}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none',
                    'data-[highlighted]:bg-surface-hover',
                    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  )}
                >
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator>
                    <Check className="text-primary size-3.5" aria-hidden="true" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

      {error ? (
        <p id={errorId} role="alert" className="text-rose-500 mt-1.5 text-xs font-medium">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-slate-400 dark:text-slate-400 mt-1.5 text-xs leading-normal block">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

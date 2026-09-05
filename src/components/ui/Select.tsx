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

export interface SelectOptionGroup {
  label: string;
  options: readonly SelectOption[];
}

export interface SelectProps {
  options: readonly SelectOption[];
  groups?: readonly SelectOptionGroup[] | undefined;
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  placeholder?: string | undefined;
  label?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  disabled?: boolean | undefined;
  id?: string | undefined;
  className?: string | undefined;
  triggerClassName?: string | undefined;
  hideLabel?: boolean | undefined;
  name?: string | undefined;
  required?: boolean | undefined;
  'aria-label'?: string | undefined;
  'aria-describedby'?: string | undefined;
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
  groups,
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
  triggerClassName,
  hideLabel = false,
  name,
  required,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;

  const renderOption = (option: SelectOption) => (
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
      <RadixSelect.ItemText className="min-w-0 flex-1 truncate">
        {option.label}
      </RadixSelect.ItemText>
      <RadixSelect.ItemIndicator>
        <Check className="text-primary size-3.5" aria-hidden="true" />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );

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

      <RadixSelect.Root
        {...definedProps({ value, defaultValue, onValueChange, disabled, name, required })}
      >
        <RadixSelect.Trigger
          id={selectId}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : ariaDescribedBy}
          className={cn(
            // 44 px au doigt, 36 px au pointeur — comme `Button`, qui suit
            // déjà cette règle. Le déclencheur était figé à `h-9` : 36 px, soit
            // sous la cible tactile de WCAG 2.5.5 sur un champ que l'on ouvre
            // en permanence dans les filtres de liste.
            'bg-surface text-foreground h-touch flex w-full items-center justify-between gap-2 rounded-md border px-3 text-sm sm:h-9',
            'transition-colors duration-[120ms]',
            'focus-visible:ring-ring focus-visible:border-primary focus-visible:ring-2 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'data-[placeholder]:text-subtle-foreground',
            error ? 'border-error' : 'border-border-strong',
            triggerClassName,
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
            className="bg-surface-raised border-border shadow-overlay z-50 max-h-64 max-w-[calc(100vw-2rem)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border p-1"
          >
            <RadixSelect.Viewport>
              {options.map(renderOption)}
              {options.length > 0 && groups?.some((group) => group.options.length > 0) ? (
                <RadixSelect.Separator className="bg-border my-1 h-px" />
              ) : null}
              {groups?.map((group) =>
                group.options.length > 0 ? (
                  <RadixSelect.Group key={group.label}>
                    <RadixSelect.Label className="text-subtle-foreground text-3xs px-2 pt-1.5 pb-1 font-semibold tracking-wider uppercase">
                      {group.label}
                    </RadixSelect.Label>
                    {group.options.map(renderOption)}
                  </RadixSelect.Group>
                ) : null,
              )}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

      {error ? (
        <p id={errorId} role="alert" className="text-error mt-1.5 text-xs font-medium">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-muted-foreground mt-1.5 block text-xs leading-normal">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

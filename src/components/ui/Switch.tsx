import { Switch as RadixSwitch } from 'radix-ui';
import { useId } from 'react';

import { cn } from '@/lib/cn';
import { definedProps } from '@/lib/defined-props';

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
  id?: string;
  className?: string;
}

/**
 * Interrupteur pour une préférence à effet immédiat.
 *
 * À distinguer d'une case à cocher : un interrupteur applique son changement
 * tout de suite, une case à cocher attend une validation de formulaire.
 */
export function Switch({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  label,
  description,
  id,
  className,
}: SwitchProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  const descriptionId = `${switchId}-description`;

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <RadixSwitch.Root
        id={switchId}
        {...definedProps({ checked, defaultChecked, onCheckedChange, disabled })}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'peer relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
          'ease-out-expo transition-colors duration-[120ms]',
          'data-[state=checked]:bg-primary data-[state=unchecked]:bg-border-strong',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            'bg-surface shadow-raised pointer-events-none block size-4 rounded-full ring-0',
            'ease-out-expo transition-transform duration-[120ms]',
            'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
          )}
        />
      </RadixSwitch.Root>

      <div className="min-w-0">
        <label
          htmlFor={switchId}
          className="text-foreground cursor-pointer text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        >
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-muted-foreground mt-0.5 text-xs">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

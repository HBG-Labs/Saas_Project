import { Check, Minus } from 'lucide-react';
import { Checkbox as RadixCheckbox } from 'radix-ui';
import { useId } from 'react';

import { cn } from '@/lib/cn';
import { definedProps } from '@/lib/defined-props';

export interface CheckboxProps {
  checked?: boolean | 'indeterminate';
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean | 'indeterminate') => void;
  disabled?: boolean;
  label: string;
  description?: string;
  id?: string;
  className?: string;
}

export function Checkbox({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  label,
  description,
  id,
  className,
}: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  const descriptionId = `${checkboxId}-description`;

  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <RadixCheckbox.Root
        id={checkboxId}
        {...definedProps({ checked, defaultChecked, onCheckedChange, disabled })}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'peer border-border-strong mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border',
          'transition-colors duration-[120ms]',
          'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
          'data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <RadixCheckbox.Indicator className="text-primary-foreground">
          {checked === 'indeterminate' ? (
            <Minus className="size-3" aria-hidden="true" />
          ) : (
            <Check className="size-3" aria-hidden="true" />
          )}
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>

      <div className="min-w-0">
        <label
          htmlFor={checkboxId}
          className="text-foreground cursor-pointer text-sm peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
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

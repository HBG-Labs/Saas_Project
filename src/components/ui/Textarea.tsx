import type { TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

export function Textarea({
  className,
  label,
  hint,
  error,
  hideLabel = false,
  id,
  required,
  rows = 4,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const hintId = `${textareaId}-hint`;
  const errorId = `${textareaId}-error`;

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={textareaId}
          className={cn('text-foreground mb-1.5 block text-xs font-medium', hideLabel && 'sr-only')}
        >
          {label}
          {required ? (
            <span className="text-error ml-0.5" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <textarea
        id={textareaId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          'bg-surface text-foreground placeholder:text-subtle-foreground w-full rounded-md border px-3 py-2 text-sm',
          'transition-colors duration-[120ms]',
          'focus-visible:ring-ring focus-visible:border-primary focus-visible:ring-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          // Empêche l'élargissement horizontal, qui casserait la mise en page.
          'resize-y',
          error ? 'border-error focus-visible:ring-error' : 'border-border-strong',
          className,
        )}
        {...props}
      />

      {error ? (
        <p id={errorId} role="alert" className="text-error mt-1.5 text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-subtle-foreground mt-1.5 text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

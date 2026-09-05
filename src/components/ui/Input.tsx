import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

import { cn } from '@/lib/cn';

import { DateTimeInput, type DateTimeInputType } from './DateTimeInput';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  /** Texte d'aide affiché sous le champ. Masqué quand une erreur est présente. */
  hint?: string;
  /** Message d'erreur. Sa présence bascule le champ en état invalide. */
  error?: string;
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  /** Masque visuellement le libellé sans le retirer aux lecteurs d'écran. */
  hideLabel?: boolean;
}

/**
 * Champ de saisie avec libellé, aide et erreur correctement associés.
 *
 * Le libellé est un vrai `<label htmlFor>` et non un simple `placeholder` : un
 * placeholder disparaît à la saisie, laissant l'utilisateur sans indication de
 * ce qu'il est en train de remplir, et n'est pas fiablement annoncé par les
 * lecteurs d'écran.
 */
export function Input(inputProps: InputProps) {
  const generatedId = useId();
  const isDateTimeInput = (type: unknown): type is DateTimeInputType =>
    type === 'date' || type === 'datetime-local' || type === 'month' || type === 'time';

  if (isDateTimeInput(inputProps.type)) {
    return (
      <DateTimeInput {...inputProps} id={inputProps.id ?? generatedId} type={inputProps.type} />
    );
  }

  const {
    className,
    label,
    hint,
    error,
    leadingIcon,
    trailingSlot,
    hideLabel = false,
    id,
    disabled,
    required,
    ...props
  } = inputProps;
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={inputId}
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

      <div className="relative">
        {leadingIcon ? (
          <span
            className="text-subtle-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center [&_svg]:size-4"
            aria-hidden="true"
          >
            {leadingIcon}
          </span>
        ) : null}

        <input
          id={inputId}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            'bg-surface text-foreground placeholder:text-subtle-foreground h-9 w-full rounded-md border px-3 text-sm',
            'transition-colors duration-[120ms]',
            'focus-visible:ring-ring focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-error focus-visible:ring-error' : 'border-border-strong',
            leadingIcon && 'pl-9',
            trailingSlot && 'pr-10',
            className,
          )}
          {...props}
        />

        {trailingSlot ? (
          <span className="absolute inset-y-0 right-2 flex items-center">{trailingSlot}</span>
        ) : null}
      </div>

      {/* L'erreur remplace l'aide : afficher les deux disperse l'attention au
          moment précis où l'utilisateur doit corriger quelque chose. */}
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

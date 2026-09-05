import {
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Popover } from 'radix-ui';

import { cn } from '@/lib/cn';

import { Button } from './Button';
import { Select } from './Select';

export type DateTimeInputType = 'date' | 'datetime-local' | 'month' | 'time';

export interface DateTimeInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'size' | 'type'
> {
  type: DateTimeInputType;
  label?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  hideLabel?: boolean | undefined;
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  ref?: Ref<HTMLInputElement> | undefined;
}

const MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

const WEEKDAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'] as const;
const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour).padStart(2, '0'),
  label: String(hour).padStart(2, '0'),
}));
const MINUTES = Array.from({ length: 60 }, (_, minute) => ({
  value: String(minute).padStart(2, '0'),
  label: String(minute).padStart(2, '0'),
}));

function asString(value: DateTimeInputProps['value']): string {
  if (Array.isArray(value)) return value.join(',');
  return value === undefined ? '' : String(value);
}

function dateToIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function validDatePart(value: string): string {
  const datePart = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : '';
}

function validMonthPart(value: string): string {
  const monthPart = value.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(monthPart) ? monthPart : '';
}

function validTimePart(value: string): string {
  const match = value.match(/(?:T|^)(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '';
}

function formatValue(value: string, type: DateTimeInputType): string {
  if (!value) return '';

  if (type === 'time') return validTimePart(value) || value;

  if (type === 'month') {
    const monthPart = validMonthPart(value);
    if (!monthPart) return value;
    const [year, month] = monthPart.split('-').map(Number);
    return `${MONTHS[(month ?? 1) - 1]} ${year}`;
  }

  const datePart = validDatePart(value);
  if (!datePart) return value;
  const [year, month, day] = datePart.split('-').map(Number);
  const formattedDate = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(year ?? 0, (month ?? 1) - 1, day));

  if (type === 'datetime-local') {
    const time = validTimePart(value);
    return time ? `${formattedDate} à ${time}` : formattedDate;
  }

  return formattedDate;
}

function placeholderFor(type: DateTimeInputType): string {
  if (type === 'time') return 'Choisir une heure';
  if (type === 'month') return 'Choisir un mois';
  if (type === 'datetime-local') return 'Choisir une date et une heure';
  return 'Choisir une date';
}

function setRef(ref: Ref<HTMLInputElement> | undefined, node: HTMLInputElement | null) {
  if (typeof ref === 'function') ref(node);
  else if (ref) ref.current = node;
}

export function DateTimeInput({
  type,
  label,
  hint,
  error,
  hideLabel = false,
  className,
  id,
  value,
  defaultValue,
  onChange,
  onBlur,
  disabled,
  readOnly,
  required,
  name,
  min,
  max,
  ref,
  leadingIcon: _leadingIcon,
  trailingSlot: _trailingSlot,
  placeholder,
  ...inputProps
}: DateTimeInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const labelId = `${inputId}-label`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const controlledValue = value === undefined ? undefined : asString(value);
  const [internalValue, setInternalValue] = useState(controlledValue ?? asString(defaultValue));
  const currentValue = controlledValue ?? internalValue;
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());
  const [draftDate, setDraftDate] = useState('');
  const [draftTime, setDraftTime] = useState('09:00');

  const assignInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      hiddenInputRef.current = node;
      setRef(ref, node);
      if (node && controlledValue === undefined) {
        setInternalValue((previous) => (node.value === previous ? previous : node.value));
      }
    },
    [controlledValue, ref],
  );

  const syncDraft = useCallback(() => {
    const liveValue = controlledValue ?? hiddenInputRef.current?.value ?? internalValue;
    const datePart = validDatePart(liveValue);
    const monthPart = validMonthPart(liveValue);
    const timePart = validTimePart(liveValue);
    const now = new Date();

    if (type === 'month') {
      const [year, month] = (monthPart || dateToIso(now.getFullYear(), now.getMonth(), 1))
        .split('-')
        .map(Number);
      setCursor(new Date(year ?? now.getFullYear(), (month ?? now.getMonth() + 1) - 1, 1));
    } else {
      const [year, month, day] = (
        datePart || dateToIso(now.getFullYear(), now.getMonth(), now.getDate())
      )
        .split('-')
        .map(Number);
      setCursor(new Date(year ?? now.getFullYear(), (month ?? now.getMonth() + 1) - 1, day ?? 1));
      setDraftDate(datePart);
    }

    setDraftTime(timePart || '09:00');
  }, [controlledValue, internalValue, type]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      if (controlledValue === undefined && hiddenInputRef.current) {
        setInternalValue(hiddenInputRef.current.value);
      }
      syncDraft();
    }
    if (!nextOpen && open && onBlur) {
      const target = hiddenInputRef.current;
      if (target) onBlur({ target, currentTarget: target } as FocusEvent<HTMLInputElement>);
    }
    setOpen(nextOpen);
  };

  const commitValue = (nextValue: string) => {
    setInternalValue(nextValue);
    const target = hiddenInputRef.current;
    if (target) {
      target.value = nextValue;
      const eventTarget = {
        name: target.name,
        type: 'text',
        value: nextValue,
      } as HTMLInputElement;
      onChange?.({ target: eventTarget, currentTarget: eventTarget } as ChangeEvent<HTMLInputElement>);
    }
  };

  const selectedDate = validDatePart(type === 'datetime-local' ? draftDate : currentValue);
  const minDate = typeof min === 'string' ? validDatePart(min) : '';
  const maxDate = typeof max === 'string' ? validDatePart(max) : '';
  const selectedMonth = validMonthPart(currentValue);
  const cursorYear = cursor.getFullYear();
  const cursorMonth = cursor.getMonth();

  const calendarDays = useMemo(() => {
    const firstDayIndex = (new Date(cursorYear, cursorMonth, 1).getDay() + 6) % 7;
    const totalDays = new Date(cursorYear, cursorMonth + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - firstDayIndex + 1;
      return day >= 1 && day <= totalDays ? day : null;
    });
  }, [cursorMonth, cursorYear]);

  const selectDate = (day: number) => {
    const nextDate = dateToIso(cursorYear, cursorMonth, day);
    if (type === 'datetime-local') {
      setDraftDate(nextDate);
      return;
    }
    commitValue(nextDate);
    setOpen(false);
  };

  const confirmTime = () => {
    if (type === 'datetime-local') {
      const datePart = draftDate || dateToIso(cursorYear, cursorMonth, cursor.getDate());
      commitValue(`${datePart}T${draftTime}`);
    } else {
      commitValue(draftTime);
    }
    setOpen(false);
  };

  const chooseMonth = (monthIndex: number) => {
    commitValue(`${cursorYear}-${String(monthIndex + 1).padStart(2, '0')}`);
    setOpen(false);
  };

  const displayValue = formatValue(currentValue, type);
  const icon = type === 'time' ? <Clock aria-hidden="true" /> : <CalendarDays aria-hidden="true" />;
  const describedBy = error ? errorId : hint ? hintId : inputProps['aria-describedby'];

  return (
    <div className="w-full">
      {label ? (
        <label
          id={labelId}
          htmlFor={`${inputId}-trigger`}
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

      <input
        {...inputProps}
        ref={assignInputRef}
        id={`${inputId}-value`}
        type="text"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={controlledValue}
        defaultValue={controlledValue === undefined ? asString(defaultValue) : undefined}
        disabled={disabled}
        required={required}
        onChange={(event) => {
          setInternalValue(event.target.value);
          onChange?.(event);
        }}
      />

      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger asChild>
          <button
            id={`${inputId}-trigger`}
            type="button"
            disabled={disabled || readOnly}
            aria-labelledby={label ? labelId : undefined}
            aria-label={label ? undefined : inputProps['aria-label']}
            aria-describedby={describedBy}
            data-invalid={error ? true : undefined}
            className={cn(
              'bg-surface text-foreground h-touch flex w-full items-center gap-2 rounded-md border px-3 text-left text-sm sm:h-9',
              'focus-visible:ring-ring focus-visible:border-primary focus-visible:ring-2 focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error ? 'border-error' : 'border-border-strong',
              className,
            )}
          >
            <span className="text-subtle-foreground [&_svg]:size-4">{icon}</span>
            <span
              className={cn('min-w-0 flex-1 truncate', !displayValue && 'text-subtle-foreground')}
            >
              {displayValue || placeholder || placeholderFor(type)}
            </span>
            <ChevronDown className="text-subtle-foreground size-4 shrink-0" aria-hidden="true" />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            collisionPadding={12}
            align="start"
            className="bg-surface-raised border-border shadow-overlay z-[100] w-[min(21rem,calc(100vw-1.5rem))] rounded-xl border p-3 outline-none"
          >
            {type === 'time' ? (
              <div className="space-y-3">
                <p className="text-foreground text-sm font-semibold">Choisir une heure</p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <Select
                    aria-label="Heures"
                    options={HOURS}
                    value={draftTime.slice(0, 2)}
                    onValueChange={(hour) => setDraftTime(`${hour}:${draftTime.slice(3, 5)}`)}
                  />
                  <span className="text-foreground font-semibold">:</span>
                  <Select
                    aria-label="Minutes"
                    options={MINUTES}
                    value={draftTime.slice(3, 5)}
                    onValueChange={(minute) => setDraftTime(`${draftTime.slice(0, 2)}:${minute}`)}
                  />
                </div>
                <Button type="button" className="w-full" onClick={confirmTime}>
                  Valider l’heure
                </Button>
              </div>
            ) : type === 'month' ? (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    className="hover:bg-surface-hover flex size-9 items-center justify-center rounded-md"
                    onClick={() => setCursor(new Date(cursorYear - 1, cursorMonth, 1))}
                    aria-label="Année précédente"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <p className="text-foreground text-sm font-semibold">{cursorYear}</p>
                  <button
                    type="button"
                    className="hover:bg-surface-hover flex size-9 items-center justify-center rounded-md"
                    onClick={() => setCursor(new Date(cursorYear + 1, cursorMonth, 1))}
                    aria-label="Année suivante"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MONTHS.map((month, monthIndex) => {
                    const monthValue = `${cursorYear}-${String(monthIndex + 1).padStart(2, '0')}`;
                    const isSelected = selectedMonth === monthValue;
                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => chooseMonth(monthIndex)}
                        className={cn(
                          'hover:bg-surface-hover min-h-10 rounded-md px-2 text-xs font-medium',
                          isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
                        )}
                      >
                        {month.slice(0, 4)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="hover:bg-surface-hover flex size-9 items-center justify-center rounded-md"
                    onClick={() => setCursor(new Date(cursorYear, cursorMonth - 1, 1))}
                    aria-label="Mois précédent"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <p className="text-foreground text-sm font-semibold">
                    {MONTHS[cursorMonth]} {cursorYear}
                  </p>
                  <button
                    type="button"
                    className="hover:bg-surface-hover flex size-9 items-center justify-center rounded-md"
                    onClick={() => setCursor(new Date(cursorYear, cursorMonth + 1, 1))}
                    aria-label="Mois suivant"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 text-center">
                  {WEEKDAYS.map((weekday) => (
                    <span
                      key={weekday}
                      className="text-muted-foreground text-3xs py-1 font-semibold"
                    >
                      {weekday}
                    </span>
                  ))}
                  {calendarDays.map((day, index) => {
                    if (day === null) return <span key={`empty-${index}`} className="size-9" />;
                    const dateValue = dateToIso(cursorYear, cursorMonth, day);
                    const outsideRange =
                      (minDate !== '' && dateValue < minDate) ||
                      (maxDate !== '' && dateValue > maxDate);
                    const isSelected = selectedDate === dateValue;
                    return (
                      <button
                        key={dateValue}
                        type="button"
                        disabled={outsideRange}
                        onClick={() => selectDate(day)}
                        aria-label={formatValue(dateValue, 'date')}
                        aria-pressed={isSelected}
                        className={cn(
                          'hover:bg-surface-hover mx-auto flex size-9 items-center justify-center rounded-full text-xs font-medium disabled:opacity-30',
                          isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {type === 'datetime-local' ? (
                  <div className="border-border space-y-3 border-t pt-3">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <Select
                        aria-label="Heures"
                        options={HOURS}
                        value={draftTime.slice(0, 2)}
                        onValueChange={(hour) => setDraftTime(`${hour}:${draftTime.slice(3, 5)}`)}
                      />
                      <span className="text-foreground font-semibold">:</span>
                      <Select
                        aria-label="Minutes"
                        options={MINUTES}
                        value={draftTime.slice(3, 5)}
                        onValueChange={(minute) =>
                          setDraftTime(`${draftTime.slice(0, 2)}:${minute}`)
                        }
                      />
                    </div>
                    <Button type="button" className="w-full" onClick={confirmTime}>
                      Valider la date et l’heure
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

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

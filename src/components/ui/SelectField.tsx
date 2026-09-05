import {
  Children,
  Fragment,
  isValidElement,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

import { Select, type SelectOption, type SelectOptionGroup } from './Select';

const EMPTY_VALUE = '__rezo360_empty_option__';

type OptionElement = ReactElement<{
  children?: ReactNode;
  disabled?: boolean;
  value?: string | number;
}>;

type OptionGroupElement = ReactElement<{
  children?: ReactNode;
  label?: string;
}>;

export interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'children' | 'defaultValue' | 'multiple' | 'onChange' | 'size' | 'value'
> {
  children: ReactNode;
  value?: string | number | undefined;
  defaultValue?: string | number | undefined;
  onChange?: ((event: ChangeEvent<HTMLSelectElement>) => void) | undefined;
  label?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  hideLabel?: boolean | undefined;
}

function textFromNode(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child);
      if (isValidElement<{ children?: ReactNode }>(child)) {
        return textFromNode(child.props.children);
      }
      return '';
    })
    .join('')
    .trim();
}

function optionFromElement(element: OptionElement): SelectOption {
  const rawValue = element.props.value ?? textFromNode(element.props.children);
  const value = String(rawValue);

  return {
    value: value === '' ? EMPTY_VALUE : value,
    label: textFromNode(element.props.children),
    ...(element.props.disabled ? { disabled: true } : {}),
  };
}

function collectOptions(children: ReactNode): {
  options: SelectOption[];
  groups: SelectOptionGroup[];
} {
  const options: SelectOption[] = [];
  const groups: SelectOptionGroup[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;

    if (child.type === Fragment) {
      const nested = collectOptions((child.props as { children?: ReactNode }).children);
      options.push(...nested.options);
      groups.push(...nested.groups);
      return;
    }

    if (child.type === 'option') {
      options.push(optionFromElement(child as OptionElement));
      return;
    }

    if (child.type === 'optgroup') {
      const group = child as OptionGroupElement;
      const nested = collectOptions(group.props.children);
      groups.push({
        label: group.props.label ?? '',
        options: [...nested.options, ...nested.groups.flatMap((item) => item.options)],
      });
    }
  });

  return { options, groups };
}

/**
 * Adaptateur destiné aux anciens champs `<select>` de l'application.
 *
 * Il conserve leur API (options JSX et événement `onChange`) tout en utilisant
 * le menu Radix de REZO360, afin d'éviter les panneaux natifs Android.
 */
export function SelectField({
  children,
  value,
  defaultValue,
  onChange,
  className,
  id,
  disabled,
  required,
  name,
  label,
  hint,
  error,
  hideLabel,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: SelectFieldProps) {
  const { options, groups } = collectOptions(children);
  const hasEmptyOption = options.some((option) => option.value === EMPTY_VALUE);
  const normalizedValue = value === undefined ? undefined : String(value) || EMPTY_VALUE;
  const normalizedDefault =
    defaultValue === undefined
      ? hasEmptyOption
        ? EMPTY_VALUE
        : undefined
      : String(defaultValue) || EMPTY_VALUE;

  return (
    <Select
      options={options}
      groups={groups}
      className="contents"
      value={normalizedValue}
      defaultValue={normalizedDefault}
      onValueChange={(nextValue) => {
        const nativeValue = nextValue === EMPTY_VALUE ? '' : nextValue;
        const target = { value: nativeValue, name: name ?? '' } as HTMLSelectElement;
        onChange?.({ target, currentTarget: target } as ChangeEvent<HTMLSelectElement>);
      }}
      id={id}
      disabled={disabled}
      required={required}
      name={name}
      label={label}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      triggerClassName={className}
    />
  );
}

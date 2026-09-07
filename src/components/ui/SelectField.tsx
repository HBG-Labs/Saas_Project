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

  /*
    `display: contents` DISSOUT LE CHAMP — ET C'EST PARFOIS CE QU'ON VEUT.

    Les barres de filtres héritées posent leurs classes (`flex-1`, `h-9`,
    bordures) sur ce qui était autrefois un `<select>` nu. Elles attendent donc
    que le DÉCLENCHEUR soit lui-même l'élément flex du parent, sans conteneur
    intermédiaire. `contents` le leur donne.

    Mais un champ qui porte une ÉTIQUETTE VISIBLE ne peut pas se dissoudre :
    l'étiquette et le déclencheur deviennent alors deux enfants directs du
    parent. Dans une `grid-cols-2`, ils tombent dans deux cellules différentes
    — l'étiquette « Dossier » en haut à droite, son menu à la ligne suivante,
    sous le champ voisin. Le défaut ne se voyait pas jusqu'ici : les écrans
    plus anciens enveloppent chaque champ dans leur propre `<div>`, qui absorbe
    la dissolution.

    D'où cette condition plutôt qu'un retrait pur et simple, qui aurait
    déplacé les filtres de Stock et d'Achats.
  */
  const etiquetteVisible = label !== undefined && label !== '' && hideLabel !== true;
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
      className={etiquetteVisible ? undefined : 'contents'}
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

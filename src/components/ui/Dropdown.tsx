import { Check } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

const CONTENT_CLASSES = cn(
  'bg-surface-raised border-border z-50 min-w-44 rounded-lg border p-1 shadow-overlay',
  'data-[state=open]:animate-in data-[state=closed]:animate-out',
);

const ITEM_CLASSES = cn(
  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none',
  'text-foreground transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
  // Radix pilote le survol ET le clavier via `data-highlighted` : un simple
  // `hover:` laisserait la navigation au clavier sans retour visuel.
  'data-[highlighted]:bg-surface-hover',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
);

export interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Menu contextuel.
 *
 * Radix gère la navigation par flèches, la saisie prédictive, le repositionnement
 * automatique quand le menu déborde du viewport, et le retour du focus au
 * déclencheur à la fermeture.
 */
export function Dropdown({ trigger, children, align = 'end', side = 'bottom' }: DropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} side={side} sideOffset={6} className={CONTENT_CLASSES}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function DropdownItem({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Item>) {
  return <DropdownMenu.Item className={cn(ITEM_CLASSES, className)} {...props} />;
}

export function DropdownCheckboxItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.CheckboxItem>) {
  return (
    <DropdownMenu.CheckboxItem className={cn(ITEM_CLASSES, 'pl-8', className)} {...props}>
      <DropdownMenu.ItemIndicator className="absolute left-2">
        <Check className="size-3.5" aria-hidden="true" />
      </DropdownMenu.ItemIndicator>
      {children}
    </DropdownMenu.CheckboxItem>
  );
}

export function DropdownLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn('text-subtle-foreground text-2xs px-2 py-1.5 font-medium', className)}
      {...props}
    />
  );
}

export function DropdownSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Separator>) {
  return (
    <DropdownMenu.Separator className={cn('bg-border -mx-1 my-1 h-px', className)} {...props} />
  );
}

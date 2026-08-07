import { Avatar as RadixAvatar } from 'radix-ui';

import { cn } from '@/lib/cn';

export interface AvatarProps {
  src?: string | null;
  /** Nom complet : sert d'alternative textuelle et génère les initiales. */
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'size-6 text-2xs',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const;

/** Deux initiales maximum : au-delà, elles deviennent illisibles dans le cercle. */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  return (
    <RadixAvatar.Root
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full select-none',
        SIZES[size],
        className,
      )}
    >
      {src ? <RadixAvatar.Image src={src} alt={name} className="size-full object-cover" /> : null}

      {/* Radix n'affiche le repli qu'après l'échec du chargement de l'image,
          ce qui évite le clignotement initiales → photo. */}
      <RadixAvatar.Fallback
        delayMs={src ? 300 : 0}
        className="bg-primary-subtle text-primary-700 dark:text-primary-300 flex size-full items-center justify-center font-medium"
      >
        {initialsOf(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}

import { Avatar as RadixAvatar } from 'radix-ui';

import { cheminAvatar, estAvatarConnu } from '@/config/avatars';
import { cn } from '@/lib/cn';

export interface UserAvatarProps {
  /**
   * Identifiant dans la bibliothèque (`avatar-01` … `avatar-50`).
   *
   * `null`/`undefined` retombe sur les initiales — c'est un état légitime, pas
   * une erreur : une personne qui n'a jamais ouvert le sélecteur n'a rien à
   * afficher de plus qu'un collègue qui n'a jamais renseigné de nom.
   */
  avatarId?: string | null;
  /** Nom complet : sert d'alternative textuelle et génère les initiales. */
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = {
  xs: 'size-5 text-3xs',
  sm: 'size-6 text-2xs',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-14 text-base',
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

/**
 * L'avatar d'une personne, partout dans REZO360.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN IDENTIFIANT ET NON UNE URL
 *
 * L'ancien composant recevait `src`, une adresse d'image quelconque. Celui-ci
 * reçoit `avatarId`, une clé dans une bibliothèque FERMÉE de 50 SVG. La
 * différence n'est pas cosmétique : une URL peut pointer n'importe où — un
 * fichier supprimé, un hébergeur externe, une chaîne corrompue — et le seul
 * moyen de le savoir est d'attendre l'échec du chargement. Un identifiant se
 * vérifie AVANT le rendu, avec `estAvatarConnu` : un `avatar_id` obsolète ou
 * mal formé retombe immédiatement sur les initiales, sans jamais tenter de
 * charger une image absente.
 *
 * `RadixAvatar.Image` reste la bonne primitive malgré tout : elle sait déjà
 * afficher le repli pendant le chargement et en cas d'échec réseau — un cas
 * qui, lui, demeure possible même avec un identifiant valide.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function UserAvatar({ avatarId, name, size = 'md', className }: UserAvatarProps) {
  const src = estAvatarConnu(avatarId) ? cheminAvatar(avatarId) : undefined;

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
          ce qui évite le clignotement initiales → avatar. */}
      <RadixAvatar.Fallback
        delayMs={src ? 300 : 0}
        className="bg-primary-subtle text-primary-700 dark:text-primary-300 flex size-full items-center justify-center font-medium"
      >
        {initialsOf(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}

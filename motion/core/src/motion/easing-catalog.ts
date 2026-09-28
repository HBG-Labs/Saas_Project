import { EASING_ROLES } from '../contracts/behavior.ts';
import type { EasingRole } from '../contracts/behavior.ts';
import type { CreativeStyleProfile, Easing } from '../contracts/style-profile.ts';

/**
 * Catalogue fermé des courbes. Les documents ne portent jamais de fonction :
 * seulement l'un de ces trois types, avec ses paramètres numériques.
 * Les comportements ne nomment que des RÔLES ; le style donne la courbe.
 */
export const EASING_TYPES = ['linear', 'bezier', 'spring'] as const;

export const EASING_ROLE_INTENTS: Record<EasingRole, string> = {
  enter: 'arrivée : départ franc, fin douce',
  exit: 'départ : début doux, sortie franche',
  inout: 'transition symétrique entre deux états',
  settle: 'retour à l’équilibre (ressort ou courbe de freinage)',
};

export class EasingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EasingError';
  }
}

/** Résout un rôle vers la courbe concrète du style. Aucune valeur par défaut cachée. */
export function resolveEasing(style: CreativeStyleProfile, role: EasingRole): Easing {
  const easing = style.motion_personality.easings[role];
  if (!easing) throw new EasingError(`le style ${style.id} ne définit pas la courbe « ${role} »`);
  return easing;
}

export function resolveAllEasings(style: CreativeStyleProfile): Record<EasingRole, Easing> {
  return Object.fromEntries(EASING_ROLES.map((role) => [role, resolveEasing(style, role)])) as Record<EasingRole, Easing>;
}

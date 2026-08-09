import { z } from 'zod';

/**
 * Schémas des formulaires du module Équipes.
 *
 * Les bornes reproduisent les contraintes de la table `teams`. Valider ici ne
 * sécurise rien — PostgreSQL refusera de toute façon — mais évite un
 * aller-retour réseau et rattache le message au bon champ.
 */

/** `char_length(name) between 2 and 100`. */
const teamName = z
  .string()
  .trim()
  .min(2, { error: 'Le nom doit contenir au moins 2 caractères.' })
  .max(100, { error: 'Le nom ne peut pas dépasser 100 caractères.' });

/** `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`, unique par organisation. */
const teamSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, { error: 'L’identifiant doit contenir au moins 2 caractères.' })
  .max(40, { error: 'L’identifiant ne peut pas dépasser 40 caractères.' })
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    error: 'Lettres minuscules, chiffres et tirets uniquement — sans tiret en début ni en fin.',
  });

export const teamSchema = z.object({
  name: teamName,
  slug: teamSlug,
  description: z.string().trim().max(500).optional().or(z.literal('')),
  /** `color ~ '^#[0-9a-fA-F]{6}$'` — contrainte exacte de la table. */
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: 'Couleur au format #RRGGBB.' })
    .optional()
    .or(z.literal('')),
  categoryId: z.string().optional().or(z.literal('')),
});

export type TeamValues = z.infer<typeof teamSchema>;

/**
 * Propose un identifiant à partir du nom.
 *
 * Même fonction que pour les organisations, dupliquée plutôt que factorisée : la
 * mutualiser créerait une dépendance entre deux features que rien ne relie, et
 * l'ESLint du projet interdit précisément ce genre de passerelle latérale.
 */
export function slugifyTeamName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

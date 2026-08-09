import { z } from 'zod';

import { ORG_ROLES } from '../rbac';

/**
 * Schémas des formulaires du module Entreprise.
 *
 * Les bornes reproduisent EXACTEMENT les contraintes SQL. Valider ici ne
 * sécurise rien — PostgreSQL refusera de toute façon une valeur hors limites —
 * mais évite un aller-retour réseau pour une faute de frappe, et permet
 * d'afficher le message au bon champ plutôt qu'en haut du formulaire.
 *
 * Une divergence entre ces bornes et le SQL produirait le pire des cas : un
 * formulaire qui accepte une saisie que le serveur rejette, avec une erreur
 * technique en guise d'explication.
 */

/** Même normalisation que les schémas d'authentification : trim puis minuscules. */
const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Adresse e-mail invalide.' }))
  .optional()
  .or(z.literal(''));

/** `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'` — contrainte de `organizations`. */
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, { error: 'L’identifiant doit contenir au moins 2 caractères.' })
  .max(40, { error: 'L’identifiant ne peut pas dépasser 40 caractères.' })
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    error: 'Lettres minuscules, chiffres et tirets uniquement — sans tiret en début ni en fin.',
  });

/** `char_length(name) between 2 and 120`. */
const organizationName = z
  .string()
  .trim()
  .min(2, { error: 'Le nom doit contenir au moins 2 caractères.' })
  .max(120, { error: 'Le nom ne peut pas dépasser 120 caractères.' });

export const createOrganizationSchema = z.object({
  name: organizationName,
  slug,
  city: z.string().trim().max(100).optional().or(z.literal('')),
});

export const organizationSettingsSchema = z.object({
  name: organizationName,
  legalName: z.string().trim().max(150).optional().or(z.literal('')),
  registrationNumber: z.string().trim().max(50).optional().or(z.literal('')),
  vatNumber: z.string().trim().max(50).optional().or(z.literal('')),
  email: optionalEmail,
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  addressLine1: z.string().trim().max(150).optional().or(z.literal('')),
  addressLine2: z.string().trim().max(150).optional().or(z.literal('')),
  postalCode: z.string().trim().max(20).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  // `char_length(country) = 2` en base : un code ISO, pas un nom de pays.
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, { error: 'Code pays sur 2 lettres (FR, BE, CH…).' })
    .optional()
    .or(z.literal('')),
});

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Adresse e-mail invalide.' })),
  // Construit depuis `ORG_ROLES` plutôt qu'écrit à la main : ajouter un rôle en
  // base ne doit pas laisser ce formulaire en arrière.
  role: z.enum(ORG_ROLES as unknown as [string, ...string[]], {
    error: 'Rôle invalide.',
  }),
});

export type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>;
export type OrganizationSettingsValues = z.infer<typeof organizationSettingsSchema>;
export type InviteMemberValues = z.infer<typeof inviteMemberSchema>;

/**
 * Propose un identifiant à partir du nom saisi.
 *
 * Doublon assumé avec `suggestOrganizationSlug` de la couche API : celle-ci
 * interroge le serveur pour éviter une collision, celle-là s'exécute à chaque
 * frappe pour remplir le champ en direct. Faire un aller-retour réseau par
 * caractère serait absurde ; ne rien proposer obligerait à saisir deux fois la
 * même information.
 */
export function slugifyOrganizationName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

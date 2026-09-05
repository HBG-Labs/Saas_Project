import { z } from 'zod';

/**
 * Schémas des formulaires du module Clients.
 *
 * Les bornes reproduisent les contraintes SQL. Valider ici ne sécurise rien —
 * PostgreSQL refusera de toute façon — mais évite un aller-retour réseau pour
 * une faute de frappe, et rattache le message au bon champ plutôt qu'en tête de
 * formulaire.
 */

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Adresse e-mail invalide.' }))
  .optional()
  .or(z.literal(''));

/** `char_length(name) between 2 and 150` sur `customers`. */
export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: 'Le nom doit contenir au moins 2 caractères.' })
    .max(150, { error: 'Le nom ne peut pas dépasser 150 caractères.' }),
  legalName: optionalText(150),
  customerType: z.enum(['company', 'individual', 'public_body', '']).optional(),
  registrationNumber: optionalText(50),
  vatNumber: optionalText(50),
  email: optionalEmail,
  phone: optionalText(30),
  addressLine1: optionalText(150),
  postalCode: optionalText(20),
  city: optionalText(100),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, { error: 'Code pays sur 2 lettres (FR, BE, CH…).' })
    .optional()
    .or(z.literal('')),
  notes: optionalText(2000),
});

/** `char_length(last_name) between 1 and 100`. */
export const contactSchema = z.object({
  lastName: z
    .string()
    .trim()
    .min(1, { error: 'Le nom est requis.' })
    .max(100, { error: 'Le nom ne peut pas dépasser 100 caractères.' }),
  firstName: optionalText(100),
  roleLabel: optionalText(100),
  email: optionalEmail,
  phone: optionalText(30),
  notes: optionalText(1000),
});

/** `char_length(name) between 2 and 150` sur `sites`. */
export const siteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: 'Le nom du site doit contenir au moins 2 caractères.' })
    .max(150, { error: 'Le nom ne peut pas dépasser 150 caractères.' }),
  code: optionalText(50),
  addressLine1: optionalText(150),
  postalCode: optionalText(20),
  city: optionalText(100),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, { error: 'Code pays sur 2 lettres.' })
    .optional()
    .or(z.literal('')),
  /**
   * Codes de portail, consignes de sécurité, horaires d'accès. Champ le plus
   * utile du module : c'est lui qui fait gagner une heure au technicien devant
   * une grille fermée.
   */
  accessNotes: optionalText(2000),
});

export type CustomerValues = z.infer<typeof customerSchema>;
export type ContactValues = z.infer<typeof contactSchema>;
export type SiteValues = z.infer<typeof siteSchema>;

/** `''` → `undefined` : la base distingue « vide » de « non renseigné ». */
export function omitEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
}

/** `''` → `null` pour les mises à jour, où l'on veut pouvoir EFFACER un champ. */
export function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

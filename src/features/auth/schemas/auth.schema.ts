import { z } from 'zod';

/**
 * Schémas de validation des formulaires d'authentification.
 *
 * Volontairement séparés des composants : les règles métier (longueur minimale,
 * format) se testent sans monter d'interface, et servent de source unique aux
 * types TypeScript des formulaires.
 */

/**
 * L'ordre est significatif : on NORMALISE avant de VALIDER.
 *
 * `z.email().trim()` validerait la chaîne brute puis la nettoierait — une
 * adresse saisie avec un espace final (fréquent avec la saisie prédictive
 * mobile) serait rejetée comme invalide. `.pipe()` inverse l'ordre : on trime
 * et on passe en minuscules, puis on valide le résultat.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Adresse e-mail invalide.' }));

/**
 * 8 caractères minimum, conformément à la recommandation NIST SP 800-63B.
 * Aucune exigence de complexité imposée : les règles du type « une majuscule,
 * un chiffre, un symbole » produisent des mots de passe plus courts, plus
 * prévisibles et plus difficiles à mémoriser. La longueur prime.
 */
const password = z
  .string()
  .min(8, { error: 'Le mot de passe doit contenir au moins 8 caractères.' })
  .max(72, { error: 'Le mot de passe ne peut pas dépasser 72 caractères.' });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: 'Le mot de passe est requis.' }),
});

export const registerSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, { error: 'Le nom doit contenir au moins 2 caractères.' })
      .max(60, { error: 'Le nom ne peut pas dépasser 60 caractères.' }),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'Les mots de passe ne correspondent pas.',
    // Rattache l'erreur au second champ : c'est celui que l'utilisateur doit
    // corriger, et l'attacher à l'objet racine la rendrait invisible.
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({ email });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

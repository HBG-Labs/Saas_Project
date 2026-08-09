import { z } from 'zod';

/**
 * Schémas du formulaire de mission.
 *
 * Les bornes reproduisent les contraintes de la table `missions`. Deux d'entre
 * elles méritent d'être signalées parce qu'elles ne relèvent pas du champ isolé :
 *
 *   • `reference` est ABSENTE — le trigger `generate_mission_reference` la
 *     calcule par organisation et par année. La laisser saisir produirait des
 *     collisions, et des numéros devinables d'une entreprise à l'autre.
 *
 *   • `missions_schedule_order` impose `scheduled_end >= scheduled_start`. Ce
 *     contrôle est reproduit ici par un `refine`, sinon l'erreur remonterait
 *     sous forme de violation de contrainte, illisible pour qui l'a saisie.
 */

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

export const missionSchema = z
  .object({
    /** `char_length(title) between 3 and 200`. */
    title: z
      .string()
      .trim()
      .min(3, { error: 'L’intitulé doit contenir au moins 3 caractères.' })
      .max(200, { error: 'L’intitulé ne peut pas dépasser 200 caractères.' }),
    description: optionalText(2000),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    scheduledStart: optionalText(30),
    scheduledEnd: optionalText(30),
    locationLabel: optionalText(150),
    notes: optionalText(2000),
  })
  .refine(
    (data) => {
      const start = data.scheduledStart;
      const end = data.scheduledEnd;
      if (start === undefined || start === '' || end === undefined || end === '') return true;
      return new Date(end) >= new Date(start);
    },
    {
      error: 'La fin prévue ne peut pas précéder le début.',
      path: ['scheduledEnd'],
    },
  );

export type MissionValues = z.infer<typeof missionSchema>;

/** `''` → `undefined`, pour les insertions où la colonne doit rester absente. */
export function omitEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Convertit une saisie `datetime-local` en ISO 8601.
 *
 * Le champ HTML rend une chaîne sans fuseau (`2026-08-12T09:30`). Envoyée telle
 * quelle dans une colonne `timestamptz`, PostgreSQL l'interpréterait dans le
 * fuseau du SERVEUR — soit un décalage silencieux de plusieurs heures sur un
 * planning. `new Date()` l'interprète, elle, dans le fuseau du navigateur, qui
 * est celui de la personne qui a saisi l'horaire.
 */
export function toIsoOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return undefined;

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

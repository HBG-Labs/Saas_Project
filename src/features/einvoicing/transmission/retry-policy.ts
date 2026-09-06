/**
 * Politique de report des tentatives de dépôt.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE MODULE EXISTE
 *
 * `invoice_transmissions` porte depuis l'origine une colonne `next_attempt_at`
 * et un index partiel dédié à la reprise. Rien ne les écrivait : l'échéance
 * restait nulle, l'index vide, et une transmission en échec technique attendait
 * indéfiniment qu'un humain rouvre la facture.
 *
 * Ce module décide QUAND retenter. Il ne décide pas SI l'on retente — c'est le
 * filtre `last_error_code = 'submission_failed'` qui écarte les refus métier,
 * qu'aucun report ne rendrait acceptables.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Au-delà, ce n'est plus un incident réseau : c'est un problème qui demande un
 * regard humain. La transmission reste `failed`, sans échéance, ce qui la rend
 * visible comme abandonnée plutôt que silencieusement rejouée.
 */
export const TENTATIVES_MAXIMUM = 5;

/**
 * Report après la n-ième tentative, en minutes.
 *
 * Croissance rapide puis palier : une plateforme momentanément indisponible
 * revient en général en quelques minutes, tandis qu'un incident durable ne se
 * résout pas en insistant. Le dernier palier laisse passer une nuit ouvrée.
 */
const REPORTS_MINUTES = [5, 15, 60, 360] as const;

const MINUTE_EN_MS = 60_000;

/**
 * Délai avant la prochaine tentative, en millisecondes.
 *
 * `tentativesEffectuees` est la valeur de `attempt_count` APRÈS incrément :
 * la base l'incrémente au moment où elle réserve la transmission, donc au
 * moment de l'échec elle compte bien les tentatives déjà consommées.
 *
 * Renvoie `null` lorsque le plafond est atteint : il n'y aura pas de suite.
 */
export function delaiAvantNouvelleTentative(tentativesEffectuees: number): number | null {
  if (!Number.isInteger(tentativesEffectuees) || tentativesEffectuees < 1) return null;
  if (tentativesEffectuees >= TENTATIVES_MAXIMUM) return null;
  const minutes = REPORTS_MINUTES[tentativesEffectuees - 1] ?? REPORTS_MINUTES.at(-1)!;
  return minutes * MINUTE_EN_MS;
}

/**
 * Échéance de la prochaine tentative, prête à être écrite dans
 * `invoice_transmissions.next_attempt_at`. `null` signifie « ne plus retenter ».
 */
export function prochaineTentative(tentativesEffectuees: number, maintenant: Date): string | null {
  const delai = delaiAvantNouvelleTentative(tentativesEffectuees);
  return delai === null ? null : new Date(maintenant.getTime() + delai).toISOString();
}

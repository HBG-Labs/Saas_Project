/**
 * Mentions proposées pour une facture issue d'un devis.
 *
 * Elles restent modifiables dans le brouillon. Les références, la date réelle
 * de prestation et les pénalités ne sont jamais devinées : elles dépendent de
 * la commande et des conditions réellement convenues avec le client.
 */
export const DEFAULT_EARLY_PAYMENT_TERMS = 'Escompte pour paiement anticipé : néant.';

export type InvoiceOperationType = 'goods' | 'services' | 'mixed';

const SERVICE_UNITS = new Set(['h', 'heure', 'heures', 'j', 'jour', 'jours']);

/**
 * Une nature n'est proposée automatiquement que lorsqu'elle est certaine : un
 * devis composé exclusivement de temps de travail décrit une prestation. Les
 * unités génériques (`u`, `forfait`, etc.) restent volontairement à préciser.
 */
export function suggestedOperationType(
  lines: readonly { unit: string }[],
): InvoiceOperationType | null {
  return lines.length > 0 && lines.every((line) => SERVICE_UNITS.has(line.unit.trim().toLowerCase()))
    ? 'services'
    : null;
}

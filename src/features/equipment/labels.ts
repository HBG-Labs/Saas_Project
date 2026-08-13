import type { EquipmentCategory, EquipmentCondition, EquipmentStatus } from '@/types/database';

/**
 * Libellés français des énumérations du parc.
 *
 * Séparés des composants : la même valeur apparaît sur la carte, dans le filtre
 * et dans l'export PDF. Trois traductions écrites sur place finiraient par
 * diverger — « À réviser » d'un côté, « A reviser » de l'autre.
 */
export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  optique: 'Optique',
  electricite: 'Électricité',
  radio: 'Radio & Réseau',
  securite: 'Sécurité',
  autre: 'Autre',
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  available: 'Disponible',
  assigned: 'Affecté',
  maintenance: 'En révision',
  expired: 'Étalonnage expiré',
};

export const EQUIPMENT_STATUS_VARIANTS: Record<
  EquipmentStatus,
  'success' | 'primary' | 'warning' | 'error'
> = {
  available: 'success',
  assigned: 'primary',
  maintenance: 'warning',
  expired: 'error',
};

export const EQUIPMENT_CONDITION_LABELS: Record<EquipmentCondition, string> = {
  neuf: 'Neuf',
  bon_etat: 'Bon état',
  a_reviser: 'À réviser',
};

export type CalibrationState = 'unknown' | 'valid' | 'due_soon' | 'expired';

/**
 * État d'étalonnage à partir de la date d'échéance.
 *
 * Le seuil d'alerte est de 30 jours : c'est le délai courant pour obtenir un
 * créneau chez un laboratoire d'étalonnage. Prévenir le jour de l'expiration
 * n'aurait aucune valeur — l'appareil serait déjà inutilisable pour une recette.
 */
export function calibrationState(nextCalibration: string | null): CalibrationState {
  if (nextCalibration === null || nextCalibration === '') return 'unknown';

  const due = new Date(nextCalibration);
  if (Number.isNaN(due.getTime())) return 'unknown';

  const daysLeft = Math.floor((due.getTime() - Date.now()) / 86_400_000);

  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 30) return 'due_soon';
  return 'valid';
}

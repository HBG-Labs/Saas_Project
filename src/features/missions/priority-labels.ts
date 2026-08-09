import type { MissionPriority } from '@/types/database';

/**
 * Libellés français des priorités.
 *
 * Fichier séparé des composants : mêler une constante et un composant dans un
 * même module casse le rafraîchissement à chaud de Vite
 * (`react-refresh/only-export-components`).
 */
export const MISSION_PRIORITY_LABELS: Record<MissionPriority, string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgente',
};

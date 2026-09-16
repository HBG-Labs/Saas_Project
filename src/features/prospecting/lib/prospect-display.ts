import type { ProspectStatus } from '@/types/database';

/**
 * 🔥 forte (≥70) · 🟠 moyenne (≥40) · 🔵 détecté (<40) — seuils posés dans
 * `prospecting_dashboard_stats` (Phase 6) ; les garder identiques ici évite
 * qu'un prospect classé « forte » au tableau de bord semble « moyenne » sur
 * sa propre fiche.
 */
export function scoreTier(score: number): 'forte' | 'moyenne' | 'basse' {
  if (score >= 70) return 'forte';
  if (score >= 40) return 'moyenne';
  return 'basse';
}

/** §12 du cahier des charges — libellés exacts. */
export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  nouveau: 'Nouveau',
  a_qualifier: 'À qualifier',
  a_contacter: 'À contacter',
  contacte: 'Contacté',
  a_relancer: 'À relancer',
  interesse: 'Intéressé',
  essai: 'Essai REZO360',
  converti: 'Converti',
  refuse: 'Refus',
  ignore: 'Ignoré',
  ne_plus_contacter: 'Ne plus contacter',
};

import { FEATURES, PLAN_FEATURES, type FeatureKey } from '@/features/billing/entitlements';

/**
 * La matrice de comparaison de la page Tarifs.
 *
 * Les cellules qui portent un QUOTA (Assistant IA, minutes de transcription)
 * et celles qui portent une présence gouvernée par la base (Workspace) sont
 * DÉRIVÉES de `PLAN_FEATURES`, le miroir des entitlements. Une matrice écrite
 * à la main avait laissé « À partir de Starter » sur l'Assistant IA trois
 * semaines après que Starter l'avait perdu : la page vendait ce que la base
 * refusait. `pricing-comparison.test.ts` garde le reste aligné.
 */

export type ComparisonValue = boolean | string;

export interface ComparisonRow {
  name: string;
  free: ComparisonValue;
  starter: ComparisonValue;
  pro: ComparisonValue;
  business: ComparisonValue;
  enterprise: ComparisonValue;
}

type PlanCells = Omit<ComparisonRow, 'name'>;

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

/** `false` sans quota, `Illimité` pour null, sinon le libellé du nombre. */
function quotaRow(feature: FeatureKey, label: (n: number) => string): PlanCells {
  const cell = (plan: keyof typeof PLAN_FEATURES): ComparisonValue => {
    const matrix = PLAN_FEATURES[plan];
    if (!(feature in matrix)) return false;
    const limit = matrix[feature];
    if (limit === null) return 'Illimité';
    if (limit === undefined || limit === 0) return false;
    return label(limit);
  };
  return {
    free: cell('free'),
    starter: cell('starter'),
    pro: cell('pro'),
    business: cell('business'),
    enterprise: cell('enterprise'),
  };
}

function booleanRow(feature: FeatureKey): PlanCells {
  const has = (plan: keyof typeof PLAN_FEATURES): boolean => {
    const limit = PLAN_FEATURES[plan][feature];
    return limit === null || (typeof limit === 'number' && limit > 0);
  };
  return {
    free: has('free'),
    starter: has('starter'),
    pro: has('pro'),
    business: has('business'),
    enterprise: has('enterprise'),
  };
}

export const COMPARISON_FEATURES: readonly ComparisonRow[] = [
  {
    name: 'Nombre d’utilisateurs inclus',
    free: '1 utilisateur',
    starter: '2 utilisateurs',
    pro: '5 utilisateurs',
    business: '10 utilisateurs',
    enterprise: '20 utilisateurs',
  },
  {
    name: 'Utilisateurs supplémentaires',
    free: 'Aucun (Max 1)',
    starter: '+5 €/user/mois',
    pro: '+5 €/user/mois',
    business: '+5 €/user/mois',
    enterprise: '+5 €/user/mois (Illimité)',
  },
  {
    name: 'Outils & convertisseurs universels',
    free: true,
    starter: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Calculateurs Métiers certifiés (Fibre, Élec, BTP...)',
    free: false,
    starter: false,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Assistant IA (données de l’entreprise + documentation technique)',
    ...quotaRow(FEATURES.aiAssistant, (n) => `${formatNumber(n)} req./mois`),
  },
  {
    name: 'Workspace — pages, modèles, recherche, IA sur une page',
    ...booleanRow(FEATURES.workspace),
  },
  {
    name: 'Enregistrement vocal transcrit et résumé dans la page',
    ...quotaRow(FEATURES.aiTranscriptionMinutes, (n) => `${formatNumber(n)} min/mois`),
  },
  {
    name: 'Recherche universelle ⌘K',
    free: true,
    starter: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Historique des calculs',
    free: '10 derniers',
    starter: 'Illimité',
    pro: 'Illimité',
    business: 'Illimité',
    enterprise: 'Illimité',
  },
  {
    name: 'Outils favoris',
    free: '3 favoris',
    starter: 'Illimité',
    pro: 'Illimité',
    business: 'Illimité',
    enterprise: 'Illimité',
  },
  {
    name: 'Export de bilans (PDF certifié & CSV)',
    free: false,
    starter: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Sauvegarde auto des paramètres',
    free: false,
    starter: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Gestion des missions & chantiers',
    free: false,
    starter: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Fiches & rapports d’intervention PDF',
    free: false,
    starter: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Devis & facturation certifiée',
    free: false,
    starter: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Parc matériel, outillage & étalonnages',
    free: false,
    starter: false,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Flotte de véhicules & suivi technique',
    free: false,
    starter: false,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Gestion des stocks & achats fournisseurs',
    free: false,
    starter: false,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    name: 'Plannings d’équipe & calendrier partagé',
    free: false,
    starter: false,
    pro: false,
    business: true,
    enterprise: true,
  },
  {
    name: 'Statistiques & tableaux de bord avancés',
    free: false,
    starter: false,
    pro: false,
    business: true,
    enterprise: true,
  },
  {
    name: 'Gouvernance, audit log & SLA 99.9%',
    free: false,
    starter: false,
    pro: false,
    business: false,
    enterprise: true,
  },
  {
    name: 'Support technique',
    free: 'Communauté',
    starter: 'E-mail 48h',
    pro: 'Prioritaire 24h',
    business: 'Dédié 24h',
    enterprise: 'Dédié 24/7 + SLA',
  },
];

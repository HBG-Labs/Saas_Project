import { PERMISSIONS, roleHasPermission, type Permission } from '@/features/organizations';
import type { MissionStatus, OrgRole } from '@/types/database';

/**
 * Machine à états des missions — miroir de `mission_status_transitions`.
 *
 * Sert à l'interface : n'afficher que les actions réellement possibles, plutôt
 * que de laisser l'utilisateur découvrir l'interdit par un message d'erreur.
 * L'application effective reste le trigger `enforce_mission_transition`.
 *
 * `workflow.test.ts` compare cette table au seed SQL.
 *
 * Source : supabase/migrations/20260808100500_missions.sql
 */

export interface TransitionRule {
  from: MissionStatus;
  to: MissionStatus;
  /** `null` : aucune permission particulière (cas de l'acceptation par l'assigné). */
  requiredPermission: Permission | null;
  /** `true` : réservé à l'intervenant affecté. */
  assigneeOnly: boolean;
  /** Libellé du bouton correspondant. */
  label: string;
}

export const MISSION_TRANSITIONS: readonly TransitionRule[] = [
  {
    from: 'draft',
    to: 'assigned',
    requiredPermission: PERMISSIONS.missionAssign,
    assigneeOnly: false,
    label: 'Affecter',
  },
  {
    from: 'draft',
    to: 'cancelled',
    requiredPermission: PERMISSIONS.missionCancel,
    assigneeOnly: false,
    label: 'Annuler',
  },

  {
    from: 'assigned',
    to: 'accepted',
    requiredPermission: null,
    assigneeOnly: true,
    label: 'Accepter la mission',
  },
  {
    from: 'assigned',
    to: 'assigned',
    requiredPermission: PERMISSIONS.missionAssign,
    assigneeOnly: false,
    label: 'Réaffecter',
  },
  {
    from: 'assigned',
    to: 'draft',
    requiredPermission: PERMISSIONS.missionAssign,
    assigneeOnly: false,
    label: "Retirer l'affectation",
  },
  {
    from: 'assigned',
    to: 'cancelled',
    requiredPermission: PERMISSIONS.missionCancel,
    assigneeOnly: false,
    label: 'Annuler',
  },

  {
    from: 'accepted',
    to: 'in_progress',
    requiredPermission: null,
    assigneeOnly: true,
    label: "Démarrer l'intervention",
  },
  {
    from: 'accepted',
    to: 'assigned',
    requiredPermission: PERMISSIONS.missionAssign,
    assigneeOnly: false,
    label: 'Réaffecter',
  },
  {
    from: 'accepted',
    to: 'cancelled',
    requiredPermission: PERMISSIONS.missionCancel,
    assigneeOnly: false,
    label: 'Annuler',
  },

  {
    from: 'in_progress',
    to: 'completed',
    requiredPermission: null,
    assigneeOnly: true,
    label: 'Terminer les travaux',
  },
  {
    from: 'in_progress',
    to: 'cancelled',
    requiredPermission: PERMISSIONS.missionCancel,
    assigneeOnly: false,
    label: 'Interrompre',
  },

  {
    from: 'completed',
    to: 'submitted',
    requiredPermission: null,
    assigneeOnly: true,
    label: 'Soumettre le compte rendu',
  },

  {
    from: 'submitted',
    to: 'approved',
    requiredPermission: PERMISSIONS.interventionReview,
    assigneeOnly: false,
    label: 'Valider',
  },
  {
    from: 'submitted',
    to: 'rejected',
    requiredPermission: PERMISSIONS.interventionReview,
    assigneeOnly: false,
    label: 'Refuser',
  },

  {
    from: 'rejected',
    to: 'in_progress',
    requiredPermission: null,
    assigneeOnly: true,
    label: 'Reprendre les travaux',
  },
  {
    from: 'rejected',
    to: 'cancelled',
    requiredPermission: PERMISSIONS.missionCancel,
    assigneeOnly: false,
    label: 'Abandonner',
  },
];

/** États terminaux : plus aucune transition n'en part. */
export const TERMINAL_STATUSES: readonly MissionStatus[] = ['approved', 'cancelled'];

export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  draft: 'Brouillon',
  assigned: 'Affectée',
  accepted: 'Acceptée',
  in_progress: 'En cours',
  completed: 'Terminée',
  submitted: 'Compte rendu soumis',
  approved: 'Validée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
};

export function getAvailableTransitions(from: MissionStatus): readonly TransitionRule[] {
  return MISSION_TRANSITIONS.filter((rule) => rule.from === from);
}

export function isTransitionAllowed(from: MissionStatus, to: MissionStatus): boolean {
  return MISSION_TRANSITIONS.some((rule) => rule.from === from && rule.to === to);
}

/**
 * Transitions qu'un utilisateur donné peut réellement déclencher.
 *
 * Reproduit l'arbitrage du trigger : la permission requise OU la qualité
 * d'intervenant affecté, selon la règle.
 */
export function getPermittedTransitions(params: {
  from: MissionStatus;
  role: OrgRole | null;
  isAssignee: boolean;
}): readonly TransitionRule[] {
  const { from, role, isAssignee } = params;

  return getAvailableTransitions(from).filter((rule) => {
    if (rule.assigneeOnly && !isAssignee) return false;
    if (rule.requiredPermission === null) return true;
    return roleHasPermission(role, rule.requiredPermission);
  });
}

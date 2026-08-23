import { supabase, unwrap } from '@/services/supabase';
import type { AuditLog } from '@/types/domain';

/**
 * Lecture du journal d'audit.
 *
 * Aucune fonction d'écriture n'est exposée, et ce n'est pas un oubli : le
 * journal est alimenté exclusivement par des triggers PostgreSQL. Un audit que
 * le client pourrait écrire n'enregistrerait que ce que le client veut bien
 * déclarer — c'est-à-dire rien, précisément quand ça compte.
 *
 * La lecture elle-même est restreinte à la permission `audit.view`
 * (propriétaire et administrateur) par la policy `audit_logs_select_permitted`.
 */

export interface AuditFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  /** Bornes ISO sur `created_at`. */
  from?: string;
  to?: string;
  limit?: number;
}

export async function listAuditLogs(
  organizationId: string,
  filters: AuditFilters = {},
): Promise<AuditLog[]> {
  let query = supabase.from('audit_logs').select('*').eq('organization_id', organizationId);

  if (filters.action) query = query.eq('action', filters.action);
  if (filters.entityType) query = query.eq('entity_type', filters.entityType);
  if (filters.entityId) query = query.eq('entity_id', filters.entityId);
  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to);

  try {
    return await unwrap(
      query.order('created_at', { ascending: false }).limit(filters.limit ?? 500),
    );
  } catch {
    return [];
  }
}

/** Historique d'une entité précise — l'onglet « Traçabilité » d'une mission. */
export async function listEntityAuditTrail(
  organizationId: string,
  entityType: string,
  entityId: string,
): Promise<AuditLog[]> {
  return listAuditLogs(organizationId, { entityType, entityId, limit: 200 });
}

/** Libellés français des actions journalisées (§10). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Missions & Rapports
  'mission.created': 'Mission créée',
  'mission.status_changed': 'Statut de mission modifié',
  'mission.assigned': 'Mission affectée',
  'mission.deleted': 'Mission supprimée',
  'report.created': 'Compte rendu créé',
  'report.submitted': 'Compte rendu soumis',
  'report.approved': 'Intervention validée',
  'report.rejected': 'Intervention refusée',
  'report.updated': 'Compte rendu modifié',

  // Clients
  'customer.created': 'Client créé',
  'customer.updated': 'Client modifié',
  'customer.deleted': 'Client supprimé',
  'customer.archived': 'Client archivé',
  'customer.restored': 'Client restauré',

  // Membres & Équipes
  'member.added': 'Membre ajouté',
  'member.removed': 'Membre retiré',
  'member.role_changed': 'Rôle modifié',
  'member.status_changed': 'Statut de membre modifié',
  'organization_member.added': 'Membre ajouté',
  'organization_member.removed': 'Membre retiré',
  'organization_member.role_changed': 'Rôle de membre modifié',
  'organization_member.status_changed': 'Statut de membre modifié',
  'team.created': 'Équipe créée',
  'team.deleted': 'Équipe supprimée',

  // Achats & Stock
  'purchase_order.created': 'Bon de commande créé',
  'purchase_order.sent': 'Commande envoyée au fournisseur',
  'purchase_order.received': 'Marchandises réceptionnées',
  'purchase_order.cancelled': 'Commande annulée',
  'stock_movement.created': 'Mouvement de stock enregistré',
  'stock_consumable.created': 'Article de stock créé',
  'stock_consumable.updated': 'Article de stock modifié',

  // RH & Congés
  'leave_request.created': 'Demande de congé déposée',
  'leave_request.approved': 'Demande de congé approuvée',
  'leave_request.rejected': 'Demande de congé refusée',
  'leave_request.revoked': 'Décision de congé annulée',
  'organization.updated': 'Organisation mise à jour',
};

export function describeAuditAction(action: string): string {
  if (AUDIT_ACTION_LABELS[action]) {
    return AUDIT_ACTION_LABELS[action];
  }
  // Formatage propre si l'action n'est pas encore répertoriée
  const [first, second] = action.split('.');
  if (first && second) {
    return `${first.replace(/_/g, ' ')} : ${second.replace(/_/g, ' ')}`;
  }
  return action.replace(/_/g, ' ');
}

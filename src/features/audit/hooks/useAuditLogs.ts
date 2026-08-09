import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { listAuditLogs, listEntityAuditTrail, type AuditFilters } from '../api/audit.api';

/**
 * Journal d'audit de l'organisation.
 *
 * Aucune mutation n'accompagne ce hook, et c'est délibéré : le journal est
 * alimenté par des triggers PostgreSQL, et un trigger d'immuabilité refuse
 * toute modification ou suppression — y compris à un rôle privilégié. Il n'y a
 * donc rien à écrire depuis l'application.
 *
 * `staleTime` court : c'est l'écran qu'on ouvre pour vérifier ce qui vient de se
 * passer.
 */
export function useAuditLogs(organizationId: string | null, filters: AuditFilters = {}) {
  return useQuery({
    queryKey: qk.audit.list(organizationId ?? 'none', filters),
    queryFn: () => (organizationId === null ? [] : listAuditLogs(organizationId, filters)),
    enabled: organizationId !== null,
    staleTime: 15_000,
  });
}

/** Traçabilité d'une entité précise — l'historique complet d'une mission, d'un membre. */
export function useEntityAuditTrail(
  organizationId: string | null,
  entityType: string,
  entityId: string | undefined,
) {
  return useQuery({
    queryKey: qk.audit.entityTrail(entityType, entityId ?? 'none'),
    queryFn: () =>
      organizationId === null || entityId === undefined
        ? []
        : listEntityAuditTrail(organizationId, entityType, entityId),
    enabled: organizationId !== null && entityId !== undefined,
  });
}

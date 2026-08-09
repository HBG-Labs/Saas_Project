import { useMemo } from 'react';

import { roleHasAnyPermission, roleHasPermission, type Permission } from '../rbac';

import { useCurrentOrganization } from './useCurrentOrganization';

export interface PermissionChecks {
  /** Rôle dans l'organisation courante — `null` si aucune. */
  role: ReturnType<typeof useCurrentOrganization>['role'];
  can: (permission: Permission) => boolean;
  canAny: (permissions: readonly Permission[]) => boolean;
}

/**
 * Droits de l'utilisateur dans l'organisation courante.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE HOOK NE SÉCURISE RIEN.
 *
 * Il évite de proposer une action que le serveur refusera : un bouton
 * « Supprimer » offert à un technicien produirait un aller-retour et un message
 * d'erreur là où l'absence du bouton dit la même chose, immédiatement.
 *
 * L'autorisation réelle vit dans les policies RLS et les triggers. Une requête
 * forgée en console est refusée par PostgreSQL, que ce hook ait renvoyé `true`
 * ou non.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function usePermission(): PermissionChecks {
  const { role } = useCurrentOrganization();

  return useMemo(
    () => ({
      role,
      can: (permission) => roleHasPermission(role, permission),
      canAny: (permissions) => roleHasAnyPermission(role, permissions),
    }),
    [role],
  );
}

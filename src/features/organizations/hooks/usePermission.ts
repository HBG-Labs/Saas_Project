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
 * Le rôle vient de `organization_members`, et de nulle part ailleurs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PLUS AUCUNE SIMULATION
 *
 * Une bascule de développement permettait de se voir en technicien sans changer
 * de compte. Elle disparaît avec la mise en production : deux sources de vérité
 * pour un même rôle, c'est une de trop, et celle qui ne vient pas de la base
 * finit toujours par mentir. Voir l'interface d'un technicien se fait désormais
 * en s'y connectant.
 *
 * Sans appartenance, le rôle reste `null` — exactement ce que renvoie
 * `app.current_org_role()` au serveur.
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

import { useMemo } from 'react';

import { useSimulatedRole } from '@/features/auth';

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
 * LE SÉLECTEUR DE DÉVELOPPEMENT NE PEUT QUE RESTREINDRE
 *
 * La version précédente accordait `owner` dès que le sélecteur affichait
 * « entrepreneur », rôle réel ou non. L'interface proposait alors des actions
 * que PostgreSQL refusait systématiquement — l'inverse du service rendu.
 *
 * Il reste utile de VOIR l'application comme un technicien sans changer de
 * compte. Cette bascule est donc conservée, mais dans un seul sens : elle
 * retire des droits, elle n'en donne jamais. Sans appartenance, le rôle reste
 * `null` — exactement ce que renvoie `app.current_org_role()` au serveur.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function usePermission(): PermissionChecks {
  const { role: orgRole } = useCurrentOrganization();
  const { role: simRole } = useSimulatedRole();

  const activeRole = useMemo(() => {
    if (orgRole === null) return null;
    if (import.meta.env.DEV && simRole === 'technician') return 'technician';
    return orgRole;
  }, [orgRole, simRole]);

  return useMemo(
    () => ({
      role: activeRole,
      can: (permission) => roleHasPermission(activeRole, permission),
      canAny: (permissions) => roleHasAnyPermission(activeRole, permissions),
    }),
    [activeRole],
  );
}

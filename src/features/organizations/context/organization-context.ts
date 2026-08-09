import { createContext } from 'react';

import type { OrgRole } from '@/types/database';
import type { Organization, OrganizationMember } from '@/types/domain';

/**
 * `loading`  — la liste des organisations n'est pas encore connue.
 * `none`     — l'utilisateur n'appartient à aucune organisation.
 * `ready`    — une organisation est sélectionnée et son appartenance est connue.
 *
 * `none` est distinct de `loading` pour la même raison que dans
 * `AuthProvider` : confondre « je ne sais pas encore » et « il n'y en a pas »
 * ferait apparaître l'écran d'accueil « créez votre entreprise » pendant une
 * fraction de seconde à chaque chargement, y compris pour un membre établi.
 */
export type OrganizationStatus = 'loading' | 'none' | 'ready';

export interface OrganizationContextValue {
  status: OrganizationStatus;
  /** Toutes les organisations dont l'utilisateur est membre actif. */
  organizations: readonly Organization[];
  organization: Organization | null;
  membership: OrganizationMember | null;
  /** Rôle dans l'organisation courante. `null` hors organisation. */
  role: OrgRole | null;
  /** Change d'organisation et mémorise le choix. */
  select: (organizationId: string) => void;
}

export const OrganizationContext = createContext<OrganizationContextValue | null>(null);

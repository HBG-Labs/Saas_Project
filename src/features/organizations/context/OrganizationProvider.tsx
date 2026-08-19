import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/features/auth';
import { qk } from '@/lib/query-keys';

import { getMyMembership, listMyOrganizations } from '../api/organizations.api';

import { OrganizationContext, type OrganizationContextValue } from './organization-context';

const STORAGE_KEY = 'rezo360_current_organization';

/**
 * Lecture du dernier choix d'organisation.
 *
 * Simple préférence d'affichage : rien ne dépend de cette valeur côté sécurité.
 * Un identifiant forgé à la main dans le stockage local ne donne accès à rien —
 * il ne figurera pas dans `listMyOrganizations`, dont le contenu est déjà filtré
 * par la policy `organizations_select_member`, et sera donc ignoré ci-dessous.
 */
function readStoredOrganizationId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, status: authStatus } = useAuth();
  const userId = user?.id ?? null;

  const [selectedId, setSelectedId] = useState<string | null>(readStoredOrganizationId);

  const { data: organizations, isPending: organizationsPending } = useQuery({
    queryKey: qk.organizations.mine(),
    queryFn: listMyOrganizations,
    enabled: userId !== null,
  });

  const list = useMemo(() => organizations ?? [], [organizations]);

  /**
   * Organisation retenue.
   *
   * Le choix mémorisé n'est honoré que s'il figure TOUJOURS dans la liste : on
   * peut avoir été retiré d'une entreprise depuis la dernière visite. À défaut,
   * repli sur la première — ordonnée par nom, donc stable d'une session à
   * l'autre, contrairement à un ordre d'insertion.
   */
  const organization = useMemo(() => {
    if (list.length === 0) return null;
    return list.find((candidate) => candidate.id === selectedId) ?? list[0] ?? null;
  }, [list, selectedId]);

  const { data: membership, isPending: membershipPending } = useQuery({
    queryKey: qk.organizations.membership(organization?.id ?? 'none', userId ?? 'anonymous'),
    queryFn: () =>
      organization === null || userId === null
        ? Promise.resolve(null)
        : getMyMembership(organization.id, userId),
    enabled: organization !== null && userId !== null,
  });

  const select = useCallback((organizationId: string) => {
    setSelectedId(organizationId);
    try {
      localStorage.setItem(STORAGE_KEY, organizationId);
    } catch {
      // Navigation privée ou quota saturé : le choix ne survivra pas au
      // rechargement, ce qui est une gêne, pas une panne.
    }
  }, []);

  const value = useMemo<OrganizationContextValue>(() => {
    const status: OrganizationContextValue['status'] =
      authStatus === 'loading' || (userId !== null && organizationsPending)
        ? 'loading'
        : organization === null
          ? 'none'
          : membershipPending
            ? 'loading'
            : 'ready';

    return {
      status,
      organizations: list,
      organization,
      membership: membership ?? null,
      // Le rôle ne vaut que pour une appartenance ACTIVE : un membre suspendu
      // conserve sa ligne, mais `app.current_org_role` ne la retient pas. Le
      // miroir doit refuser exactement ce que le serveur refuse, sans quoi
      // l'interface proposerait des actions systématiquement rejetées.
      role: membership?.status === 'active' ? membership.role : null,
      select,
    };
  }, [
    authStatus,
    userId,
    organizationsPending,
    membershipPending,
    list,
    organization,
    membership,
    select,
  ]);

  return <OrganizationContext value={value}>{children}</OrganizationContext>;
}

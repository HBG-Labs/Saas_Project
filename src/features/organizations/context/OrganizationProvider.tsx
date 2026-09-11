import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '@/features/auth';
import { clearTenantQueryCache } from '@/lib/query-client';
import { qk } from '@/lib/query-keys';

import { getMyMembership, listMyOrganizations } from '../api/organizations.api';

import { OrganizationContext, type OrganizationContextValue } from './organization-context';

const STORAGE_KEY_PREFIX = 'rezo360_current_organization';

/**
 * Lecture du dernier choix d'organisation.
 *
 * Simple préférence d'affichage : rien ne dépend de cette valeur côté sécurité.
 * Un identifiant forgé à la main dans le stockage local ne donne accès à rien —
 * il ne figurera pas dans `listMyOrganizations`, dont le contenu est déjà filtré
 * par la policy `organizations_select_member`, et sera donc ignoré ci-dessous.
 */
function organizationStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

function readStoredOrganizationId(userId: string): string | null {
  try {
    return localStorage.getItem(organizationStorageKey(userId));
  } catch {
    return null;
  }
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user, status: authStatus } = useAuth();
  const userId = user?.id ?? null;

  const [selection, setSelection] = useState<{
    userId: string | null;
    organizationId: string | null;
  }>({ userId: null, organizationId: null });
  const previousOrganizationIdRef = useRef<string | null | undefined>(undefined);
  const storedSelectedId = useMemo(
    () => (userId === null ? null : readStoredOrganizationId(userId)),
    [userId],
  );
  const selectedId = selection.userId === userId ? selection.organizationId : storedSelectedId;

  const { data: organizations, isPending: organizationsPending } = useQuery({
    queryKey: qk.organizations.mine(userId ?? 'anonymous'),
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

  /**
   * Purge du cache quand l'organisation change SANS passer par `select` : on a
   * pu être retiré de l'entreprise courante, et le repli sur `list[0]` change
   * alors de tenant sans aucun geste de l'utilisateur.
   *
   * La garde porte sur `null`, pas seulement sur `undefined`. L'ARRIVÉE de la
   * première organisation n'est pas un changement d'organisation : au premier
   * rendu la liste n'est pas encore chargée, `organization` vaut `null`, et
   * c'est ce passage-là qui consommait la garde `undefined`. La transition
   * `null → organisation` était donc traitée comme un changement de tenant et
   * purgeait le cache juste après que l'appartenance ci-dessus a été lancée.
   */
  useEffect(() => {
    const nextOrganizationId = organization?.id ?? null;
    const previousOrganizationId = previousOrganizationIdRef.current;

    if (
      previousOrganizationId !== undefined &&
      previousOrganizationId !== null &&
      previousOrganizationId !== nextOrganizationId &&
      nextOrganizationId !== null
    ) {
      clearTenantQueryCache(queryClient);
    }

    previousOrganizationIdRef.current = nextOrganizationId;
  }, [organization?.id, queryClient]);

  const select = useCallback(
    (organizationId: string) => {
      if (organization?.id !== organizationId) clearTenantQueryCache(queryClient);
      setSelection({ userId, organizationId });
      try {
        if (userId !== null) {
          localStorage.setItem(organizationStorageKey(userId), organizationId);
        }
      } catch {
        // Navigation privée ou quota saturé : le choix ne survivra pas au
        // rechargement, ce qui est une gêne, pas une panne.
      }
    },
    [organization?.id, queryClient, userId],
  );

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

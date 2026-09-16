import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { qk } from '@/lib/query-keys';

import { checkPlatformAdminStatus } from '../api/prospecting.api';

/**
 * Statut administrateur plateforme de la personne connectée.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE HOOK NE SÉCURISE RIEN — comme `usePermission` pour le RBAC tenant.
 *
 * Le refus qui compte vient de la RLS de `platform_admins`/`prospecting_*` et
 * des policies posées en Phase 2. Ici, on épargne à un client REZO360 un écran
 * qu'il ne pourrait de toute façon pas remplir, et on masque la navigation
 * correspondante — jamais l'inverse : `RequirePlatformAdmin` ne doit jamais
 * être la SEULE protection d'une route.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function usePlatformAdmin() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: qk.platformAdmin.status(user?.id ?? 'anonyme'),
    queryFn: () => checkPlatformAdminStatus(user!.id),
    enabled: user !== null,
    // Le statut d'administrateur plateforme ne change pas en cours de session.
    staleTime: 5 * 60 * 1000,
  });

  return {
    isAdmin: data?.isAdmin ?? false,
    isLoading: user !== null && isLoading,
    can: (permission: string) => (data?.permissions ?? []).includes(permission),
  };
}

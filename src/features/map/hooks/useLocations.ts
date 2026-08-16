import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import {
  listLiveLocations,
  listLocationTrail,
  reportPosition,
  stopSharingPosition,
  type PositionReport,
} from '../api/locations.api';

/**
 * Positions des intervenants, côté composants.
 *
 * `refetchInterval` plutôt qu'un abonnement temps réel : une carte de
 * répartition se lit à la minute, pas à la seconde, et une connexion websocket
 * ouverte en permanence sur un téléphone en 4G coûte plus de batterie qu'elle
 * n'apporte de fraîcheur. Le jour où la seconde comptera vraiment, Supabase
 * Realtime se branchera sur la même clé de cache.
 */
const LIVE_REFRESH_MS = 60_000;

export function useLiveLocations(organizationId: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.locations.live(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? [] : listLiveLocations(organizationId)),
    enabled: organizationId !== null && enabled,
    refetchInterval: enabled ? LIVE_REFRESH_MS : false,
    // Une position d'il y a une minute n'est plus la position : autant la
    // considérer périmée dès qu'on revient sur l'onglet.
    staleTime: 0,
  });
}

export function useLocationTrail(memberId: string | null, sinceIso: string, enabled = true) {
  return useQuery({
    queryKey: qk.locations.trail(memberId ?? 'none', sinceIso),
    queryFn: () => (memberId === null ? [] : listLocationTrail(memberId, sinceIso)),
    enabled: memberId !== null && enabled,
  });
}

/**
 * Déclarer sa propre position.
 *
 * Aucun paramètre d'identité : c'est l'appelant qui se déclare, et le serveur
 * vérifie que le membre transmis est bien lui.
 */
export function useReportPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (report: PositionReport) => reportPosition(report),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.locations.all });
    },
  });
}

export function useStopSharingPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => stopSharingPosition(memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.locations.all });
    },
  });
}

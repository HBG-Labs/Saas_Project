import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import {
  getProspect,
  getProspectingDashboardStats,
  listProspectingSectors,
  listProspectingZones,
  listProspects,
  type ProspectFilters,
} from '../api/prospecting.api';

export function useProspectingDashboard() {
  return useQuery({
    queryKey: qk.prospecting.dashboard(),
    queryFn: getProspectingDashboardStats,
    // Détection quotidienne (Phase 10, pas encore de CRON) : pas la peine de
    // rafraîchir plus vite que ça tant que rien n'alimente les compteurs en continu.
    staleTime: 60 * 1000,
  });
}

export function useProspects(filters: ProspectFilters = {}) {
  return useQuery({
    queryKey: qk.prospecting.list(filters),
    queryFn: () => listProspects(filters),
  });
}

export function useProspect(siren: string | undefined) {
  return useQuery({
    queryKey: qk.prospecting.detail(siren ?? 'none'),
    queryFn: () => (siren === undefined ? null : getProspect(siren)),
    enabled: siren !== undefined,
  });
}

export function useProspectingZones() {
  return useQuery({
    queryKey: qk.prospecting.zones(),
    queryFn: listProspectingZones,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProspectingSectors() {
  return useQuery({
    queryKey: qk.prospecting.sectors(),
    queryFn: listProspectingSectors,
    staleTime: 5 * 60 * 1000,
  });
}

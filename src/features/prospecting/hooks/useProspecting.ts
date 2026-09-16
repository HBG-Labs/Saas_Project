import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { qk } from '@/lib/query-keys';
import type { ProspectStatus } from '@/types/database';

import {
  addProspectContact,
  addProspectNote,
  completeFollowup,
  convertProspectToClient,
  getMessageTemplateForSector,
  getProspect,
  getProspectingDashboardStats,
  listDueFollowups,
  listProspectingSectors,
  listProspectingZones,
  listProspects,
  scheduleFollowup,
  searchOrganizationsForConversion,
  suppressProspect,
  updateProspectStatus,
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

// -----------------------------------------------------------------------------
// Phase 7 — mutations
// -----------------------------------------------------------------------------
//
// Chaque mutation invalide la fiche ET la liste ET le tableau de bord :
// changer un statut déplace le prospect d'un compteur à l'autre, et la
// remise en question de « quoi invalider précisément » coûterait plus cher
// qu'une invalidation large sur un module qui ne pagine que par dizaines.

function useInvalidateProspecting() {
  const queryClient = useQueryClient();
  // Racine entière plutôt que des clés ciblées : un changement de statut
  // déplace le prospect d'un compteur de tableau de bord à l'autre et peut
  // le faire entrer ou sortir de la liste filtrée — deviner précisément quoi
  // invalider coûterait plus cher que de tout relire sur un module qui
  // pagine par dizaines de lignes, pas par milliers.
  return () => queryClient.invalidateQueries({ queryKey: qk.prospecting.all });
}

export function useUpdateProspectStatus(siren: string) {
  const invalidate = useInvalidateProspecting();
  return useMutation({
    mutationFn: (status: ProspectStatus) => updateProspectStatus(siren, status),
    onSuccess: () => invalidate(),
  });
}

export function useSuppressProspect(siren: string) {
  const invalidate = useInvalidateProspecting();
  return useMutation({
    mutationFn: (reason: string | null) => suppressProspect(siren, reason),
    onSuccess: () => invalidate(),
  });
}

/** Phase 11 : saisie manuelle d'une coordonnée — aucune source automatisée. */
export function useAddProspectContact(siren: string) {
  const invalidate = useInvalidateProspecting();
  return useMutation({
    mutationFn: (input: { contactType: 'email' | 'phone' | 'website'; value: string }) =>
      addProspectContact({ siren, ...input }),
    onSuccess: () => invalidate(),
  });
}

export function useAddProspectNote(siren: string) {
  const { user } = useAuth();
  const invalidate = useInvalidateProspecting();
  return useMutation({
    mutationFn: (body: string) => addProspectNote({ siren, body, authorId: user?.id ?? null }),
    onSuccess: () => invalidate(),
  });
}

export function useScheduleFollowup(siren: string) {
  const { user } = useAuth();
  const invalidate = useInvalidateProspecting();
  return useMutation({
    mutationFn: (input: { dueAt: string; note: string | null; kind: string | null }) =>
      scheduleFollowup({ siren, ...input, createdBy: user?.id ?? null }),
    onSuccess: () => invalidate(),
  });
}

export function useCompleteFollowup() {
  const invalidate = useInvalidateProspecting();
  return useMutation({
    mutationFn: (followupId: string) => completeFollowup(followupId),
    onSuccess: () => invalidate(),
  });
}

/** §21 : widget « Relances aujourd'hui », affiché sur le tableau de bord. */
export function useDueFollowups() {
  return useQuery({
    queryKey: qk.prospecting.dueFollowups(),
    queryFn: listDueFollowups,
    staleTime: 30 * 1000,
  });
}

/** Phase 8 : gabarit de brouillon du secteur — `null` si aucun n'est configuré. */
export function useMessageTemplate(sectorId: string | undefined) {
  return useQuery({
    queryKey: qk.prospecting.messageTemplate(sectorId ?? 'none'),
    queryFn: () => (sectorId === undefined ? null : getMessageTemplateForSector(sectorId)),
    enabled: sectorId !== undefined,
    staleTime: 5 * 60 * 1000,
  });
}

// -----------------------------------------------------------------------------
// Phase 9 — conversion
// -----------------------------------------------------------------------------

/** Recherche d'organisations à lier (§ modale « Convertir en client »). */
export function useOrganizationSearch(query: string) {
  return useQuery({
    queryKey: qk.prospecting.organizationSearch(query),
    queryFn: () => searchOrganizationsForConversion(query),
    staleTime: 30 * 1000,
  });
}

export function useConvertProspectToClient(siren: string) {
  const invalidate = useInvalidateProspecting();
  return useMutation({
    mutationFn: (organizationId: string) => convertProspectToClient(siren, organizationId),
    onSuccess: () => invalidate(),
  });
}

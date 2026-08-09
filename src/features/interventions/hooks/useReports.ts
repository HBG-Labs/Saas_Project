import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { TablesUpdate } from '@/types/database';
import type { InterventionAttachment } from '@/types/domain';

import {
  approveReport,
  createReport,
  deleteAttachment,
  getAttachmentUrl,
  listAttachments,
  listReportsPendingReview,
  rejectReport,
  submitReport,
  updateReport,
  uploadAttachment,
} from '../api/interventions.api';

// -----------------------------------------------------------------------------
// Compte rendu
// -----------------------------------------------------------------------------

export function useCreateReport(interventionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createReport,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: qk.interventions.detail(interventionId),
      });
    },
  });
}

/**
 * Enregistre le brouillon.
 *
 * Aucune invalidation : le formulaire détient déjà la vérité de ce qu'il vient
 * d'écrire. Recharger à chaque frappe ferait sauter le curseur au milieu d'une
 * phrase — le défaut classique de l'enregistrement automatique.
 */
export function useSaveReport(reportId: string) {
  return useMutation({
    mutationFn: (patch: TablesUpdate<'intervention_reports'>) => updateReport(reportId, patch),
  });
}

/**
 * Soumet le compte rendu au contrôle.
 *
 * Invalide aussi les missions : `sync_mission_from_report` pousse la mission en
 * `submitted` dans la foulée.
 */
export function useSubmitReport(interventionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitReport,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.interventions.detail(interventionId) }),
        queryClient.invalidateQueries({ queryKey: qk.missions.all }),
      ]);
    },
  });
}

// -----------------------------------------------------------------------------
// Contrôle
// -----------------------------------------------------------------------------

export function useReportsPendingReview(organizationId: string | null) {
  return useQuery({
    queryKey: qk.interventions.pendingReview(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? [] : listReportsPendingReview(organizationId)),
    enabled: organizationId !== null,
  });
}

/**
 * Valide ou refuse.
 *
 * Les deux invalident tout le domaine : la file de contrôle se vide, la fiche
 * change d'état et la mission suit. Cibler finement laisserait un compte rendu
 * traité en tête d'une file où il n'a plus sa place.
 */
export function useReviewReport() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.interventions.all }),
      queryClient.invalidateQueries({ queryKey: qk.missions.all }),
    ]);
  };

  const approve = useMutation({ mutationFn: approveReport, onSuccess: invalidate });
  const reject = useMutation({
    mutationFn: (input: { reportId: string; reason: string }) =>
      rejectReport(input.reportId, input.reason),
    onSuccess: invalidate,
  });

  return { approve, reject };
}

// -----------------------------------------------------------------------------
// Pièces jointes
// -----------------------------------------------------------------------------

export function useAttachments(interventionId: string | undefined) {
  return useQuery({
    queryKey: qk.interventions.attachments(interventionId ?? 'none'),
    queryFn: () => (interventionId === undefined ? [] : listAttachments(interventionId)),
    enabled: interventionId !== undefined,
  });
}

/**
 * URL signée d'une pièce jointe.
 *
 * Le bucket est privé : aucune URL n'est stable, chacune est signée pour une
 * heure. D'où le `staleTime` à trente minutes — largement sous l'expiration.
 * L'aligner sur l'heure entière ferait afficher des images mortes à ceux qui
 * laissent l'écran ouvert, ce qui est la norme sur un chantier.
 */
export function useAttachmentUrl(storagePath: string | undefined) {
  return useQuery({
    queryKey: ['attachment-url', storagePath ?? 'none'],
    queryFn: () => (storagePath === undefined ? null : getAttachmentUrl(storagePath)),
    enabled: storagePath !== undefined,
    staleTime: 30 * 60_000,
    gcTime: 35 * 60_000,
  });
}

export function useUploadAttachment(interventionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadAttachment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: qk.interventions.attachments(interventionId),
      });
    },
  });
}

export function useDeleteAttachment(interventionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachment: InterventionAttachment) => deleteAttachment(attachment),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: qk.interventions.attachments(interventionId),
      });
    },
  });
}

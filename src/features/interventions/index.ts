/** API publique de la feature « interventions ». */
export {
  approveReport,
  buildAttachmentPath,
  completeIntervention,
  createReport,
  deleteAttachment,
  getAttachmentUrl,
  getIntervention,
  listAttachments,
  listInterventions,
  listOrganizationInterventions,
  listReportsPendingReview,
  rejectReport,
  startIntervention,
  submitReport,
  updateIntervention,
  updateReport,
  uploadAttachment,
  getOpenTimeEntry,
  getWorkedSeconds,
  listTimeEntries,
  stopTimeTracking,
  switchTimeEntry,
} from './api/interventions.api';

export {
  useCompleteIntervention,
  useIntervention,
  useMissionInterventions,
  useOrganizationInterventions,
  useStartIntervention,
  useSwitchTimeEntry,
  useTimeEntries,
  useUpdateInterventionNotes,
  useWorkedSeconds,
} from './hooks/useInterventions';

export {
  useAttachmentUrl,
  useAttachments,
  useCreateReport,
  useDeleteAttachment,
  useReportStatusCounts,
  useReportsPendingReview,
  useReviewReport,
  useSaveReport,
  useSubmitReport,
  useUploadAttachment,
} from './hooks/useReports';

export { AttachmentGallery } from './components/AttachmentGallery';
export { InterventionTimer } from './components/InterventionTimer';
export { MissionInterventionsPanel } from './components/MissionInterventionsPanel';
export { SignaturePadModal } from './components/SignaturePadModal';
export { InterventionPdfModal } from './components/InterventionPdfModal';

export {
  clearLocalReportDraft,
  readLocalReportDraft,
  writeLocalReportDraft,
  type LocalReportDraft,
} from './local-report-draft';

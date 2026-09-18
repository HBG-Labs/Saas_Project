import type { ReceivedInvoiceInternalStatus } from '@/types/database';

/** Triage métier — distinct du statut réglementaire transmis par SUPER PDP. */
export const RECEIVED_INVOICE_STATUS_LABELS: Record<ReceivedInvoiceInternalStatus, string> = {
  new: 'Nouvelle',
  viewed: 'Vue',
  archived: 'Archivée',
  disputed: 'Contestée',
};

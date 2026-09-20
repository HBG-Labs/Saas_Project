/**
 * API publique de la feature Factures.
 *
 * Tout import depuis l'extérieur passe par ce point d'entrée : la règle ESLint
 * `no-restricted-imports` interdit d'atteindre `api/` ou `hooks/` directement.
 * Une frontière que l'outillage ne tient pas finit toujours par être franchie
 * sous la pression du délai.
 */

export {
  createInvoice,
  createInvoiceFromQuote,
  deleteInvoice,
  estFigee,
  getInvoice,
  issueInvoice,
  listInvoiceItems,
  listInvoices,
  listInvoicesWithTotals,
  replaceInvoiceItems,
  toCents,
  toEuros,
  updateInvoice,
  saveInvoiceDraft,
  STATUTS_FIGES,
  PAYMENT_METHOD_LABELS,
  listInvoicePayments,
  getInvoiceBalance,
  recordPayment,
  updateInvoicePayment,
  deleteInvoicePayment,
  CREDIT_ORIGIN_LABELS,
  listCustomerCredits,
  getCustomerAccount,
  listCreditAllocations,
  listCreditRefunds,
  listInvoiceAllocations,
  allocateCredit,
  deleteCreditAllocation,
  refundCredit,
  updateCreditRefund,
  deleteCreditRefund,
  type CustomerCredit,
  type CustomerCreditBalance,
  type CreditAllocation,
  type CreditRefund,
  type CustomerAccount,
  type AllocateCreditInput,
  type RefundCreditInput,
  type CreateInvoiceInput,
  type InvoiceFilters,
  type InvoiceLineInput,
  type InvoicePayment,
  type InvoiceBalance,
  type RecordPaymentInput,
} from './api/invoices.api';

export {
  useCreateInvoice,
  useCreateInvoiceFromQuote,
  useDeleteInvoice,
  useInvoice,
  useInvoices,
  useIssueInvoice,
  useReplaceInvoiceItems,
  useUpdateInvoice,
  useSaveInvoiceDraft,
  useInvoicePayments,
  useInvoiceBalance,
  useRecordPayment,
  useUpdateInvoicePayment,
  useDeleteInvoicePayment,
  useCustomerCredits,
  useCustomerAccount,
  useCreditMovements,
  useInvoiceAllocations,
  useAllocateCredit,
  useDeleteCreditAllocation,
  useRefundCredit,
  useUpdateCreditRefund,
  useDeleteCreditRefund,
} from './hooks/useInvoices';

export { InvoiceDraftEditor } from './components/InvoiceDraftEditor';
export {
  CreateCreditNotePanel,
  CreditNoteDraftEditor,
  CreditNoteOrigin,
} from './components/CreditNoteWorkflow';

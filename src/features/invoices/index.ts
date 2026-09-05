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
  type CreateInvoiceInput,
  type InvoiceFilters,
  type InvoiceLineInput,
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
} from './hooks/useInvoices';

export { InvoiceDraftEditor } from './components/InvoiceDraftEditor';
export {
  CreateCreditNotePanel,
  CreditNoteDraftEditor,
  CreditNoteOrigin,
} from './components/CreditNoteWorkflow';

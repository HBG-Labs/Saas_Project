import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { TablesUpdate } from '@/types/database';

import {
  createInvoice,
  createCreditNoteDraft,
  saveFullCreditNoteDraft,
  getRelatedCreditNotes,
  getCreditableInvoiceLines,
  createInvoiceFromQuote,
  deleteInvoice,
  getInvoice,
  issueInvoice,
  listInvoicesWithTotals,
  replaceInvoiceItems,
  updateInvoice,
  saveInvoiceDraft,
  listInvoicePayments,
  getInvoiceBalance,
  recordPayment,
  updateInvoicePayment,
  deleteInvoicePayment,
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
  type AllocateCreditInput,
  type RefundCreditInput,
  type CreateInvoiceInput,
  type InvoiceFilters,
  type InvoiceLineInput,
  type RecordPaymentInput,
} from '../api/invoices.api';

/**
 * Hooks des factures.
 *
 * INVALIDATION LARGE, ET ASSUMÉE
 *
 * Toutes les mutations invalident `qk.invoices.all` plutôt que la seule entrée
 * concernée. Une facture touche trois lectures à la fois — sa fiche, la liste,
 * et les totaux qui viennent d'une vue séparée — et cibler finement laisserait
 * un montant périmé à l'écran sans qu'aucune erreur ne le signale. Le coût est
 * un rechargement de liste ; le bénéfice, un chiffre juste.
 */

export function useInvoices(organizationId: string | null, filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey: qk.invoices.list(organizationId ?? 'none', filters),
    queryFn: () => (organizationId === null ? [] : listInvoicesWithTotals(organizationId, filters)),
    enabled: organizationId !== null,
  });
}

export function useInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: qk.invoices.detail(invoiceId ?? 'none'),
    queryFn: () => (invoiceId === undefined ? null : getInvoice(invoiceId)),
    enabled: invoiceId !== undefined,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => createInvoice(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.invoices.all });
    },
  });
}

export function useRelatedCreditNotes(invoiceId: string) {
  return useQuery({
    queryKey: [...qk.invoices.detail(invoiceId), 'credit-notes'],
    queryFn: () => getRelatedCreditNotes(invoiceId),
  });
}

export function useCreditableInvoiceLines(invoiceId: string) {
  return useQuery({
    queryKey: [...qk.invoices.detail(invoiceId), 'creditable-lines'],
    queryFn: () => getCreditableInvoiceLines(invoiceId),
  });
}

export function useCreateCreditNoteDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCreditNoteDraft,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.invoices.all });
    },
  });
}

export function useSaveFullCreditNoteDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveFullCreditNoteDraft,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.invoices.all });
    },
  });
}

/**
 * Convertit un devis accepté en facture brouillon.
 *
 * Invalide aussi les devis : la fiche du devis affichera désormais la facture
 * qui en découle.
 */
export function useCreateInvoiceFromQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createInvoiceFromQuote,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.invoices.all }),
        queryClient.invalidateQueries({ queryKey: qk.quotes.all }),
      ]);
    },
  });
}

export function useUpdateInvoice(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: TablesUpdate<'invoices'>) => updateInvoice(invoiceId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.invoices.all });
    },
  });
}

export function useSaveInvoiceDraft(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof saveInvoiceDraft>[0], 'invoiceId'>) =>
      saveInvoiceDraft({ invoiceId, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.invoices.all });
    },
  });
}

/** Émet la facture — c'est ce geste qui la fige définitivement. */
export function useIssueInvoice(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expectedUpdatedAt: string) => issueInvoice(invoiceId, expectedUpdatedAt),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.invoices.all });
    },
  });
}

export function useReplaceInvoiceItems(invoiceId: string, organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: readonly InvoiceLineInput[]) =>
      replaceInvoiceItems(invoiceId, organizationId, items),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.invoices.all });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteInvoice,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.invoices.all });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Règlements (D4)
// ─────────────────────────────────────────────────────────────────────────────

export function useInvoicePayments(invoiceId: string | undefined) {
  return useQuery({
    queryKey: [...qk.invoices.detail(invoiceId ?? 'none'), 'payments'],
    queryFn: () => listInvoicePayments(invoiceId ?? ''),
    enabled: invoiceId !== undefined,
  });
}

export function useInvoiceBalance(invoiceId: string | undefined) {
  return useQuery({
    queryKey: [...qk.invoices.detail(invoiceId ?? 'none'), 'balance'],
    queryFn: () => getInvoiceBalance(invoiceId ?? ''),
    enabled: invoiceId !== undefined,
  });
}

/*
  Un règlement change trois choses à la fois : la liste des règlements, le
  solde (vue), et le statut de la facture (trigger). L'invalidation large de
  `qk.invoices.all` couvre les trois — voir l'en-tête de ce fichier.
*/
export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RecordPaymentInput) => recordPayment(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.invoices.all });
    },
  });
}

export function useUpdateInvoicePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      paymentId,
      patch,
    }: {
      paymentId: string;
      patch: TablesUpdate<'invoice_payments'>;
    }) => updateInvoicePayment(paymentId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.invoices.all });
    },
  });
}

export function useDeleteInvoicePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (paymentId: string) => deleteInvoicePayment(paymentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.invoices.all });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Le compte client
//
// Une imputation touche un crédit ET une facture (solde, statut) ; un
// remboursement touche un crédit et son avoir. L'invalidation large de
// `qk.invoices.all` couvre tout ce qui en dépend — comme pour les règlements.
// ─────────────────────────────────────────────────────────────────────────────

export function useCustomerCredits(customerId: string | undefined, onlyOpen = false) {
  return useQuery({
    queryKey: [...qk.invoices.all, 'customer', customerId ?? 'none', 'credits', onlyOpen],
    queryFn: () => listCustomerCredits(customerId ?? '', { onlyOpen }),
    enabled: customerId !== undefined,
  });
}

export function useCustomerAccount(customerId: string | undefined) {
  return useQuery({
    queryKey: [...qk.invoices.all, 'customer', customerId ?? 'none', 'account'],
    queryFn: () => getCustomerAccount(customerId ?? ''),
    enabled: customerId !== undefined,
  });
}

export function useCreditMovements(creditId: string | undefined) {
  return useQuery({
    queryKey: [...qk.invoices.all, 'credit', creditId ?? 'none', 'movements'],
    queryFn: async () => {
      const [allocations, refunds] = await Promise.all([
        listCreditAllocations(creditId ?? ''),
        listCreditRefunds(creditId ?? ''),
      ]);
      return { allocations, refunds };
    },
    enabled: creditId !== undefined,
  });
}

export function useInvoiceAllocations(invoiceId: string | undefined) {
  return useQuery({
    queryKey: [...qk.invoices.detail(invoiceId ?? 'none'), 'allocations'],
    queryFn: () => listInvoiceAllocations(invoiceId ?? ''),
    enabled: invoiceId !== undefined,
  });
}

function useInvalidateInvoices() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: qk.invoices.all });
  };
}

export function useAllocateCredit() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: (input: AllocateCreditInput) => allocateCredit(input),
    onSuccess: invalidate,
  });
}

export function useDeleteCreditAllocation() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: (allocationId: string) => deleteCreditAllocation(allocationId),
    onSuccess: invalidate,
  });
}

export function useRefundCredit() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: (input: RefundCreditInput) => refundCredit(input),
    onSuccess: invalidate,
  });
}

export function useUpdateCreditRefund() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: ({
      refundId,
      patch,
    }: {
      refundId: string;
      patch: TablesUpdate<'credit_refunds'>;
    }) => updateCreditRefund(refundId, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteCreditRefund() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: (refundId: string) => deleteCreditRefund(refundId),
    onSuccess: invalidate,
  });
}

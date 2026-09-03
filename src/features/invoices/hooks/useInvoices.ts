import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { TablesUpdate } from '@/types/database';

import {
  createInvoice,
  createInvoiceFromQuote,
  deleteInvoice,
  getInvoice,
  issueInvoice,
  listInvoicesWithTotals,
  replaceInvoiceItems,
  updateInvoice,
  type CreateInvoiceInput,
  type InvoiceFilters,
  type InvoiceLineInput,
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

/** Émet la facture — c'est ce geste qui la fige définitivement. */
export function useIssueInvoice(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => issueInvoice(invoiceId),
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

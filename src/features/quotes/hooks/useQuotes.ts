import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { Json, TablesUpdate } from '@/types/database';

import {
  createQuote,
  createQuoteTemplate,
  createQuoteTemplates,
  deleteQuote,
  deleteQuoteTemplate,
  ensureQuotePdf,
  getQuote,
  listQuoteReminders,
  listQuotes,
  listQuoteTemplates,
  listQuotesWithTotals,
  updateQuote,
  type QuoteLineInput,
} from '../api/quotes.api';

export function useQuoteTemplates(organizationId: string | null) {
  return useQuery({
    queryKey: qk.quotes.templates(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? [] : listQuoteTemplates(organizationId)),
    enabled: organizationId !== null,
  });
}

export function useCreateQuoteTemplate(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { label: string; unit: string; priceEuros: number }) =>
      createQuoteTemplate({ ...input, organizationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.quotes.templates(organizationId) });
    },
  });
}

export function useSeedQuoteTemplates(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (presets: readonly { label: string; unit: string; priceEuros: number }[]) =>
      createQuoteTemplates(organizationId, presets),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.quotes.templates(organizationId) });
    },
  });
}

export function useDeleteQuoteTemplate(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) => deleteQuoteTemplate(templateId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.quotes.templates(organizationId) });
    },
  });
}

export function useQuotes(organizationId: string | null) {
  return useQuery({
    queryKey: qk.quotes.list(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? [] : listQuotes(organizationId)),
    enabled: organizationId !== null,
  });
}

/**
 * Prépare (ou récupère) le PDF du devis et renvoie son lien signé.
 *
 * Appelée explicitement au moment d'envoyer ou de télécharger. La génération
 * est le geste qui fige atomiquement un brouillon en devis transmis : aucun
 * préchauffage silencieux ne doit donc partir à l'ouverture de la fiche.
 */
export function useEnsureQuotePdf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ensureQuotePdf,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.quotes.all });
    },
  });
}

export function useQuoteReminders(quoteId: string | undefined) {
  return useQuery({
    queryKey: qk.quotes.reminders(quoteId ?? 'none'),
    queryFn: () => (quoteId === undefined ? [] : listQuoteReminders(quoteId)),
    enabled: quoteId !== undefined,
  });
}

export function useQuote(quoteId: string | undefined) {
  return useQuery({
    queryKey: qk.quotes.detail(quoteId ?? 'none'),
    queryFn: () => (quoteId === undefined ? null : getQuote(quoteId)),
    enabled: quoteId !== undefined,
  });
}

/**
 * L'historique, montants compris — ce que consulte `QuoteHistoryPage`.
 *
 * Clé de cache distincte de `useQuotes` (`'with-totals'` en filtre) : les deux
 * lisent la même table `quotes` mais ne renvoient pas la même forme, et
 * `useQuotes` reste utilisée telle quelle par `AnalyticsPage`, qui n'a besoin
 * que des statuts, pas des montants.
 */
export function useQuotesWithTotals(organizationId: string | null) {
  return useQuery({
    queryKey: qk.quotes.list(organizationId ?? 'none', 'with-totals'),
    queryFn: () => (organizationId === null ? [] : listQuotesWithTotals(organizationId)),
    enabled: organizationId !== null,
  });
}

export function useCreateQuote(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      title?: string;
      customerId?: string | null;
      siteId?: string | null;
      customerName?: string;
      siteName?: string;
      vatRate: number;
      discountRate?: number;
      documentOptions?: Json;
      notes?: string;
      issueDate?: string;
      validUntil?: string;
      items: readonly QuoteLineInput[];
    }) => createQuote({ ...input, organizationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.quotes.all });
    },
  });
}

/** Changement de statut ou modification d'en-tête — jamais les lignes, non éditables après coup. */
export function useUpdateQuote(quoteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: TablesUpdate<'quotes'>) => updateQuote(quoteId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.quotes.all });
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (quoteId: string) => deleteQuote(quoteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.quotes.all });
    },
  });
}

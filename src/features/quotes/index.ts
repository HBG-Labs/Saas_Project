/**
 * API publique de la feature « devis ».
 *
 * Les pages importent d'ici, jamais d'un fichier interne — même règle que pour
 * les autres features, appliquée par `no-restricted-imports`.
 */
export {
  useCreateQuote,
  useCreateQuoteTemplate,
  useDeleteQuote,
  useDeleteQuoteTemplate,
  useEnsureQuotePdf,
  useQuote,
  useQuoteReminders,
  useQuoteTemplates,
  useQuotes,
  useQuotesWithTotals,
  useSeedQuoteTemplates,
  useUpdateQuote,
} from './hooks/useQuotes';

export {
  DEFAULT_QUOTE_PAYMENT_METHOD,
  DEFAULT_QUOTE_PAYMENT_TERMS,
  toCents,
  toEuros,
  type QuoteLineInput,
  type QuotePdfDocument,
  type QuoteReminder,
} from './api/quotes.api';

export { QuoteRemindersCard } from './components/QuoteRemindersCard';

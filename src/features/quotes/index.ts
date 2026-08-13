/**
 * API publique de la feature « devis ».
 *
 * Les pages importent d'ici, jamais d'un fichier interne — même règle que pour
 * les autres features, appliquée par `no-restricted-imports`.
 */
export {
  useCreateQuote,
  useCreateQuoteTemplate,
  useDeleteQuoteTemplate,
  useQuote,
  useQuoteTemplates,
  useQuotes,
  useSeedQuoteTemplates,
} from './hooks/useQuotes';

export { toCents, toEuros, type QuoteLineInput } from './api/quotes.api';

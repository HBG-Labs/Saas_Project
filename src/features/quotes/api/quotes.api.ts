import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { TablesInsert, TablesUpdate } from '@/types/database';
import type { Quote, QuoteItem, QuoteTemplate, QuoteTotals, QuoteWithItems, QuoteWithTotals } from '@/types/domain';

/**
 * Accès aux devis et au catalogue de prestations.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES MONTANTS CIRCULENT EN CENTIMES
 *
 * La base stocke des entiers ; l'interface manipule des euros décimaux. La
 * conversion se fait ICI, aux deux frontières, et nulle part ailleurs :
 * `toCents` / `toEuros`. Laisser un flottant descendre jusqu'à la base ferait
 * apparaître des totaux à un centime près, que le client conteste.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Les totaux ne sont jamais calculés ici : la vue `quote_totals` s'en charge,
 * avec le même arrondi que celui qui figurera sur le document remis.
 */

/** Euros décimaux → centimes entiers. `3.5` → `350`. */
export function toCents(euros: number): number {
  return Math.round(euros * 100);
}

/** Centimes entiers → euros décimaux. `350` → `3.5`. */
export function toEuros(cents: number): number {
  return cents / 100;
}

/**
 * Texte affiché sur le devis tant que l'organisation n'a pas personnalisé
 * `quote_payment_terms` / `quote_payment_method` (voir Paramètres > Entreprise).
 * Reprend mot pour mot le texte auparavant codé en dur, pour qu'aucune
 * organisation existante ne voie son devis changer sans l'avoir demandé.
 */
export const DEFAULT_QUOTE_PAYMENT_TERMS = 'Paiement à 30 jours à compter de la réception.';
export const DEFAULT_QUOTE_PAYMENT_METHOD = 'Virement bancaire / Carte bancaire Pro.';

// -----------------------------------------------------------------------------
// Catalogue de prestations
// -----------------------------------------------------------------------------

export async function listQuoteTemplates(organizationId: string): Promise<QuoteTemplate[]> {
  return unwrap(
    supabase
      .from('quote_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true }),
  );
}

export async function createQuoteTemplate(input: {
  organizationId: string;
  label: string;
  unit: string;
  priceEuros: number;
}): Promise<QuoteTemplate> {
  return unwrap(
    supabase
      .from('quote_templates')
      .insert({
        organization_id: input.organizationId,
        label: input.label,
        unit: input.unit,
        unit_price_cents: toCents(input.priceEuros),
      })
      .select('*')
      .single(),
  );
}

/**
 * Ajoute plusieurs prestations d'un coup.
 *
 * Sert à l'amorçage : une organisation qui vient de naître part d'un catalogue
 * vide, et retaper six prestations standard une par une avant de pouvoir chiffrer
 * quoi que ce soit est un mauvais premier contact avec l'outil.
 */
export async function createQuoteTemplates(
  organizationId: string,
  presets: readonly { label: string; unit: string; priceEuros: number }[],
): Promise<QuoteTemplate[]> {
  if (presets.length === 0) return [];

  return unwrap(
    supabase
      .from('quote_templates')
      .insert(
        presets.map((preset, index) => ({
          organization_id: organizationId,
          label: preset.label,
          unit: preset.unit,
          unit_price_cents: toCents(preset.priceEuros),
          sort_order: index * 10,
        })),
      )
      .select('*'),
  );
}

/**
 * Retire une prestation du catalogue.
 *
 * Suppression réelle et non archivage : les lignes de devis COPIENT le libellé
 * et le prix au moment de leur création, elles ne pointent pas vers le modèle.
 * Rien de ce qui a été chiffré n'est donc perdu.
 */
export async function deleteQuoteTemplate(templateId: string): Promise<void> {
  const { error } = await supabase.from('quote_templates').delete().eq('id', templateId);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Devis
// -----------------------------------------------------------------------------

export async function listQuotes(organizationId: string, limit = 50): Promise<Quote[]> {
  return unwrap(
    supabase
      .from('quotes')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit),
  );
}

/**
 * L'historique, montants compris.
 *
 * Même raison qu'expliquée pour `getQuote` : `quote_totals` est une vue sans
 * clé étrangère déclarée, PostgREST ne peut pas la joindre à `quotes` en une
 * seule requête. Deux lectures en parallèle, scindées par `quote_id` — le
 * coût est un aller simultané, pas un aller-retour de plus.
 */
export async function listQuotesWithTotals(
  organizationId: string,
  limit = 50,
): Promise<QuoteWithTotals[]> {
  const [quotes, totals] = await Promise.all([
    listQuotes(organizationId, limit),
    unwrap(
      supabase.from('quote_totals').select('*').eq('organization_id', organizationId),
    ) as Promise<QuoteTotals[]>,
  ]);

  const totalsByQuoteId = new Map(totals.map((t) => [t.quote_id, t]));

  return quotes.map((quote) => ({ ...quote, totals: totalsByQuoteId.get(quote.id) ?? null }));
}

/**
 * Devis complet : en-tête, lignes et totaux.
 *
 * Les totaux sont lus SÉPARÉMENT, et non imbriqués dans la requête principale.
 * `quote_totals` est une vue : elle ne porte aucune clé étrangère, et PostgREST
 * déduit ses jointures des clés déclarées. `totals:quote_totals(*)` échouait
 * donc avec « Could not find a relationship between 'quotes' and
 * 'quote_totals' ».
 *
 * Deux requêtes plutôt qu'une, exécutées en parallèle : le coût est un aller
 * simultané, pas un aller-retour supplémentaire.
 */
export async function getQuote(quoteId: string): Promise<QuoteWithItems | null> {
  const [quote, totals] = await Promise.all([
    unwrapMaybe(
      supabase
        .from('quotes')
        .select('*, items:quote_items(*)')
        .eq('id', quoteId)
        .single()
        .returns<Omit<QuoteWithItems, 'totals'>>(),
    ),
    unwrapMaybe(supabase.from('quote_totals').select('*').eq('quote_id', quoteId).maybeSingle()),
  ]);

  if (quote === null) return null;

  return {
    ...quote,
    items: [...quote.items].sort((a, b) => a.position - b.position),
    totals,
  };
}

export interface QuoteLineInput {
  description: string;
  unit: string;
  quantity: number;
  priceEuros: number;
}

/**
 * Enregistre un devis complet : l'en-tête puis ses lignes.
 *
 * Deux écritures faute de transaction côté client. Si la seconde échoue, le
 * devis existe sans ses lignes — visible, corrigeable, et de loin préférable à
 * des lignes orphelines qu'aucun devis ne réclame.
 *
 * `reference` n'est pas fournie : le trigger `quotes_generate_reference` produit
 * `DEV-nnnn` par organisation. La calculer ici donnerait le même numéro à deux
 * devis créés en même temps.
 */
export async function createQuote(input: {
  organizationId: string;
  title?: string;
  customerId?: string | null;
  siteId?: string | null;
  customerName?: string;
  siteName?: string;
  vatRate: number;
  items: readonly QuoteLineInput[];
}): Promise<Quote> {
  const { data: userData } = await supabase.auth.getUser();

  const payload: TablesInsert<'quotes'> = {
    organization_id: input.organizationId,
    vat_rate: input.vatRate,
    ...(userData?.user ? { created_by: userData.user.id } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.customerId ? { customer_id: input.customerId } : {}),
    ...(input.siteId ? { site_id: input.siteId } : {}),
    ...(input.customerName !== undefined ? { customer_name: input.customerName } : {}),
    ...(input.siteName !== undefined ? { site_name: input.siteName } : {}),
  };

  const quote = await unwrap(supabase.from('quotes').insert(payload).select('*').single());

  if (input.items.length > 0) {
    await unwrap(
      supabase
        .from('quote_items')
        .insert(
          input.items.map((item, index) => ({
            quote_id: quote.id,
            // Écrasé par le trigger depuis le devis parent ; la colonne est
            // `not null`, d'où sa présence.
            organization_id: input.organizationId,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unit_price_cents: toCents(item.priceEuros),
            position: index,
          })),
        )
        .select('id'),
    );
  }

  return quote;
}

export async function updateQuote(
  quoteId: string,
  patch: TablesUpdate<'quotes'>,
): Promise<Quote> {
  return unwrap(supabase.from('quotes').update(patch).eq('id', quoteId).select('*').single());
}

export async function deleteQuote(quoteId: string): Promise<void> {
  const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
  if (error) throw error;
}

export async function listQuoteItems(quoteId: string): Promise<QuoteItem[]> {
  return unwrap(
    supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('position', { ascending: true }),
  );
}

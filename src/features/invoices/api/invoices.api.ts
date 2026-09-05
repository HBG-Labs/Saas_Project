import { AppError } from '@/lib/errors';
import { validerFactureAvantEmission } from '@/features/einvoicing';
import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type {
  CustomerType,
  Database,
  InvoiceStatus,
  TablesInsert,
  TablesUpdate,
  VatCategory,
} from '@/types/database';
import type {
  Invoice,
  InvoiceItem,
  InvoiceTotals,
  InvoiceVatBreakdown,
  InvoiceWithItems,
  InvoiceWithTotals,
} from '@/types/domain';
import {
  DEFAULT_EARLY_PAYMENT_TERMS,
  suggestedOperationType,
  type InvoiceOperationType,
} from '../draft-defaults';

/**
 * Accès aux factures et aux avoirs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE COUCHE NE DÉCIDE PAS
 *
 * Ni le numéro, ni les totaux, ni le droit d'écrire. Le numéro vient d'un
 * trigger qui prélève un compteur verrouillé — le calculer ici donnerait le
 * même à deux factures créées en même temps. Les totaux viennent des vues, avec
 * l'arrondi par taux de TVA qu'impose EN 16931. Le droit vient des policies.
 *
 * Ce qui reste ici : la conversion euros ↔ centimes, et l'ordre des écritures.
 *
 * UNE FACTURE ÉMISE NE SE MODIFIE PLUS
 *
 * `app.enforce_invoice_immutable` refuse toute modification des champs
 * comptables dès que le statut n'est plus `draft`, et `invoices_undeletable`
 * refuse la suppression. Ces fonctions ne contournent pas ces règles : elles
 * les rendent lisibles à l'appelant, pour qu'il n'ait pas à découvrir le refus
 * au moment de l'écriture.
 * ─────────────────────────────────────────────────────────────────────────────
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
 * Statuts au-delà desquels le document est figé.
 *
 * Exporté parce que l'interface doit pouvoir masquer une action AVANT que la
 * base ne la refuse : proposer « Modifier » sur une facture émise pour afficher
 * ensuite une erreur serait une promesse non tenue.
 */
export const STATUTS_FIGES: readonly InvoiceStatus[] = ['issued', 'sent', 'paid', 'cancelled'];

export function estFigee(invoice: Pick<Invoice, 'status'>): boolean {
  return STATUTS_FIGES.includes(invoice.status);
}

// -----------------------------------------------------------------------------
// Lecture
// -----------------------------------------------------------------------------

export interface InvoiceFilters {
  status?: InvoiceStatus;
  customerId?: string;
  limit?: number;
}

export async function listInvoices(
  organizationId: string,
  filters: InvoiceFilters = {},
): Promise<Invoice[]> {
  let query = supabase.from('invoices').select('*').eq('organization_id', organizationId);

  if (filters.status !== undefined) query = query.eq('status', filters.status);
  if (filters.customerId !== undefined) query = query.eq('customer_id', filters.customerId);

  return unwrap(
    query
      // Les brouillons n'ont pas de date d'émission : `nulls first` les garde en
      // tête de liste, là où ils réclament une action.
      .order('issued_at', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
      .limit(filters.limit ?? 100),
  );
}

/**
 * La liste, montants compris.
 *
 * Deux lectures en parallèle plutôt qu'une jointure : `invoice_totals` est une
 * vue, elle ne porte aucune clé étrangère, et PostgREST déduit ses jointures des
 * clés déclarées. Le coût est un aller simultané, pas un aller-retour de plus.
 */
export async function listInvoicesWithTotals(
  organizationId: string,
  filters: InvoiceFilters = {},
): Promise<InvoiceWithTotals[]> {
  const [invoices, totals] = await Promise.all([
    listInvoices(organizationId, filters),
    unwrap(
      supabase.from('invoice_totals').select('*').eq('organization_id', organizationId),
    ) as Promise<InvoiceTotals[]>,
  ]);

  const parId = new Map(totals.map((t) => [t.invoice_id, t]));

  return invoices.map((invoice) => ({ ...invoice, totals: parId.get(invoice.id) ?? null }));
}

/** Facture complète : en-tête, lignes, totaux et ventilation de TVA. */
export async function getInvoice(invoiceId: string): Promise<InvoiceWithItems | null> {
  const [invoice, totals, breakdown] = await Promise.all([
    unwrapMaybe(
      supabase
        .from('invoices')
        .select('*, items:invoice_items(*)')
        .eq('id', invoiceId)
        .single()
        .returns<Omit<InvoiceWithItems, 'totals' | 'vatBreakdown'>>(),
    ),
    unwrapMaybe(
      supabase.from('invoice_totals').select('*').eq('invoice_id', invoiceId).maybeSingle(),
    ),
    unwrap(
      supabase.from('invoice_vat_breakdown').select('*').eq('invoice_id', invoiceId),
    ) as Promise<InvoiceVatBreakdown[]>,
  ]);

  if (invoice === null) return null;

  return {
    ...invoice,
    items: [...invoice.items].sort((a, b) => a.position - b.position),
    totals,
    // Du taux le plus faible au plus élevé : c'est l'ordre attendu sur un
    // récapitulatif de TVA.
    vatBreakdown: [...breakdown].sort((a, b) => a.vat_rate - b.vat_rate),
  };
}

export async function listInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  return unwrap(
    supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('position', { ascending: true }),
  );
}

export async function getRelatedCreditNotes(invoiceId: string): Promise<Invoice[]> {
  return unwrap(
    supabase
      .from('invoices')
      .select('*')
      .eq('corrects_invoice_id', invoiceId)
      .eq('document_type', 'credit_note')
      .order('created_at', { ascending: false }),
  );
}

export type CreditableInvoiceLine =
  Database['public']['Functions']['get_creditable_invoice_lines']['Returns'][number];

export async function getCreditableInvoiceLines(
  invoiceId: string,
): Promise<CreditableInvoiceLine[]> {
  return unwrap(supabase.rpc('get_creditable_invoice_lines', { p_invoice_id: invoiceId }));
}

/** The server copies only selected original lines and reuses an existing draft. */
export async function createCreditNoteDraft(input: {
  invoiceId: string;
  expectedUpdatedAt: string;
  reason: string;
  scope: 'full' | 'partial';
  lines: Array<{ invoiceItemId: string; quantity: number }>;
}): Promise<Invoice> {
  return unwrap(
    supabase.rpc('create_credit_note_draft', {
      p_invoice_id: input.invoiceId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_reason: input.reason.trim(),
      p_scope: input.scope,
      p_lines: input.lines.map((line) => ({
        invoice_item_id: line.invoiceItemId,
        quantity: line.quantity,
      })),
    }),
  );
}

export async function saveFullCreditNoteDraft(input: {
  invoiceId: string;
  expectedUpdatedAt: string;
  reason: string;
  dueDate: string;
  paymentTerms: string;
}): Promise<Invoice> {
  return unwrap(
    supabase.rpc('save_full_credit_note_draft', {
      p_invoice_id: input.invoiceId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_reason: input.reason.trim(),
      p_due_date: input.dueDate,
      p_payment_terms: input.paymentTerms.trim(),
    }),
  );
}

// -----------------------------------------------------------------------------
// Écriture
// -----------------------------------------------------------------------------

export interface InvoiceLineInput {
  description: string;
  unit: string;
  quantity: number;
  priceEuros: number;
  vatRate: number;
  vatCategory?: VatCategory;
  vatExemptionReason?: string;
}

export interface CreateInvoiceInput {
  organizationId: string;
  title?: string;
  customerId?: string | null;
  siteId?: string | null;
  quoteId?: string | null;
  /** Instantané du destinataire, figé sur le document. */
  customer?: {
    name?: string | null;
    legalName?: string | null;
    registrationNumber?: string | null;
    vatNumber?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
    /**
     * Fige aussi la NATURE du destinataire : c'est elle qui commande les
     * mentions obligatoires. La relire sur la fiche client apres coup
     * changerait le verdict si le client est requalifie plus tard.
     */
    type?: CustomerType | null;
  };
  siteName?: string | null;
  dueDate?: string | null;
  paymentTerms?: string | null;
  paymentMethod?: string | null;
  operationType?: InvoiceOperationType | null;
  earlyPaymentTerms?: string | null;
  notes?: string | null;
  items: readonly InvoiceLineInput[];
}

/**
 * Crée une facture en BROUILLON, avec ses lignes.
 *
 * Deux écritures faute de transaction côté client. Si la seconde échoue, la
 * facture existe sans ses lignes — visible, corrigeable, et de loin préférable à
 * des lignes orphelines qu'aucune facture ne réclame. C'est aussi pour cela
 * qu'on crée en brouillon : un document incomplet ne doit pas consommer un
 * numéro de la série définitive.
 *
 * La base attribue une référence provisoire ; le numéro définitif vient à l’émission.
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    throw new AppError('unauthenticated', 'Vous devez être connecté pour créer une facture.');
  }

  const c = input.customer;

  const payload: TablesInsert<'invoices'> = {
    organization_id: input.organizationId,
    created_by: userData.user.id,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.customerId ? { customer_id: input.customerId } : {}),
    ...(input.siteId ? { site_id: input.siteId } : {}),
    ...(input.quoteId ? { quote_id: input.quoteId } : {}),
    ...(c?.name !== undefined ? { customer_name: c.name } : {}),
    ...(c?.legalName !== undefined ? { customer_legal_name: c.legalName } : {}),
    ...(c?.registrationNumber !== undefined
      ? { customer_registration_number: c.registrationNumber }
      : {}),
    ...(c?.vatNumber !== undefined ? { customer_vat_number: c.vatNumber } : {}),
    ...(c?.addressLine1 !== undefined ? { customer_address_line1: c.addressLine1 } : {}),
    ...(c?.addressLine2 !== undefined ? { customer_address_line2: c.addressLine2 } : {}),
    ...(c?.postalCode !== undefined ? { customer_postal_code: c.postalCode } : {}),
    ...(c?.city !== undefined ? { customer_city: c.city } : {}),
    ...(c?.country !== undefined ? { customer_country: c.country } : {}),
    ...(c?.type !== undefined ? { customer_type: c.type } : {}),
    ...(input.siteName !== undefined ? { site_name: input.siteName } : {}),
    ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
    ...(input.paymentTerms !== undefined ? { payment_terms: input.paymentTerms } : {}),
    ...(input.paymentMethod !== undefined ? { payment_method: input.paymentMethod } : {}),
    ...(input.operationType !== undefined ? { operation_type: input.operationType } : {}),
    ...(input.earlyPaymentTerms !== undefined
      ? { early_payment_terms: input.earlyPaymentTerms }
      : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };

  const invoice = await unwrap(supabase.from('invoices').insert(payload).select('*').single());

  if (input.items.length > 0) {
    await insertInvoiceItems(invoice.id, input.organizationId, input.items);
  }

  return invoice;
}

async function insertInvoiceItems(
  invoiceId: string,
  organizationId: string,
  items: readonly InvoiceLineInput[],
): Promise<void> {
  await unwrap(
    supabase
      .from('invoice_items')
      .insert(
        items.map((item, index) => ({
          invoice_id: invoiceId,
          // Écrasé par le trigger depuis la facture parente ; la colonne est
          // `not null`, d'où sa présence.
          organization_id: organizationId,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unit_price_cents: toCents(item.priceEuros),
          vat_rate: item.vatRate,
          ...(item.vatCategory !== undefined ? { vat_category: item.vatCategory } : {}),
          ...(item.vatExemptionReason !== undefined
            ? { vat_exemption_reason: item.vatExemptionReason }
            : {}),
          position: index,
        })),
      )
      .select('id'),
  );
}

export async function updateInvoice(
  invoiceId: string,
  patch: TablesUpdate<'invoices'>,
): Promise<Invoice> {
  return unwrap(supabase.from('invoices').update(patch).eq('id', invoiceId).select('*').single());
}

/** Valide puis émet ; la base attribue la date, le numéro et fige les identités. */
export async function issueInvoice(invoiceId: string, expectedUpdatedAt: string): Promise<Invoice> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new AppError('not_found', 'Facture introuvable.');
  if (invoice.status !== 'draft')
    throw new AppError('conflict', 'Cette facture a déjà été émise. Actualisez la page.');
  if (invoice.updated_at !== expectedUpdatedAt)
    throw new AppError(
      'conflict',
      'Cette facture a changé depuis son ouverture. Actualisez-la et relisez-la avant de l’émettre.',
    );
  const organization = await unwrapMaybe(
    supabase.from('organizations').select('*').eq('id', invoice.organization_id).single(),
  );
  const verdict = validerFactureAvantEmission(invoice, organization);
  if (!verdict.emissionPossible)
    throw new AppError(
      'validation',
      `Complétez la facture avant de l’émettre : ${verdict.bloquants.map((m) => m.message).join(' ; ')}.`,
    );
  return unwrap(
    supabase.rpc('issue_invoice', {
      p_invoice_id: invoiceId,
      p_expected_updated_at: invoice.updated_at,
    }),
  );
}

/** L'en-tête et les lignes sont enregistrés dans une même transaction. */
export async function saveInvoiceDraft(input: {
  invoiceId: string;
  expectedUpdatedAt: string;
  patch: TablesUpdate<'invoices'>;
  items: readonly InvoiceLineInput[];
}): Promise<Invoice> {
  const result = await supabase.rpc('save_invoice_draft', {
    p_invoice_id: input.invoiceId,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_patch: { ...input.patch },
    p_items: input.items.map((item) => ({
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unit_price_cents: toCents(item.priceEuros),
      vat_rate: item.vatRate,
      vat_category: item.vatCategory ?? 'S',
      vat_exemption_reason: item.vatExemptionReason || null,
    })),
  });
  if (result.error?.code === '40001')
    throw new AppError(
      'conflict',
      'Ce brouillon a été modifié dans une autre session. Fermez cet éditeur, actualisez la facture, puis reprenez vos changements.',
    );
  return unwrap(Promise.resolve(result));
}

/**
 * Supprime une facture — refusé par la base dès qu'elle est émise.
 *
 * Le contrôle est ici AUSSI, et non seulement en base : laisser l'interface
 * proposer l'action pour afficher ensuite une erreur PostgreSQL brute serait un
 * mauvais service. La base reste l'autorité, ceci n'est que de la courtoisie.
 */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
  if (error) throw error;
}

export async function replaceInvoiceItems(
  invoiceId: string,
  organizationId: string,
  items: readonly InvoiceLineInput[],
): Promise<void> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new AppError('not_found', 'Facture introuvable.');
  if (invoice.organization_id !== organizationId)
    throw new AppError('forbidden', 'Facture inaccessible.');
  await saveInvoiceDraft({ invoiceId, expectedUpdatedAt: invoice.updated_at, patch: {}, items });
}

// -----------------------------------------------------------------------------
// Conversion depuis un devis
// -----------------------------------------------------------------------------

/**
 * Transforme un devis accepté en facture brouillon.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI L'IDENTITÉ DU CLIENT EST RELUE, ET NON REPRISE DU DEVIS
 *
 * Un devis ne retient du client que son nom. Une facture doit porter sa raison
 * sociale, son SIRET et son numéro de TVA — mentions obligatoires, et données
 * structurées exigées par EN 16931. On relit donc la fiche client au moment de
 * la conversion, et l'on fige ce qu'elle dit CE JOUR-LÀ.
 *
 * Si le client a été supprimé depuis, `customer_id` est nul : on retombe sur le
 * nom figé du devis, et la facture partira incomplète. C'est voulu — la couche
 * de validation le signalera avant émission plutôt que de bloquer une création.
 *
 * LE TAUX DE TVA DU DEVIS S'APPLIQUE À TOUTES LES LIGNES
 *
 * Un devis n'a qu'un taux ; une facture en accepte un par ligne. La conversion
 * recopie donc le taux unique sur chaque ligne, ce qui est fidèle au devis. Rien
 * n'empêche ensuite de l'affiner ligne à ligne tant que la facture est un
 * brouillon.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function createInvoiceFromQuote(input: {
  quoteId: string;
  organizationId: string;
  dueDate?: string | null;
  paymentTerms?: string | null;
  paymentMethod?: string | null;
}): Promise<Invoice> {
  const quote = await unwrapMaybe(
    supabase
      .from('quotes')
      .select('*, items:quote_items(*)')
      .eq('id', input.quoteId)
      .single()
      .returns<{
        id: string;
        status: string;
        organization_id: string;
        title: string | null;
        customer_id: string | null;
        site_id: string | null;
        customer_name: string | null;
        site_name: string | null;
        vat_rate: number;
        notes: string | null;
        items: {
          description: string;
          unit: string;
          quantity: number;
          unit_price_cents: number;
          position: number;
        }[];
      }>(),
  );

  if (quote === null) {
    throw new AppError('not_found', 'Devis introuvable.');
  }

  if (quote.organization_id !== input.organizationId) {
    throw new AppError('forbidden', "Ce devis n'appartient pas à cette organisation.");
  }

  if (quote.status !== 'accepted')
    throw new AppError('validation', 'Seul un devis accepté peut être facturé.');

  const customer =
    quote.customer_id === null
      ? null
      : await unwrapMaybe(
          supabase.from('customers').select('*').eq('id', quote.customer_id).maybeSingle(),
        );

  const lignes = [...quote.items]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      priceEuros: toEuros(item.unit_price_cents),
      vatRate: quote.vat_rate,
    }));

  return createInvoice({
    organizationId: input.organizationId,
    quoteId: quote.id,
    ...(quote.title !== null ? { title: quote.title } : {}),
    customerId: quote.customer_id,
    siteId: quote.site_id,
    siteName: quote.site_name,
    customer: {
      name: customer?.name ?? quote.customer_name,
      legalName: customer?.legal_name ?? null,
      registrationNumber: customer?.registration_number ?? null,
      vatNumber: customer?.vat_number ?? null,
      addressLine1: customer?.address_line1 ?? null,
      addressLine2: customer?.address_line2 ?? null,
      postalCode: customer?.postal_code ?? null,
      city: customer?.city ?? null,
      country: customer?.country ?? null,
      type: customer?.customer_type ?? null,
    },
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.paymentTerms !== undefined ? { paymentTerms: input.paymentTerms } : {}),
    ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
    operationType: suggestedOperationType(lignes),
    earlyPaymentTerms: DEFAULT_EARLY_PAYMENT_TERMS,
    ...(quote.notes !== null ? { notes: quote.notes } : {}),
    items: lignes,
  });
}

import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type {
  ReceivedInvoice,
  ReceivedInvoiceDocument,
  ReceivedInvoiceEvent,
} from '@/types/domain';
import type { ReceivedInvoiceInternalStatus } from '@/types/database';

const RECEIVED_INVOICES_PER_PAGE = 25;

/** Colonnes triables de la liste (§ tableau `ReceivedInvoicesTable`). */
export type ReceivedInvoiceSortColumn =
  | 'supplier_name'
  | 'received_at'
  | 'payment_due_date'
  | 'amount_with_vat'
  | 'internal_status';

export interface ReceivedInvoiceFilters {
  search?: string;
  // `| undefined` explicite : ce filtre se pose ET se retire (choix « tous »
  // du menu déroulant) — avec `exactOptionalPropertyTypes`, une propriété
  // simplement optionnelle refuse qu'on lui assigne `undefined`.
  internalStatus?: ReceivedInvoiceInternalStatus | undefined;
  page?: number;
  /** Absent = tri par défaut (réception la plus récente d'abord). */
  sortBy?: ReceivedInvoiceSortColumn | undefined;
  sortDirection?: 'asc' | 'desc' | undefined;
}

export interface ReceivedInvoiceListResult {
  rows: ReceivedInvoice[];
  total: number;
}

export async function listReceivedInvoices(
  organizationId: string,
  filters: ReceivedInvoiceFilters = {},
): Promise<ReceivedInvoiceListResult> {
  const page = filters.page ?? 0;
  const start = page * RECEIVED_INVOICES_PER_PAGE;

  let query = supabase
    .from('received_invoices')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (filters.internalStatus) query = query.eq('internal_status', filters.internalStatus);

  const term = filters.search?.trim();
  if (term) {
    // `%`, `,` et les parenthèses sont la syntaxe du filtre `or` de PostgREST.
    const safe = term.replace(/[%,()]/g, ' ').trim();
    if (safe !== '') {
      query = query.or(
        `supplier_name.ilike.%${safe}%,supplier_siren.ilike.%${safe}%,supplier_identifier.ilike.%${safe}%`,
      );
    }
  }

  const ascending = filters.sortDirection === 'asc';
  switch (filters.sortBy) {
    case 'supplier_name':
      query = query.order('supplier_name', { ascending });
      break;
    case 'payment_due_date':
      query = query.order('payment_due_date', { ascending });
      break;
    case 'amount_with_vat':
      query = query.order('amount_with_vat', { ascending });
      break;
    case 'internal_status':
      query = query.order('internal_status', { ascending });
      break;
    case 'received_at':
      query = query.order('received_at', { ascending });
      break;
    default:
      // Par défaut (aucune colonne cliquée) : les plus récemment reçues d'abord.
      query = query.order('received_at', { ascending: false });
  }

  const { data, error, count } = await query
    .range(start, start + RECEIVED_INVOICES_PER_PAGE - 1)
    .returns<ReceivedInvoice[]>();

  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

export interface ReceivedInvoiceDetail {
  invoice: ReceivedInvoice;
  events: ReceivedInvoiceEvent[];
  document: ReceivedInvoiceDocument | null;
}

/**
 * Lit la facture, ses événements et son document séparément — même choix que
 * `getInvoiceTransmissionTimeline` (émission) : plus simple à raisonner qu'un
 * embed PostgREST multi-relations, et chaque requête reste indépendante.
 */
export async function getReceivedInvoiceDetail(
  receivedInvoiceId: string,
): Promise<ReceivedInvoiceDetail | null> {
  const invoice = await unwrapMaybe(
    supabase.from('received_invoices').select('*').eq('id', receivedInvoiceId).maybeSingle(),
  );
  if (invoice === null) return null;

  const [events, document] = await Promise.all([
    unwrap(
      supabase
        .from('received_invoice_events')
        .select('*')
        .eq('received_invoice_id', receivedInvoiceId)
        .order('occurred_at', { ascending: false })
        .order('recorded_at', { ascending: false })
        .limit(50),
    ),
    unwrapMaybe(
      supabase
        .from('received_invoice_documents')
        .select('*')
        .eq('received_invoice_id', receivedInvoiceId)
        .maybeSingle(),
    ),
  ]);

  return { invoice, events, document };
}

/** Seul champ modifiable côté client : le triage métier (nouveau/vue/archivée/contestée). */
export async function updateReceivedInvoiceStatus(
  receivedInvoiceId: string,
  internalStatus: ReceivedInvoiceInternalStatus,
): Promise<ReceivedInvoice> {
  return unwrap(
    supabase
      .from('received_invoices')
      .update({ internal_status: internalStatus })
      .eq('id', receivedInvoiceId)
      .select('*')
      .single(),
  );
}

/**
 * URL temporaire vers le document original conservé (UBL/CII/Factur-X).
 * Bucket privé : sans signature, le chemin ne suffit pas. Même patron que
 * `getDocumentDownloadUrl` (`src/features/documents/api/documents.api.ts`).
 */
export async function getReceivedInvoiceDocumentUrl(
  objectPath: string,
  fileName: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('received-invoice-documents')
    .createSignedUrl(objectPath, 3600, { download: fileName });
  if (error) throw error;
  return data.signedUrl;
}

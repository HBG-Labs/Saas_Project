import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';
import {
  normalizeSuperPdpStatus,
  sha256Hex,
  superPdpEventMessage,
  superPdpJson,
  type NormalizedTransmissionStatus,
  type SuperPdpInvoiceEvent,
} from '../../../src/features/einvoicing/provider/superpdp-contract.ts';

/**
 * Réception de factures fournisseurs — miroir de `superpdp-transmission.ts`,
 * sens inverse (`direction=in` au lieu de `direction=out`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AUCUN WEBHOOK N'EXISTE DANS CETTE API (vérifié contre le spec OpenAPI
 * complet, https://api.superpdp.tech/openapi/superpdp.json — 30 endpoints,
 * aucun mécanisme d'abonnement/callback). La réception est donc, comme le
 * suivi des statuts d'émission, entièrement en POLLING : le worker rappelle
 * cette fonction périodiquement.
 *
 * `GET /v1.beta/invoices?direction=in` liste les factures REÇUES, avec la
 * même pagination par curseur que l'émission (`starting_after_id`,
 * `has_after`). Le curseur n'est PAS stocké dans une colonne dédiée : il se
 * déduit de `max(provider_invoice_id)` déjà présent dans `received_invoices`
 * pour cette organisation — la table elle-même EST le curseur, elle ne peut
 * jamais diverger de ce qui a réellement été inséré.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface SuperPdpEnInvoiceParty {
  name: string;
  trading_name?: string | null;
  legal_registration_identifier?: { scheme?: string | null; value?: string | null } | null;
}

export interface SuperPdpEnInvoiceTotals {
  total_without_vat?: number | null;
  total_vat_amount?: number | null;
  total_with_vat?: number | null;
}

export interface SuperPdpEnInvoice {
  number?: string | null;
  issue_date?: string | null;
  payment_due_date?: string | null;
  currency_code?: string | null;
  seller: SuperPdpEnInvoiceParty;
  buyer: SuperPdpEnInvoiceParty;
  totals?: SuperPdpEnInvoiceTotals | null;
}

export interface SuperPdpReceivedInvoice {
  id: number;
  events?: SuperPdpInvoiceEvent[];
}

export interface SuperPdpReceivedInvoiceList {
  data: SuperPdpReceivedInvoice[];
  has_after: boolean;
}

export interface ReceivedInvoiceRow {
  id: string;
  organization_id: string;
  provider_code: string;
  provider_invoice_id: string;
  regulatory_status: NormalizedTransmissionStatus | null;
}

function frenchSirenFromIdentifier(identifier: SuperPdpEnInvoiceParty['legal_registration_identifier']) {
  const digits = identifier?.value?.replace(/\D/g, '') ?? '';
  return digits.length >= 9 ? digits.slice(0, 9) : null;
}

/**
 * Extrait les seuls champs conservés en base à partir de l'enveloppe EN16931
 * (`format=en16931`). Ne jette jamais : un champ absent devient `null`, la
 * facture reste réceptionnée même incomplète — mieux vaut une ligne partielle
 * qu'une réception silencieusement perdue.
 */
export function mapEnInvoiceForStorage(invoice: SuperPdpEnInvoice) {
  return {
    supplier_name: (invoice.seller.trading_name || invoice.seller.name || '').slice(0, 300) || null,
    supplier_siren: frenchSirenFromIdentifier(invoice.seller.legal_registration_identifier),
    supplier_identifier: invoice.seller.legal_registration_identifier?.value ?? null,
    currency_code: invoice.currency_code?.toUpperCase().slice(0, 3) ?? null,
    amount_without_vat: invoice.totals?.total_without_vat ?? null,
    amount_vat: invoice.totals?.total_vat_amount ?? null,
    amount_with_vat: invoice.totals?.total_with_vat ?? null,
    issue_date: invoice.issue_date ?? null,
    payment_due_date: invoice.payment_due_date ?? null,
  };
}

export async function recordReceivedEvent(
  admin: SupabaseClient,
  invoice: ReceivedInvoiceRow,
  event: SuperPdpInvoiceEvent,
) {
  const normalized = normalizeSuperPdpStatus(event.status_code);
  const message = superPdpEventMessage(event);
  const { error } = await admin.from('received_invoice_events').insert({
    received_invoice_id: invoice.id,
    source: event.status_code.startsWith('api:') ? 'provider' : 'administration',
    event_type: 'provider_status',
    normalized_status: normalized,
    provider_status_code: event.status_code,
    provider_event_id: String(event.id),
    message,
    payload_sha256: await sha256Hex(JSON.stringify(event)),
    occurred_at: event.created_at,
  });
  // 23505 : événement déjà connu (reprise) — jamais une erreur.
  if (error && error.code !== '23505') throw error;
  if (!normalized || normalized === invoice.regulatory_status) return invoice;
  const { data: updated, error: updateError } = await admin
    .from('received_invoices')
    .update({ regulatory_status: normalized })
    .eq('id', invoice.id)
    .select('id,organization_id,provider_code,provider_invoice_id,regulatory_status')
    .maybeSingle();
  if (updateError) throw updateError;
  return (updated as ReceivedInvoiceRow | null) ?? invoice;
}

/**
 * Stocke le document ORIGINAL (jamais reconstruit) d'une facture reçue.
 * `upsert: false` : un dépôt concurrent (reprise après échec réseau) ne
 * remplace jamais un fichier déjà conservé — même garantie que
 * `invoice_electronic_documents` côté émission.
 */
async function storeOriginalDocument(
  admin: SupabaseClient,
  organizationId: string,
  receivedInvoiceId: string,
  format: 'ubl' | 'cii' | 'factur_x',
  bytes: Uint8Array,
  contentType: string,
) {
  const objectPath = `${organizationId}/${receivedInvoiceId}/original`;
  const hash = await sha256Hex(bytes);
  const { error: uploadError } = await admin.storage
    .from('received-invoice-documents')
    .upload(objectPath, bytes, { contentType, upsert: false, cacheControl: '0' });
  if (uploadError) {
    const { data: already } = await admin
      .from('received_invoice_documents')
      .select('received_invoice_id')
      .eq('received_invoice_id', receivedInvoiceId)
      .maybeSingle();
    if (already) return; // Déjà conservé par une tentative précédente.
    throw uploadError;
  }
  const { error: insertError } = await admin.from('received_invoice_documents').insert({
    received_invoice_id: receivedInvoiceId,
    organization_id: organizationId,
    original_format: format,
    object_path: objectPath,
    sha256: hash,
    byte_size: bytes.byteLength,
  });
  if (insertError && insertError.code !== '23505') throw insertError;
}

/** `original` peut être XML (UBL/CII) ou un PDF Factur-X — jamais deviné, lu depuis le Content-Type. */
function detectOriginalFormat(contentType: string | null): 'ubl' | 'cii' | 'factur_x' {
  if (contentType?.includes('pdf')) return 'factur_x';
  // UBL et CII sont tous deux du XML ; SUPER PDP ne distingue pas les deux au
  // téléchargement, seulement à la génération. Faute d'un signal fiable, UBL
  // est le repli — c'est le format que REZO360 émet déjà lui-même.
  return 'ubl';
}

/**
 * Synchronise les factures reçues d'UNE organisation : nouvelles factures
 * (paginées depuis le dernier `provider_invoice_id` connu), puis événements
 * des factures déjà connues mais pas encore dans un état terminal.
 */
export async function syncIncomingInvoices(
  admin: SupabaseClient,
  organizationId: string,
  accessToken: string,
  deadline: number,
) {
  const stats = { fetched: 0, created: 0, updated: 0, errors: 0 };

  const { data: cursorRow } = await admin
    .from('received_invoices')
    .select('provider_invoice_id')
    .eq('organization_id', organizationId)
    .eq('provider_code', 'superpdp')
    .order('provider_invoice_id', { ascending: false })
    .limit(1)
    .maybeSingle();
  let cursor = cursorRow ? Number(cursorRow.provider_invoice_id) : 0;
  if (!Number.isFinite(cursor)) cursor = 0;

  while (Date.now() < deadline) {
    const params = new URLSearchParams({
      direction: 'in',
      starting_after_id: String(cursor),
      order: 'asc',
      limit: '100',
    });
    const page = await superPdpJson<SuperPdpReceivedInvoiceList>(
      `/v1.beta/invoices?${params.toString()}`,
      accessToken,
    );
    for (const providerInvoice of page.data) {
      stats.fetched += 1;
      cursor = Math.max(cursor, providerInvoice.id);
      try {
        const outcome = await ingestOneInvoice(admin, organizationId, accessToken, providerInvoice);
        if (outcome.isNew) stats.created += 1;
        else stats.updated += 1;
      } catch (error) {
        stats.errors += 1;
        console.error(
          'superpdp reception: echec ingestion',
          organizationId,
          providerInvoice.id,
          error instanceof Error ? error.message.slice(0, 300) : 'inconnue',
        );
      }
      if (Date.now() >= deadline) break;
    }
    if (!page.has_after || page.data.length === 0) break;
  }

  return stats;
}

async function ingestOneInvoice(
  admin: SupabaseClient,
  organizationId: string,
  accessToken: string,
  providerInvoice: SuperPdpReceivedInvoice,
) {
  const providerInvoiceId = String(providerInvoice.id);

  // Idempotence : la contrainte unique (provider_code, provider_invoice_id)
  // est la garantie de dernier recours, mais on évite déjà l'appel réseau
  // superflu pour une facture connue.
  const { data: existing } = await admin
    .from('received_invoices')
    .select('id,organization_id,provider_code,provider_invoice_id,regulatory_status')
    .eq('provider_code', 'superpdp')
    .eq('provider_invoice_id', providerInvoiceId)
    .maybeSingle();
  if (existing) {
    let current = existing as ReceivedInvoiceRow;
    for (const event of providerInvoice.events ?? [])
      current = await recordReceivedEvent(admin, current, event);
    return { row: current, isNew: false };
  }

  const detail = await superPdpJson<SuperPdpEnInvoice>(
    `/v1.beta/invoices/${providerInvoice.id}?format=en16931`,
    accessToken,
  );
  const fields = mapEnInvoiceForStorage(detail);

  const { data: inserted, error: insertError } = await admin
    .from('received_invoices')
    .insert({
      organization_id: organizationId,
      provider_code: 'superpdp',
      provider_invoice_id: providerInvoiceId,
      ...fields,
    })
    .select('id,organization_id,provider_code,provider_invoice_id,regulatory_status')
    .maybeSingle();
  if (insertError) {
    // 23505 : une exécution concurrente (reprise) a gagné la course — relire,
    // jamais dupliquer.
    if (insertError.code === '23505') {
      const { data: concurrent } = await admin
        .from('received_invoices')
        .select('id,organization_id,provider_code,provider_invoice_id,regulatory_status')
        .eq('provider_code', 'superpdp')
        .eq('provider_invoice_id', providerInvoiceId)
        .maybeSingle();
      return { row: concurrent as ReceivedInvoiceRow | null, isNew: false };
    }
    throw insertError;
  }
  let current = inserted as ReceivedInvoiceRow;

  try {
    const response = await fetch(
      `https://api.superpdp.tech/v1.beta/invoices/${providerInvoice.id}?format=original`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      const format = detectOriginalFormat(response.headers.get('content-type'));
      await storeOriginalDocument(
        admin,
        organizationId,
        current.id,
        format,
        bytes,
        response.headers.get('content-type') ?? 'application/xml',
      );
    }
  } catch (error) {
    // Le document original manquant ne doit jamais faire perdre la ligne
    // structurée déjà enregistrée — best-effort, comme l'envoi de
    // notification côté Phase 10 de Prospect Radar.
    console.error(
      'superpdp reception: document original non conserve',
      providerInvoice.id,
      error instanceof Error ? error.message.slice(0, 200) : 'inconnue',
    );
  }

  for (const event of providerInvoice.events ?? [])
    current = await recordReceivedEvent(admin, current, event);
  return { row: current, isNew: true };
}

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';
import {
  frenchSiren,
  normalizeSuperPdpStatus,
  sha256Hex,
  SUPERPDP_API_URL,
  superPdpEventMessage,
  superPdpJson,
  type NormalizedTransmissionStatus,
  type SuperPdpCompany,
  type SuperPdpInvoiceEvent,
} from '../../../src/features/einvoicing/provider/superpdp-contract.ts';
import { preparerExportUbl } from '../../../src/features/einvoicing/canonical/mapper.ts';
import { serializeUbl } from '../../../src/features/einvoicing/serializers/ubl.ts';
import type { InvoiceWithItems } from '../../../src/types/domain.ts';
import { prochaineTentative } from '../../../src/features/einvoicing/transmission/retry-policy.ts';

/**
 * Cycle de transmission SUPER PDP, sans dependance a HTTP.
 *
 * Extrait de `superpdp-invoice/index.ts` pour que la route utilisateur et
 * l'ordonnanceur partagent une seule implementation. Deux copies du depot, de
 * l'idempotence et de la machine a etats divergeraient : c'est exactement ce
 * qu'on ne peut pas se permettre sur un reseau reglementaire.
 */

export type TransmissionStatus =
  | 'queued'
  | 'submitting'
  | 'submitted'
  | 'delivered'
  | 'accepted'
  | 'rejected'
  | 'failed'
  | 'cancelled';

export interface TransmissionRow {
  id: string;
  invoice_id: string;
  organization_id: string;
  provider_code: string;
  status: TransmissionStatus;
  provider_submission_id: string | null;
  attempt_count: number;
  /** Environnement du depot. `null` sur les lignes anterieures a son suivi. */
  provider_environment: 'sandbox' | 'production' | null;
}

/** Les colonnes qui composent une `TransmissionRow`. Une seule source. */
export const COLONNES_TRANSMISSION =
  'id,invoice_id,organization_id,provider_code,status,provider_submission_id,attempt_count,provider_environment';

export interface SuperPdpInvoice {
  id: number;
  external_id?: string;
  events?: SuperPdpInvoiceEvent[];
}

export interface SuperPdpInvoiceList {
  data: SuperPdpInvoice[];
  has_before: boolean;
  has_after: boolean;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 1000);
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 1000);
  }
  return 'Echec SUPER PDP.';
}

export interface SuperPdpDirectoryEntry {
  identifier: string;
  is_replyto?: boolean;
  status?: 'pending' | 'created' | 'error';
  is_active?: boolean;
}

export async function officialSandboxRouting(accessToken: string) {
  const response = await fetch(
    `${SUPERPDP_API_URL}/v1.beta/invoices/generate_test_invoice?format=ubl`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) return null;
  const xml = await response.text();
  const endpoints = Array.from(
    xml.matchAll(
      /<(?:[A-Za-z_][\w.-]*:)?EndpointID\b([^>]*)>([^<]+)<\/(?:[A-Za-z_][\w.-]*:)?EndpointID>/gi,
    ),
    (match) => ({
      scheme: match[1]?.match(/schemeID=["']([^"']+)["']/i)?.[1] ?? 'absent',
      value: match[2]?.trim() ?? 'absent',
    }),
  );
  return endpoints;
}

export function electronicAddress(identifier: string) {
  const separator = identifier.indexOf(':');
  const scheme = identifier.slice(0, separator);
  const value = identifier.slice(separator + 1);
  if (separator < 1 || scheme !== '0225' || !value)
    throw new Error(`L’adresse électronique ${identifier} n’est pas prise en charge.`);
  return { scheme: '0225' as const, value };
}

export function selectRecipientIdentifier(entries: SuperPdpDirectoryEntry[], siren: string) {
  const active = entries.filter((entry) => entry.is_active && entry.identifier.startsWith('0225:'));
  const root = active.find((entry) => entry.identifier === `0225:${siren}`);
  if (root) return root.identifier;
  if (active.length === 1) return active[0]!.identifier;
  if (active.length === 0)
    throw new Error(
      `Aucune adresse de facturation électronique active n’a été trouvée pour le client ${siren}.`,
    );
  throw new Error(
    `Le client ${siren} possède plusieurs adresses de facturation électronique. Sélectionnez son adresse de routage avant l’envoi.`,
  );
}

export async function resolveElectronicAddresses(
  accessToken: string,
  sellerSiren: string,
  buyerSiren: string,
) {
  const company = await superPdpJson<SuperPdpCompany>('/v1.beta/companies/me', accessToken);
  const connectedSiren = frenchSiren(company.number);
  if (!connectedSiren || connectedSiren !== sellerSiren)
    throw new Error(
      `L’entreprise de la facture (${sellerSiren}) ne correspond pas à l’entreprise connectée sur SUPER PDP (${connectedSiren ?? 'identifiant inconnu'}).`,
    );
  if (company.env === 'sandbox') {
    const endpoints = await officialSandboxRouting(accessToken);
    if (!endpoints || endpoints.length < 2)
      throw new Error('SUPER PDP n’a pas retourné les adresses électroniques de son bac à sable.');
    return {
      environment: company.env,
      seller: electronicAddress(`${endpoints[0]!.scheme}:${endpoints[0]!.value}`),
      buyer: electronicAddress(`${endpoints[1]!.scheme}:${endpoints[1]!.value}`),
    };
  }

  const [sellerDirectory, buyerDirectory] = await Promise.all([
    superPdpJson<{ data: SuperPdpDirectoryEntry[] }>('/v1.beta/directory_entries', accessToken),
    superPdpJson<{ data: SuperPdpDirectoryEntry[] }>(
      `/v1.beta/french_directory/entries?number=${encodeURIComponent(buyerSiren)}`,
      accessToken,
    ),
  ]);
  const sellerIdentifier = sellerDirectory.data.find(
    (entry) =>
      entry.status === 'created' && !entry.is_replyto && entry.identifier.startsWith('0225:'),
  )?.identifier;
  if (!sellerIdentifier)
    throw new Error(
      `Aucune adresse électronique d’émission active n’a été trouvée pour l’entreprise ${sellerSiren}.`,
    );
  return {
    environment: company.env,
    seller: electronicAddress(sellerIdentifier),
    buyer: electronicAddress(selectRecipientIdentifier(buyerDirectory.data, buyerSiren)),
  };
}

export function serverConfig() {
  const clientId = Deno.env.get('SUPERPDP_CLIENT_ID')?.trim() ?? '';
  const clientSecret = Deno.env.get('SUPERPDP_CLIENT_SECRET')?.trim() ?? '';
  const encryptionKey = Deno.env.get('SUPERPDP_TOKEN_ENCRYPTION_KEY') ?? '';
  if (!clientId || !clientSecret || !encryptionKey)
    throw new Error('Le raccordement SUPER PDP attend encore ses identifiants de bac a sable.');
  return { clientId, clientSecret, encryptionKey };
}

export function transitionAllowed(current: TransmissionStatus, next: NormalizedTransmissionStatus) {
  if (current === next) return true;
  if (['accepted', 'rejected', 'cancelled'].includes(current)) return false;
  if (['queued', 'submitting', 'failed'].includes(current)) return true;
  if (current === 'submitted') return ['delivered', 'accepted', 'rejected'].includes(next);
  return current === 'delivered' && ['accepted', 'rejected'].includes(next);
}

export async function recordProviderEvent(
  admin: SupabaseClient,
  transmission: TransmissionRow,
  event: SuperPdpInvoiceEvent,
) {
  const normalized = normalizeSuperPdpStatus(event.status_code);
  const message = superPdpEventMessage(event);
  const { error } = await admin.from('invoice_transmission_events').insert({
    transmission_id: transmission.id,
    invoice_id: transmission.invoice_id,
    organization_id: transmission.organization_id,
    source: event.status_code.startsWith('api:') ? 'provider' : 'administration',
    event_type: 'provider_status',
    normalized_status: normalized,
    provider_status_code: event.status_code,
    provider_event_id: String(event.id),
    message,
    payload_sha256: await sha256Hex(JSON.stringify(event)),
    occurred_at: event.created_at,
  });
  if (error && error.code !== '23505') throw error;
  if (!normalized || !transitionAllowed(transmission.status, normalized)) return transmission;
  const { data: updated, error: updateError } = await admin
    .from('invoice_transmissions')
    .update({
      status: normalized,
      last_error_code: normalized === 'rejected' ? event.status_code : null,
      last_error_message: normalized === 'rejected' ? message : null,
    })
    .eq('id', transmission.id)
    .eq('status', transmission.status)
    .select(COLONNES_TRANSMISSION)
    .maybeSingle();
  if (updateError) throw updateError;
  return (updated as TransmissionRow | null) ?? transmission;
}

export async function syncEvents(
  admin: SupabaseClient,
  transmission: TransmissionRow,
  accessToken: string,
) {
  if (!transmission.provider_submission_id) return transmission;
  const providerInvoice = await superPdpJson<SuperPdpInvoice>(
    `/v1.beta/invoices/${encodeURIComponent(transmission.provider_submission_id)}`,
    accessToken,
  );
  let current = transmission;
  for (const event of providerInvoice.events ?? [])
    current = await recordProviderEvent(admin, current, event);
  const { data: knownEvents, error: knownError } = await admin
    .from('invoice_transmission_events')
    .select('provider_event_id')
    .eq('transmission_id', transmission.id)
    .not('provider_event_id', 'is', null)
    .limit(5000);
  if (knownError) throw knownError;
  const latestKnownEventId = Math.max(
    0,
    ...(knownEvents ?? []).map((event) => Number(event.provider_event_id)).filter(Number.isFinite),
  );
  // Relire le dernier événement permet d'enrichir une raison de rejet dont
  // les détails auraient été complétés après sa première notification.
  let cursor = Math.max(0, latestKnownEventId - 1);
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({
      invoice_id: transmission.provider_submission_id,
      starting_after_id: String(cursor),
      limit: '1000',
    });
    const result = await superPdpJson<{ data: SuperPdpInvoiceEvent[]; has_after: boolean }>(
      `/v1.beta/invoice_events?${params}`,
      accessToken,
    );
    for (const event of result.data) {
      current = await recordProviderEvent(admin, current, event);
      cursor = Math.max(cursor, event.id);
    }
    if (!result.has_after || result.data.length === 0) break;
  }
  return current;
}

export async function recoverSubmission(accessToken: string, externalId: string) {
  let endingBeforeId: number | null = null;
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({ direction: 'out', order: 'desc', limit: '1000' });
    if (endingBeforeId !== null) params.set('ending_before_id', String(endingBeforeId));
    const result = await superPdpJson<SuperPdpInvoiceList>(
      `/v1.beta/invoices?${params.toString()}`,
      accessToken,
    );
    const match = result.data.find((invoice) => invoice.external_id === externalId);
    if (match) return match;
    if (!result.has_before || result.data.length === 0) break;
    endingBeforeId = Math.min(...result.data.map((invoice) => invoice.id));
  }
  return null;
}

export async function prepareUblForTransmission(
  admin: SupabaseClient,
  invoiceId: string,
  accessToken: string,
) {
  const [header, items, totals] = await Promise.all([
    admin.from('invoices').select('*').eq('id', invoiceId).maybeSingle(),
    admin
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('position')
      .order('id')
      .limit(501),
    admin.from('invoice_totals').select('*').eq('invoice_id', invoiceId).maybeSingle(),
  ]);
  if (header.error || items.error || totals.error || !header.data)
    throw new Error('La facture electronique ne peut pas etre preparee.');
  if (!items.data || items.data.length > 500)
    throw new Error('La facture electronique doit comporter au maximum 500 lignes.');
  const preparation = preparerExportUbl({
    ...header.data,
    items: items.data,
    totals: totals.data,
    vatBreakdown: [],
  } as InvoiceWithItems);
  if (!preparation.invoice) throw new Error(preparation.issues.join(' · '));
  const addresses = await resolveElectronicAddresses(
    accessToken,
    preparation.invoice.seller.siren,
    preparation.invoice.buyer.siren,
  );
  const invoiceWithRouting = {
    ...preparation.invoice,
    seller: { ...preparation.invoice.seller, electronicAddress: addresses.seller },
    buyer: { ...preparation.invoice.buyer, electronicAddress: addresses.buyer },
  };
  // La facture UBL de référence générée par SUPER PDP utilise M1 pour le
  // parcours français B2B. Leur plateforme applique ensuite la CIUS adaptée.
  return { ubl: serializeUbl(invoiceWithRouting, { profileId: 'M1' }), addresses };
}


/**
 * Reserve une transmission avant depot.
 *
 * Le verrou est optimiste : la mise a jour n'aboutit que si la ligne est encore
 * `queued` ou `failed`. Deux appels concurrents ne peuvent donc pas deposer la
 * meme facture, et l'appelant qui repart les mains vides doit renoncer.
 */
export async function reserverTransmission(
  admin: SupabaseClient,
  transmission: TransmissionRow,
  maintenant: Date = new Date(),
): Promise<TransmissionRow | null> {
  const { data, error } = await admin
    .from('invoice_transmissions')
    .update({
      status: 'submitting',
      attempt_count: transmission.attempt_count + 1,
      last_attempt_at: maintenant.toISOString(),
      next_attempt_at: null,
      last_error_code: null,
      last_error_message: null,
    })
    .eq('id', transmission.id)
    .in('status', ['queued', 'failed'])
    .select(COLONNES_TRANSMISSION)
    .maybeSingle();
  if (error) throw error;
  return (data as TransmissionRow | null) ?? null;
}

/**
 * Depose une transmission deja reservee, puis synchronise son etat.
 *
 * La recherche prealable par identifiant externe est ce qui rend la reprise
 * sure : si une tentative precedente a bien depose le document mais que sa
 * reponse s'est perdue, on retrouve le depot au lieu d'en creer un second.
 */
export async function deposerTransmission(
  admin: SupabaseClient,
  transmission: TransmissionRow,
  invoiceId: string,
  accessToken: string,
  environnement: 'sandbox' | 'production' | null,
): Promise<TransmissionRow> {
  let providerInvoice = await recoverSubmission(accessToken, invoiceId);
  if (!providerInvoice) {
    // Le bac a sable SUPER PDP route Burger Queen vers Tricatel sur le
    // document Peppol UBL. Le CII reste disponible au telechargement, mais
    // certains destinataires n'annoncent pas ce type de document dans leur
    // profil de reception.
    const { ubl } = await prepareUblForTransmission(admin, invoiceId, accessToken);
    const params = new URLSearchParams({ external_id: invoiceId, processing_rule: 'B2B' });
    providerInvoice = await superPdpJson<SuperPdpInvoice>(
      `/v1.beta/invoices?${params.toString()}`,
      accessToken,
      { method: 'POST', headers: { 'Content-Type': 'application/xml' }, body: ubl },
    );
  }
  if (!Number.isSafeInteger(providerInvoice.id))
    throw new Error('SUPER PDP n’a pas retourne d’identifiant de depot.');
  const { data: submitted, error } = await admin
    .from('invoice_transmissions')
    .update({
      status: 'submitted',
      provider_submission_id: String(providerInvoice.id),
      // L'identifiant de depot n'a de sens que dans l'environnement qui l'a
      // attribue : les deux sont poses ensemble, et le trigger les gele.
      provider_environment: environnement,
      last_error_code: null,
      last_error_message: null,
    })
    .eq('id', transmission.id)
    .eq('status', 'submitting')
    .select(COLONNES_TRANSMISSION)
    .single();
  if (error) throw error;
  let courante = submitted as TransmissionRow;
  for (const event of providerInvoice.events ?? [])
    courante = await recordProviderEvent(admin, courante, event);
  return await syncEvents(admin, courante, accessToken);
}

/**
 * Consigne un echec technique et programme, s'il y a lieu, la reprise.
 *
 * La mise a jour reste conditionnee a l'etat `submitting` : si une autre
 * requete a fait avancer la transmission entre-temps, on ne la ramene pas en
 * arriere. L'evenement, lui, est toujours journalise.
 */
export async function marquerEchec(
  admin: SupabaseClient,
  transmission: TransmissionRow,
  message: string,
  maintenant: Date = new Date(),
): Promise<void> {
  await admin
    .from('invoice_transmissions')
    .update({
      status: 'failed',
      last_error_code: 'submission_failed',
      last_error_message: message,
      // `attempt_count` a deja ete incremente lors de la reservation : il
      // compte les tentatives consommees. `null` signifie plafond atteint, donc
      // plus aucune reprise automatique.
      next_attempt_at: prochaineTentative(transmission.attempt_count, maintenant),
    })
    .eq('id', transmission.id)
    .eq('status', 'submitting');
  await admin.from('invoice_transmission_events').insert({
    transmission_id: transmission.id,
    invoice_id: transmission.invoice_id,
    organization_id: transmission.organization_id,
    source: 'application',
    event_type: 'technical_failure',
    normalized_status: 'failed',
    message,
    occurred_at: maintenant.toISOString(),
  });
}

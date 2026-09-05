import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';
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
import {
  usableSuperPdpAccessToken,
  type SuperPdpConnectionRow,
} from '../_shared/superpdp-connection.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

type TransmissionStatus =
  | 'queued'
  | 'submitting'
  | 'submitted'
  | 'delivered'
  | 'accepted'
  | 'rejected'
  | 'failed'
  | 'cancelled';

interface TransmissionRow {
  id: string;
  invoice_id: string;
  organization_id: string;
  provider_code: string;
  status: TransmissionStatus;
  provider_submission_id: string | null;
  attempt_count: number;
}

interface SuperPdpInvoice {
  id: number;
  external_id?: string;
  events?: SuperPdpInvoiceEvent[];
}

interface SuperPdpInvoiceList {
  data: SuperPdpInvoice[];
  has_before: boolean;
  has_after: boolean;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 1000);
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 1000);
  }
  return 'Echec SUPER PDP.';
}

interface SuperPdpDirectoryEntry {
  identifier: string;
  is_replyto?: boolean;
  status?: 'pending' | 'created' | 'error';
  is_active?: boolean;
}

async function officialSandboxRouting(accessToken: string) {
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

function electronicAddress(identifier: string) {
  const separator = identifier.indexOf(':');
  const scheme = identifier.slice(0, separator);
  const value = identifier.slice(separator + 1);
  if (separator < 1 || scheme !== '0225' || !value)
    throw new Error(`L’adresse électronique ${identifier} n’est pas prise en charge.`);
  return { scheme: '0225' as const, value };
}

function selectRecipientIdentifier(entries: SuperPdpDirectoryEntry[], siren: string) {
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

async function resolveElectronicAddresses(
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
    seller: electronicAddress(sellerIdentifier),
    buyer: electronicAddress(selectRecipientIdentifier(buyerDirectory.data, buyerSiren)),
  };
}

function serverConfig() {
  const clientId = Deno.env.get('SUPERPDP_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('SUPERPDP_CLIENT_SECRET') ?? '';
  const encryptionKey = Deno.env.get('SUPERPDP_TOKEN_ENCRYPTION_KEY') ?? '';
  if (!clientId || !clientSecret || !encryptionKey)
    throw new Error('Le raccordement SUPER PDP attend encore ses identifiants de bac a sable.');
  return { clientId, clientSecret, encryptionKey };
}

function transitionAllowed(current: TransmissionStatus, next: NormalizedTransmissionStatus) {
  if (current === next) return true;
  if (['accepted', 'rejected', 'cancelled'].includes(current)) return false;
  if (['queued', 'submitting', 'failed'].includes(current)) return true;
  if (current === 'submitted') return ['delivered', 'accepted', 'rejected'].includes(next);
  return current === 'delivered' && ['accepted', 'rejected'].includes(next);
}

async function recordProviderEvent(
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
    .select(
      'id,invoice_id,organization_id,provider_code,status,provider_submission_id,attempt_count',
    )
    .maybeSingle();
  if (updateError) throw updateError;
  return (updated as TransmissionRow | null) ?? transmission;
}

async function syncEvents(
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

async function recoverSubmission(accessToken: string, externalId: string) {
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

async function prepareUblForTransmission(
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
  return serializeUbl(invoiceWithRouting, { profileId: 'M1' });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Methode non autorisee.' }, 405);
  const authorization = request.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+$/i.test(authorization))
    return json({ error: 'Authentification requise.' }, 401);
  let body: { invoiceId?: unknown; action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Requete illisible.' }, 400);
  }
  if (
    typeof body.invoiceId !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(body.invoiceId) ||
    !['submit', 'sync'].includes(String(body.action))
  )
    return json({ error: 'Facture ou action invalide.' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await caller.auth.getUser(
    authorization.replace(/^Bearer\s+/i, ''),
  );
  if (authError || !auth.user)
    return json({ error: 'Votre session a expire. Reconnectez-vous.' }, 401);
  const { data: canTransmit, error: permissionError } = await caller.rpc('can_transmit_invoice', {
    p_invoice_id: body.invoiceId,
  });
  if (permissionError) return json({ error: 'Les droits ne peuvent pas etre verifies.' }, 503);
  if (!canTransmit)
    return json(
      { error: 'Cette facture ne peut pas etre transmise par ce compte ou ce parcours.' },
      403,
    );
  const { data: invoice } = await caller
    .from('invoices')
    .select('id,organization_id,status,customer_type')
    .eq('id', body.invoiceId)
    .maybeSingle();
  if (!invoice) return json({ error: 'Facture introuvable.' }, 404);

  let transmission: TransmissionRow | null = null;
  try {
    const config = serverConfig();
    const { data: connection } = await admin
      .from('einvoicing_provider_connections')
      .select(
        'organization_id,provider_code,status,access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at,token_type',
      )
      .eq('organization_id', invoice.organization_id)
      .maybeSingle();
    if (!connection || connection.status !== 'connected')
      return json({ error: 'Connectez et faites verifier SUPER PDP avant tout envoi.' }, 409);
    const accessToken = await usableSuperPdpAccessToken(
      admin,
      connection as SuperPdpConnectionRow,
      config,
    );
    const { data: existing, error: readError } = await admin
      .from('invoice_transmissions')
      .select(
        'id,invoice_id,organization_id,provider_code,status,provider_submission_id,attempt_count',
      )
      .eq('invoice_id', body.invoiceId)
      .maybeSingle();
    if (readError) throw readError;
    transmission = existing as TransmissionRow | null;

    if (body.action === 'sync') {
      if (!transmission) return json({ error: 'Cette facture n’a pas encore ete transmise.' }, 404);
      const synced = await syncEvents(admin, transmission, accessToken);
      return json({ status: synced.status, providerSubmissionId: synced.provider_submission_id });
    }

    if (!transmission) {
      const { data: created, error } = await admin
        .from('invoice_transmissions')
        .insert({
          invoice_id: body.invoiceId,
          organization_id: invoice.organization_id,
          provider_code: 'superpdp',
          status: 'queued',
        })
        .select(
          'id,invoice_id,organization_id,provider_code,status,provider_submission_id,attempt_count',
        )
        .single();
      if (error) {
        const { data: concurrent } = await admin
          .from('invoice_transmissions')
          .select(
            'id,invoice_id,organization_id,provider_code,status,provider_submission_id,attempt_count',
          )
          .eq('invoice_id', body.invoiceId)
          .maybeSingle();
        transmission = concurrent as TransmissionRow | null;
      } else transmission = created as TransmissionRow;
    }
    if (!transmission) throw new Error('La transmission ne peut pas etre creee.');
    if (transmission.provider_submission_id) {
      const synced = await syncEvents(admin, transmission, accessToken);
      return json({ status: synced.status, providerSubmissionId: synced.provider_submission_id });
    }
    if (['accepted', 'rejected', 'cancelled'].includes(transmission.status))
      return json({ status: transmission.status, providerSubmissionId: null });
    if (transmission.status === 'submitting')
      return json({ error: 'Une transmission est deja en cours.' }, 409);

    const { data: claimed, error: claimError } = await admin
      .from('invoice_transmissions')
      .update({
        status: 'submitting',
        attempt_count: transmission.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
        next_attempt_at: null,
        last_error_code: null,
        last_error_message: null,
      })
      .eq('id', transmission.id)
      .in('status', ['queued', 'failed'])
      .select(
        'id,invoice_id,organization_id,provider_code,status,provider_submission_id,attempt_count',
      )
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return json({ error: 'Une transmission est deja en cours.' }, 409);
    transmission = claimed as TransmissionRow;

    let providerInvoice = await recoverSubmission(accessToken, body.invoiceId);
    if (!providerInvoice) {
      // Le bac a sable SUPER PDP route Burger Queen vers Tricatel sur le
      // document Peppol UBL. Le CII reste disponible au telechargement, mais
      // certains destinataires n'annoncent pas ce type de document dans leur
      // profil de reception.
      const ubl = await prepareUblForTransmission(admin, body.invoiceId, accessToken);
      const params = new URLSearchParams({ external_id: body.invoiceId, processing_rule: 'B2B' });
      providerInvoice = await superPdpJson<SuperPdpInvoice>(
        `/v1.beta/invoices?${params.toString()}`,
        accessToken,
        { method: 'POST', headers: { 'Content-Type': 'application/xml' }, body: ubl },
      );
    }
    if (!Number.isSafeInteger(providerInvoice.id))
      throw new Error('SUPER PDP n’a pas retourne d’identifiant de depot.');
    const { data: submitted, error: submittedError } = await admin
      .from('invoice_transmissions')
      .update({
        status: 'submitted',
        provider_submission_id: String(providerInvoice.id),
        last_error_code: null,
        last_error_message: null,
      })
      .eq('id', transmission.id)
      .eq('status', 'submitting')
      .select(
        'id,invoice_id,organization_id,provider_code,status,provider_submission_id,attempt_count',
      )
      .single();
    if (submittedError) throw submittedError;
    transmission = submitted as TransmissionRow;
    for (const event of providerInvoice.events ?? [])
      transmission = await recordProviderEvent(admin, transmission, event);
    transmission = await syncEvents(admin, transmission, accessToken);
    return json({
      status: transmission.status,
      providerSubmissionId: transmission.provider_submission_id,
    });
  } catch (error) {
    const message = errorMessage(error);
    console.error('superpdp invoice failed', error instanceof Error ? error.name : 'unknown');
    if (transmission?.status === 'submitting') {
      await admin
        .from('invoice_transmissions')
        .update({
          status: 'failed',
          last_error_code: 'submission_failed',
          last_error_message: message,
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
        occurred_at: new Date().toISOString(),
      });
    }
    return json({ error: message }, 502);
  }
});

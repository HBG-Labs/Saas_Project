import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import {
  usableSuperPdpAccessToken,
  type SuperPdpConnectionRow,
} from '../_shared/superpdp-connection.ts';
import {
  COLONNES_TRANSMISSION,
  deposerTransmission,
  errorMessage,
  marquerEchec,
  prepareUblForTransmission,
  reserverTransmission,
  serverConfig,
  syncEvents,
  type TransmissionRow,
} from '../_shared/superpdp-transmission.ts';

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
    !['submit', 'sync', 'routing_check'].includes(String(body.action))
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
        'organization_id,provider_code,status,provider_environment,access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at,token_type',
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
    // Controle de routage, en lecture seule. Il ne fait que des GET vers
    // l'annuaire du partenaire et rend la main AVANT toute lecture ou ecriture
    // de `invoice_transmissions` : il ne peut donc ni creer une transmission,
    // ni la faire avancer, ni consommer son verrou. Il existe pour prouver la
    // branche production de `resolveElectronicAddresses`, qui n'a jamais ete
    // executee : les depots connus ont tous eu lieu en bac a sable.
    if (body.action === 'routing_check') {
      const { ubl, addresses } = await prepareUblForTransmission(
        admin,
        body.invoiceId,
        accessToken,
      );
      return json({
        environment: addresses.environment,
        seller: addresses.seller,
        buyer: addresses.buyer,
        ublBytes: ubl.length,
        submitted: false,
      });
    }

    const { data: existing, error: readError } = await admin
      .from('invoice_transmissions')
      .select(COLONNES_TRANSMISSION)
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
        .select(COLONNES_TRANSMISSION)
        .single();
      if (error) {
        const { data: concurrent } = await admin
          .from('invoice_transmissions')
          .select(COLONNES_TRANSMISSION)
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

    const claimed = await reserverTransmission(admin, transmission);
    if (!claimed) return json({ error: 'Une transmission est deja en cours.' }, 409);
    transmission = claimed;

    transmission = await deposerTransmission(
      admin,
      transmission,
      body.invoiceId,
      accessToken,
      (connection as SuperPdpConnectionRow).provider_environment,
    );
    return json({
      status: transmission.status,
      providerSubmissionId: transmission.provider_submission_id,
    });
  } catch (error) {
    const message = errorMessage(error);
    console.error('superpdp invoice failed', error instanceof Error ? error.name : 'unknown');
    if (transmission?.status === 'submitting') await marquerEchec(admin, transmission, message);
    return json({ error: message }, 502);
  }
});

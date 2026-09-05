import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import {
  buildSuperPdpAuthorizationUrl,
  connectionStatus,
  decryptSecret,
  frenchSiren,
  randomOAuthState,
  revokeSuperPdpToken,
  sha256Hex,
  superPdpJson,
  type SuperPdpCompany,
  type SuperPdpSession,
} from '../../../src/features/einvoicing/provider/superpdp-contract.ts';
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

function serverConfig() {
  const clientId = Deno.env.get('SUPERPDP_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('SUPERPDP_CLIENT_SECRET') ?? '';
  const encryptionKey = Deno.env.get('SUPERPDP_TOKEN_ENCRYPTION_KEY') ?? '';
  if (!clientId || !clientSecret || !encryptionKey)
    throw new Error('Le raccordement SUPER PDP attend encore ses identifiants de bac a sable.');
  return { clientId, clientSecret, encryptionKey };
}

function safeReturnUrl(raw: unknown, origin: string | null): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    const appUrl = Deno.env.get('APP_URL');
    const allowedOrigins = new Set<string>();
    if (origin) allowedOrigins.add(new URL(origin).origin);
    if (appUrl) allowedOrigins.add(new URL(appUrl).origin);
    if (!allowedOrigins.has(url.origin)) return null;
    if (url.pathname !== '/organisation/facturation-electronique') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function fullConnectionSelect() {
  return 'organization_id,provider_code,status,access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at,token_type';
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Methode non autorisee.' }, 405);

  const authorization = request.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+$/i.test(authorization))
    return json({ error: 'Authentification requise.' }, 401);

  let body: { action?: unknown; organizationId?: unknown; returnUrl?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Requete illisible.' }, 400);
  }
  if (
    !['readiness', 'start', 'verify', 'disconnect'].includes(String(body.action)) ||
    typeof body.organizationId !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(body.organizationId)
  )
    return json({ error: 'Action ou organisation invalide.' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await caller.auth.getUser(
    authorization.replace(/^Bearer\s+/i, ''),
  );
  if (authError || !auth.user)
    return json({ error: 'Votre session a expire. Reconnectez-vous.' }, 401);
  const { data: canManage, error: permissionError } = await caller.rpc(
    'can_manage_einvoicing_connection',
    { p_organization_id: body.organizationId },
  );
  if (permissionError) return json({ error: 'Les droits ne peuvent pas etre verifies.' }, 503);
  if (!canManage)
    return json(
      {
        error:
          'Seul un proprietaire ou administrateur avec le module Facturation peut gerer cette connexion.',
      },
      403,
    );

  try {
    if (body.action === 'readiness') {
      return json({
        configured: Boolean(
          Deno.env.get('SUPERPDP_CLIENT_ID') &&
          Deno.env.get('SUPERPDP_CLIENT_SECRET') &&
          Deno.env.get('SUPERPDP_TOKEN_ENCRYPTION_KEY'),
        ),
        environment: Deno.env.get('SUPERPDP_MODE') ?? 'sandbox',
      });
    }
    const config = serverConfig();
    if (body.action === 'start') {
      const returnUrl = safeReturnUrl(body.returnUrl, request.headers.get('origin'));
      if (!returnUrl) return json({ error: 'Adresse de retour invalide.' }, 400);
      const state = randomOAuthState();
      const stateHash = await sha256Hex(state);
      await admin
        .from('einvoicing_oauth_states')
        .delete()
        .lt('expires_at', new Date().toISOString());
      const { error: insertError } = await admin.from('einvoicing_oauth_states').insert({
        state_sha256: stateHash,
        organization_id: body.organizationId,
        user_id: auth.user.id,
        return_url: returnUrl,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (insertError) throw insertError;

      let siren: string | undefined;
      if ((Deno.env.get('SUPERPDP_MODE') ?? 'sandbox') === 'production') {
        const { data: organization } = await caller
          .from('organizations')
          .select('registration_number')
          .eq('id', body.organizationId)
          .maybeSingle();
        const digits = organization?.registration_number?.replace(/\D/g, '') ?? '';
        if (digits.length >= 9) siren = digits.slice(0, 9);
      }
      const redirectUri = `${url}/functions/v1/superpdp-oauth-callback`;
      return json({
        url: buildSuperPdpAuthorizationUrl({
          clientId: config.clientId,
          redirectUri,
          state,
          siren,
        }),
      });
    }

    const { data: connection } = await admin
      .from('einvoicing_provider_connections')
      .select(fullConnectionSelect())
      .eq('organization_id', body.organizationId)
      .maybeSingle();
    if (!connection) return json({ error: 'Aucune connexion SUPER PDP a gerer.' }, 404);

    if (body.action === 'disconnect') {
      if (connection.access_token_ciphertext && connection.refresh_token_ciphertext) {
        const associatedData = `${body.organizationId}:superpdp`;
        const tokens = await Promise.all([
          decryptSecret(connection.access_token_ciphertext, config.encryptionKey, associatedData),
          decryptSecret(connection.refresh_token_ciphertext, config.encryptionKey, associatedData),
        ]);
        await Promise.allSettled(tokens.map((token) => revokeSuperPdpToken(token)));
      }
      const { error } = await admin
        .from('einvoicing_provider_connections')
        .update({
          status: 'disconnected',
          provider_company_id: null,
          provider_environment: null,
          company_verification_status: null,
          user_identity_verification_status: null,
          access_token_ciphertext: null,
          refresh_token_ciphertext: null,
          access_token_expires_at: null,
          token_type: null,
          connected_at: null,
          last_verified_at: new Date().toISOString(),
          last_error_code: null,
          last_error_message: null,
        })
        .eq('organization_id', body.organizationId);
      if (error) throw error;
      return json({ status: 'disconnected' });
    }

    const accessToken = await usableSuperPdpAccessToken(
      admin,
      connection as SuperPdpConnectionRow,
      config,
    );
    const session = await superPdpJson<SuperPdpSession>('/v1.beta/oauth2_sessions/me', accessToken);
    const status = connectionStatus(session);
    let company: SuperPdpCompany | null = null;
    if (status === 'connected')
      company = await superPdpJson<SuperPdpCompany>('/v1.beta/companies/me', accessToken);
    const { data: organization, error: organizationError } = await caller
      .from('organizations')
      .select('registration_number')
      .eq('id', body.organizationId)
      .maybeSingle();
    if (organizationError) throw organizationError;
    const expectedMode = Deno.env.get('SUPERPDP_MODE') ?? 'sandbox';
    const modeMismatch = company !== null && company.env !== expectedMode;
    const expectedSiren = frenchSiren(organization?.registration_number);
    const connectedSiren = frenchSiren(company?.number);
    const companyMismatch =
      company !== null && expectedSiren !== null && connectedSiren !== expectedSiren;
    const finalStatus = modeMismatch || companyMismatch ? 'action_required' : status;
    const errorCode = modeMismatch
      ? 'environment_mismatch'
      : companyMismatch
        ? 'company_mismatch'
        : null;
    const errorMessage = modeMismatch
      ? `Le compte SUPER PDP est en ${company?.env}; REZO360 attend ${expectedMode}.`
      : companyMismatch
        ? `L’entreprise connectée sur SUPER PDP (${connectedSiren ?? 'identifiant inconnu'}) ne correspond pas à l’organisation REZO360 (${expectedSiren}).`
        : null;
    const { error } = await admin
      .from('einvoicing_provider_connections')
      .update({
        status: finalStatus,
        provider_company_id: company ? String(company.id) : null,
        provider_environment: company?.env ?? null,
        company_verification_status: session.company_verification_status,
        user_identity_verification_status: session.user_identity_verification_status ?? null,
        connected_at: finalStatus === 'connected' ? new Date().toISOString() : null,
        last_verified_at: new Date().toISOString(),
        last_error_code: errorCode,
        last_error_message: errorMessage,
      })
      .eq('organization_id', body.organizationId);
    if (error) throw error;
    return json({ status: finalStatus, environment: company?.env ?? null });
  } catch (error) {
    console.error('superpdp connection failed', error instanceof Error ? error.name : 'unknown');
    return json(
      { error: error instanceof Error ? error.message : 'La connexion SUPER PDP a echoue.' },
      502,
    );
  }
});

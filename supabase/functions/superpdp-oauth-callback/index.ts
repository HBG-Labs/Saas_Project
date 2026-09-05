import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import {
  connectionStatus,
  exchangeSuperPdpCode,
  sha256Hex,
  superPdpJson,
  type SuperPdpCompany,
  type SuperPdpSession,
} from '../../../src/features/einvoicing/provider/superpdp-contract.ts';
import { encryptSuperPdpTokens } from '../_shared/superpdp-connection.ts';

function htmlError(message: string, status = 400) {
  return new Response(
    `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Connexion impossible</title><body><h1>Connexion impossible</h1><p>${message}</p><p>Vous pouvez fermer cette page et revenir dans REZO360.</p></body></html>`,
    {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    },
  );
}

function redirect(returnUrl: string, result: string) {
  const url = new URL(returnUrl);
  url.searchParams.set('connexion', result);
  return Response.redirect(url, 303);
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'GET') return htmlError('Methode non autorisee.', 405);
  const requestUrl = new URL(request.url);
  const rawState = requestUrl.searchParams.get('state') ?? '';
  if (!rawState) return htmlError('Le jeton de retour est absent.');

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stateHash = await sha256Hex(rawState);
  const consumedAt = new Date().toISOString();
  const { data: state, error: stateError } = await admin
    .from('einvoicing_oauth_states')
    .update({ consumed_at: consumedAt })
    .eq('state_sha256', stateHash)
    .is('consumed_at', null)
    .gt('expires_at', consumedAt)
    .select('organization_id,user_id,return_url')
    .maybeSingle();
  if (stateError || !state) return htmlError('Ce retour a expire ou a deja ete utilise.');
  if (requestUrl.searchParams.has('error')) return redirect(state.return_url, 'annulee');

  const code = requestUrl.searchParams.get('code') ?? '';
  const clientId = Deno.env.get('SUPERPDP_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('SUPERPDP_CLIENT_SECRET') ?? '';
  const encryptionKey = Deno.env.get('SUPERPDP_TOKEN_ENCRYPTION_KEY') ?? '';
  if (!code || !clientId || !clientSecret || !encryptionKey)
    return redirect(state.return_url, 'erreur');

  try {
    const redirectUri = `${url}/functions/v1/superpdp-oauth-callback`;
    const tokens = await exchangeSuperPdpCode({ clientId, clientSecret, redirectUri, code });
    const encrypted = await encryptSuperPdpTokens(state.organization_id, tokens, encryptionKey);
    const accessTokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();
    let session: SuperPdpSession;
    let company: SuperPdpCompany | null = null;
    let lastErrorCode: string | null = null;
    let lastErrorMessage: string | null = null;
    try {
      session = await superPdpJson<SuperPdpSession>(
        '/v1.beta/oauth2_sessions/me',
        tokens.accessToken,
      );
      if (session.company_verification_status === 'verified')
        company = await superPdpJson<SuperPdpCompany>('/v1.beta/companies/me', tokens.accessToken);
    } catch {
      session = {
        client_id: clientId,
        created_at: new Date().toISOString(),
        company_verification_status: 'needs_review',
      };
      lastErrorCode = 'verification_pending';
      lastErrorMessage = 'SUPER PDP verifie encore le rattachement de l’entreprise.';
    }
    let status = connectionStatus(session);
    const expectedMode = Deno.env.get('SUPERPDP_MODE') ?? 'sandbox';
    if (company && company.env !== expectedMode) {
      status = 'action_required';
      lastErrorCode = 'environment_mismatch';
      lastErrorMessage = `Le compte SUPER PDP est en ${company.env}; REZO360 attend ${expectedMode}.`;
    }
    const { error } = await admin.from('einvoicing_provider_connections').upsert({
      organization_id: state.organization_id,
      provider_code: 'superpdp',
      status,
      provider_company_id: company ? String(company.id) : null,
      provider_environment: company?.env ?? null,
      company_verification_status: session.company_verification_status,
      user_identity_verification_status: session.user_identity_verification_status ?? null,
      access_token_ciphertext: encrypted.accessTokenCiphertext,
      refresh_token_ciphertext: encrypted.refreshTokenCiphertext,
      access_token_expires_at: accessTokenExpiresAt,
      token_type: tokens.tokenType,
      connected_by: state.user_id,
      connected_at: status === 'connected' ? new Date().toISOString() : null,
      last_verified_at: new Date().toISOString(),
      last_error_code: lastErrorCode,
      last_error_message: lastErrorMessage,
    });
    if (error) throw error;
    return redirect(state.return_url, status === 'connected' ? 'ok' : 'en_attente');
  } catch (error) {
    console.error(
      'superpdp oauth callback failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return redirect(state.return_url, 'erreur');
  }
});

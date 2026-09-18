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
  type SuperPdpAuthorizationScope,
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
  const clientId = Deno.env.get('SUPERPDP_CLIENT_ID')?.trim() ?? '';
  const clientSecret = Deno.env.get('SUPERPDP_CLIENT_SECRET')?.trim() ?? '';
  const encryptionKey = Deno.env.get('SUPERPDP_TOKEN_ENCRYPTION_KEY') ?? '';
  if (!clientId || !clientSecret || !encryptionKey)
    throw new Error('Le raccordement SUPER PDP attend encore ses identifiants de bac a sable.');
  return { clientId, clientSecret, encryptionKey };
}

/**
 * Adresse de retour autorisee apres le detour par SUPER PDP.
 *
 * L'en-tete `Origin` figurait auparavant parmi les origines acceptees. Or il
 * est fourni par l'appelant : un membre authentifie pouvait donc faire
 * enregistrer l'adresse de son choix, que le retour OAuth suivait ensuite en
 * 303. La portee restait faible — sa propre session, un chemin impose, aucun
 * jeton transporte — mais c'etait une redirection ouverte, et rien ne
 * l'imposait : `APP_URL` suffit et n'est pas manipulable.
 *
 * Sans `APP_URL`, la fonction refuse plutot que de se rabattre sur autre chose.
 */
function safeReturnUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const appUrl = Deno.env.get('APP_URL');
  if (!appUrl) return null;
  try {
    const url = new URL(raw);
    if (url.origin !== new URL(appUrl).origin) return null;
    if (url.pathname !== '/organisation/facturation-electronique') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
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
    !['readiness', 'start', 'activate_reception', 'verify', 'disconnect'].includes(
      String(body.action),
    ) ||
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
          Deno.env.get('SUPERPDP_CLIENT_ID')?.trim() &&
          Deno.env.get('SUPERPDP_CLIENT_SECRET')?.trim() &&
          Deno.env.get('SUPERPDP_TOKEN_ENCRYPTION_KEY'),
        ),
        environment: Deno.env.get('SUPERPDP_MODE')?.trim() || 'sandbox',
      });
    }
    const config = serverConfig();
    if (body.action === 'start' || body.action === 'activate_reception') {
      const returnUrl = safeReturnUrl(body.returnUrl);
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
      if ((Deno.env.get('SUPERPDP_MODE')?.trim() || 'sandbox') === 'production') {
        const { data: organization } = await caller
          .from('organizations')
          .select('registration_number')
          .eq('id', body.organizationId)
          .maybeSingle();
        const digits = organization?.registration_number?.replace(/\D/g, '') ?? '';
        if (digits.length >= 9) siren = digits.slice(0, 9);
      }
      const scope: SuperPdpAuthorizationScope =
        body.action === 'activate_reception' ? 'send_and_receive' : 'send';
      if (body.action === 'activate_reception') {
        // Posé AVANT la redirection : `verify` (au retour) ne sonde
        // `direction=in` que pour une organisation qui vient de le demander
        // explicitement — jamais en arrière-plan pour une connexion `send` seule.
        // Une UPDATE sans ligne correspondante n'affecte rien SANS lever
        // d'erreur (comportement normal de Postgres) : le nombre de lignes
        // modifiées est donc vérifié explicitement, pas supposé.
        const { data: pending, error: pendingError } = await admin
          .from('einvoicing_provider_connections')
          .update({ reception_status: 'pending_verification' })
          .eq('organization_id', body.organizationId)
          .select('organization_id');
        if (pendingError) throw pendingError;
        if (!pending?.length)
          return json(
            { error: 'Connectez d’abord SUPER PDP pour l’émission avant d’activer la réception.' },
            409,
          );
      }
      const redirectUri = `${url}/functions/v1/superpdp-oauth-callback`;
      return json({
        url: buildSuperPdpAuthorizationUrl({
          clientId: config.clientId,
          redirectUri,
          state,
          siren,
          scope,
        }),
      });
    }

    const { data: connection } = await admin
      .from('einvoicing_provider_connections')
      // Chaîne littérale, et non le retour d'une fonction : supabase-js déduit
      // le type des colonnes du littéral. Derrière un helper, il retombe sur
      // `GenericStringError` et le typage de la connexion est perdu.
      .select(
        'organization_id,provider_code,status,reception_status,provider_environment,access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at,token_type',
      )
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
      // Deconnecter revoque les jetons et coupe la capacite a transmettre.
      // Une action de cette portee ne doit pas etre invisible. L'echec de la
      // trace ne doit pas pour autant annuler une deconnexion deja faite.
      try {
        const { error: erreurAudit } = await admin.from('audit_logs').insert({
          organization_id: body.organizationId,
          user_id: auth.user.id,
          action: 'einvoicing.disconnected',
          entity_type: 'einvoicing_provider_connection',
          metadata: { provider: 'superpdp' },
        });
        if (erreurAudit) throw erreurAudit;
      } catch (erreurAudit) {
        console.error(
          'superpdp connection: trace de deconnexion non ecrite',
          erreurAudit instanceof Error ? erreurAudit.message.slice(0, 200) : 'inconnue',
        );
      }
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
    const expectedMode = Deno.env.get('SUPERPDP_MODE')?.trim() || 'sandbox';
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
    // Sondage de la réception : SUPER PDP n'expose nulle part le scope
    // accordé (`GET /v1.beta/oauth2_sessions/me` n'a pas ce champ, vérifié
    // contre le spec OpenAPI) — la seule façon de savoir si `send_and_receive`
    // a bien été accordé est d'essayer l'appel réel. Seulement quand
    // `reception_status` vaut `pending_verification` : pas de sondage
    // silencieux sur chaque `verify` d'une connexion qui n'a jamais demandé
    // la réception.
    let receptionStatus = connection.reception_status as
      | 'not_requested'
      | 'pending_verification'
      | 'active'
      | 'failed';
    let receptionErrorCode: string | null = null;
    let receptionErrorMessage: string | null = null;
    let receptionActivatedAt: string | null = null;
    if (finalStatus === 'connected' && receptionStatus === 'pending_verification') {
      try {
        await superPdpJson('/v1.beta/invoices?direction=in&limit=1', accessToken);
        receptionStatus = 'active';
        receptionActivatedAt = new Date().toISOString();
      } catch (receptionError) {
        receptionStatus = 'failed';
        receptionErrorCode = 'reception_scope_refused';
        receptionErrorMessage =
          receptionError instanceof Error
            ? receptionError.message
            : 'SUPER PDP a refusé l’accès à la réception.';
      }
    }

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
        reception_status: receptionStatus,
        ...(receptionActivatedAt ? { reception_activated_at: receptionActivatedAt } : {}),
        reception_last_checked_at:
          receptionStatus === 'pending_verification' ? null : new Date().toISOString(),
        reception_last_error_code: receptionErrorCode,
        reception_last_error_message: receptionErrorMessage,
      })
      .eq('organization_id', body.organizationId);
    if (error) throw error;
    return json({
      status: finalStatus,
      environment: company?.env ?? null,
      receptionStatus,
    });
  } catch (error) {
    console.error('superpdp connection failed', error instanceof Error ? error.name : 'unknown');
    return json(
      { error: error instanceof Error ? error.message : 'La connexion SUPER PDP a echoue.' },
      502,
    );
  }
});

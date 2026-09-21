import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';
import {
  decryptSecret,
  encryptSecret,
  refreshSuperPdpToken,
  SUPERPDP_PROVIDER_CODE,
} from '../../../src/features/einvoicing/provider/superpdp-contract.ts';

export interface SuperPdpConnectionRow {
  organization_id: string;
  provider_code: string;
  status: 'pending_verification' | 'connected' | 'action_required' | 'disconnected';
  provider_environment: 'sandbox' | 'production' | null;
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
  access_token_expires_at: string | null;
  token_type: string | null;
  /** Optionnelle : absente des lectures qui ne la sélectionnent pas (ex. avant Phase 3 réception). */
  reception_status?: 'not_requested' | 'pending_verification' | 'active' | 'failed';
}

export interface SuperPdpServerConfig {
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
  fetch?: typeof fetch;
  now?: () => Date;
}

export interface SuperPdpEnvironmentConfig extends SuperPdpServerConfig {
  expectedMode: 'sandbox' | 'production';
}

/**
 * Sélection des identifiants OAuth PAR ORGANISATION.
 *
 * Une seule organisation, désignée par `SUPERPDP_SANDBOX_TEST_ORGANIZATION_ID`,
 * bascule vers l'application bac à sable (`SUPERPDP_SANDBOX_CLIENT_ID/SECRET`).
 * Introduit pour tester la réception (Phase 3) sans jamais toucher une
 * connexion de production réelle : toute organisation qui n'est PAS celle-ci
 * continue d'utiliser exactement `SUPERPDP_CLIENT_ID`/`SUPERPDP_CLIENT_SECRET`
 * et `SUPERPDP_MODE`, comme avant l'ajout de cette fonction. Sans la variable
 * posée, aucune organisation ne bascule jamais — fermé par défaut.
 */
export function superPdpConfigFor(organizationId: string): SuperPdpEnvironmentConfig {
  const sandboxTestOrganizationId = Deno.env
    .get('SUPERPDP_SANDBOX_TEST_ORGANIZATION_ID')
    ?.trim();
  const useSandbox = Boolean(sandboxTestOrganizationId) && organizationId === sandboxTestOrganizationId;

  const clientId =
    (useSandbox
      ? Deno.env.get('SUPERPDP_SANDBOX_CLIENT_ID')
      : Deno.env.get('SUPERPDP_CLIENT_ID')
    )?.trim() ?? '';
  const clientSecret =
    (useSandbox
      ? Deno.env.get('SUPERPDP_SANDBOX_CLIENT_SECRET')
      : Deno.env.get('SUPERPDP_CLIENT_SECRET')
    )?.trim() ?? '';
  const encryptionKey = Deno.env.get('SUPERPDP_TOKEN_ENCRYPTION_KEY') ?? '';
  const expectedMode: 'sandbox' | 'production' = useSandbox
    ? 'sandbox'
    : ((Deno.env.get('SUPERPDP_MODE')?.trim() as 'sandbox' | 'production' | undefined) ??
      'sandbox');

  if (!clientId || !clientSecret || !encryptionKey)
    throw new Error('Le raccordement SUPER PDP attend encore ses identifiants de bac a sable.');
  return { clientId, clientSecret, encryptionKey, expectedMode };
}

const context = (organizationId: string) => `${organizationId}:${SUPERPDP_PROVIDER_CODE}`;

export async function encryptSuperPdpTokens(
  organizationId: string,
  tokens: { accessToken: string; refreshToken: string },
  encryptionKey: string,
) {
  const associatedData = context(organizationId);
  const [accessTokenCiphertext, refreshTokenCiphertext] = await Promise.all([
    encryptSecret(tokens.accessToken, encryptionKey, associatedData),
    encryptSecret(tokens.refreshToken, encryptionKey, associatedData),
  ]);
  return { accessTokenCiphertext, refreshTokenCiphertext };
}

export async function usableSuperPdpAccessToken(
  admin: SupabaseClient,
  connection: SuperPdpConnectionRow,
  config: SuperPdpServerConfig,
): Promise<string> {
  if (!connection.access_token_ciphertext || !connection.refresh_token_ciphertext)
    throw new Error('La connexion SUPER PDP doit etre renouvelee.');
  const now = config.now?.() ?? new Date();
  const expiresAt = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;
  if (expiresAt > now.getTime() + 60_000)
    return decryptSecret(
      connection.access_token_ciphertext,
      config.encryptionKey,
      context(connection.organization_id),
    );

  const previousRefreshCiphertext = connection.refresh_token_ciphertext;
  const refreshToken = await decryptSecret(
    previousRefreshCiphertext,
    config.encryptionKey,
    context(connection.organization_id),
  );
  try {
    const refreshed = await refreshSuperPdpToken(
      { clientId: config.clientId, clientSecret: config.clientSecret, refreshToken },
      config.fetch,
    );
    const encrypted = await encryptSuperPdpTokens(
      connection.organization_id,
      refreshed,
      config.encryptionKey,
    );
    const nextExpiry = new Date(now.getTime() + refreshed.expiresIn * 1000).toISOString();
    const { data, error } = await admin
      .from('einvoicing_provider_connections')
      .update({
        access_token_ciphertext: encrypted.accessTokenCiphertext,
        refresh_token_ciphertext: encrypted.refreshTokenCiphertext,
        access_token_expires_at: nextExpiry,
        token_type: refreshed.tokenType,
        last_error_code: null,
        last_error_message: null,
      })
      .eq('organization_id', connection.organization_id)
      .eq('refresh_token_ciphertext', previousRefreshCiphertext)
      .select('organization_id');
    if (error) throw error;
    if (data?.length) return refreshed.accessToken;
  } catch (error) {
    // Une autre requete peut avoir fait tourner le refresh token. Sa nouvelle
    // valeur est relue ci-dessous avant de declarer la connexion rompue.
    console.warn(
      'superpdp token refresh did not win',
      error instanceof Error ? error.name : 'unknown',
    );
  }

  const { data: current } = await admin
    .from('einvoicing_provider_connections')
    .select(
      'organization_id,provider_code,status,access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at,token_type',
    )
    .eq('organization_id', connection.organization_id)
    .maybeSingle();
  if (
    current?.access_token_ciphertext &&
    current.access_token_expires_at &&
    new Date(current.access_token_expires_at).getTime() > now.getTime()
  )
    return decryptSecret(
      current.access_token_ciphertext,
      config.encryptionKey,
      context(connection.organization_id),
    );
  throw new Error('La session SUPER PDP a expire. Reconnectez la plateforme.');
}

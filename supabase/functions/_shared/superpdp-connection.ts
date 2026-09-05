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
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
  access_token_expires_at: string | null;
  token_type: string | null;
}

export interface SuperPdpServerConfig {
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
  fetch?: typeof fetch;
  now?: () => Date;
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

import { z } from 'zod';

import { messageDeLaFonction, supabase, unwrapMaybe } from '@/services/supabase';
import type { Tables } from '@/types/database';

import {
  INSTAGRAM_GRAPH_API_VERSION,
  INSTAGRAM_OAUTH_URL,
  INSTAGRAM_SCOPES,
} from '../instagram-platform';

export type SocialAccount = Tables<'social_accounts'>;

export const instagramAccountColumns =
  'id,organization_id,provider,provider_account_id,username,display_name,profile_picture_url,account_type,status,granted_permissions,last_synced_at,publishing_suspended_at,publishing_suspended_by,created_by,connected_by,connected_at,last_error_code,last_error_message,created_at,updated_at';

const readinessResponse = z.object({
  configured: z.boolean(),
  graphApiVersion: z.literal(INSTAGRAM_GRAPH_API_VERSION),
  scopes: z.array(z.enum(INSTAGRAM_SCOPES)),
});

const startResponse = z.object({ url: z.url() });

const actionResponse = z.object({
  status: z.enum(['connected', 'disconnected']).optional(),
  accountId: z.string().uuid().optional(),
});

async function authenticatedFunctionHeaders(): Promise<{ Authorization: string }> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Votre session a expiré. Reconnectez-vous.');

  const expiresAt = data.session.expires_at ?? 0;
  let session = data.session;
  if (expiresAt <= Math.floor(Date.now() / 1000) + 120) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session)
      throw new Error('Votre session a expiré. Reconnectez-vous.');
    session = refreshed.data.session;
  }

  return { Authorization: `Bearer ${session.access_token}` };
}

export async function getInstagramAccount(organizationId: string): Promise<SocialAccount | null> {
  return unwrapMaybe(
    supabase
      .from('social_accounts')
      .select(instagramAccountColumns)
      .eq('organization_id', organizationId)
      .eq('provider', 'instagram')
      .maybeSingle(),
  );
}

async function invokeInstagramConnection(
  organizationId: string,
  action: 'readiness' | 'start' | 'sync' | 'disconnect',
) {
  const response = await supabase.functions.invoke<unknown>('instagram-connection', {
    headers: await authenticatedFunctionHeaders(),
    body: {
      organizationId,
      action,
      ...(action === 'start' ? { returnUrl: `${window.location.origin}/settings` } : {}),
    },
  });
  if (response.error)
    throw new Error(
      await messageDeLaFonction(response.error, 'La connexion Instagram n’a pas pu être modifiée.'),
    );
  return response.data;
}

export async function getInstagramReadiness(organizationId: string) {
  const parsed = readinessResponse.safeParse(
    await invokeInstagramConnection(organizationId, 'readiness'),
  );
  if (!parsed.success) throw new Error('La configuration Instagram est illisible.');
  return parsed.data;
}

export async function startInstagramConnection(organizationId: string): Promise<string> {
  const parsed = startResponse.safeParse(await invokeInstagramConnection(organizationId, 'start'));
  if (!parsed.success) throw new Error('Le service n’a pas retourné de lien d’autorisation.');
  const url = new URL(parsed.data.url);
  const official = new URL(INSTAGRAM_OAUTH_URL);
  if (url.origin !== official.origin || url.pathname !== official.pathname)
    throw new Error('Le lien d’autorisation Instagram est invalide.');
  return url.toString();
}

export async function syncInstagramConnection(organizationId: string) {
  const parsed = actionResponse.safeParse(await invokeInstagramConnection(organizationId, 'sync'));
  if (!parsed.success) throw new Error('Le statut Instagram est incomplet.');
  return parsed.data;
}

export async function disconnectInstagram(organizationId: string) {
  const parsed = actionResponse.safeParse(
    await invokeInstagramConnection(organizationId, 'disconnect'),
  );
  if (!parsed.success) throw new Error('La déconnexion Instagram n’a pas été confirmée.');
  return parsed.data;
}

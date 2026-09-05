import { z } from 'zod';

import { messageDeLaFonction, supabase, unwrapMaybe } from '@/services/supabase';
import type { EinvoicingProviderConnection } from '@/types/domain';

const connectionColumns =
  'organization_id,provider_code,status,provider_company_id,provider_environment,company_verification_status,user_identity_verification_status,connected_at,last_verified_at,last_error_code,last_error_message,created_at,updated_at';

const actionResponse = z.object({
  status: z.string().optional(),
  environment: z.enum(['sandbox', 'production']).nullable().optional(),
});
const readinessResponse = z.object({
  configured: z.boolean(),
  environment: z.enum(['sandbox', 'production']),
});
const startResponse = z.object({ url: z.url() });
const transmissionResponse = z.object({
  status: z.string(),
  providerSubmissionId: z.string().nullable(),
});

async function authenticatedFunctionHeaders(): Promise<{ Authorization: string }> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Votre session a expiré. Reconnectez-vous.');

  // Supabase renouvelle déjà les sessions en arrière-plan. Forcer une rotation à
  // chaque lecture de statut créait une course entre les onglets et finissait par
  // invalider le refresh token. On ne renouvelle ici qu'un jeton proche de son
  // expiration, puis on transmet explicitement le jeton courant à l'Edge Function.
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

export async function getEinvoicingProviderConnection(
  organizationId: string,
): Promise<EinvoicingProviderConnection | null> {
  return unwrapMaybe(
    supabase
      .from('einvoicing_provider_connections')
      .select(connectionColumns)
      .eq('organization_id', organizationId)
      .maybeSingle(),
  ) as Promise<EinvoicingProviderConnection | null>;
}

async function invokeConnection(
  organizationId: string,
  action: 'readiness' | 'start' | 'verify' | 'disconnect',
) {
  const response = await supabase.functions.invoke<unknown>('superpdp-connection', {
    headers: await authenticatedFunctionHeaders(),
    body: {
      organizationId,
      action,
      ...(action === 'start'
        ? { returnUrl: `${window.location.origin}/organisation/facturation-electronique` }
        : {}),
    },
  });
  if (response.error)
    throw new Error(
      await messageDeLaFonction(response.error, 'La connexion SUPER PDP n’a pas pu être modifiée.'),
    );
  return response.data;
}

export async function getSuperPdpReadiness(organizationId: string) {
  const parsed = readinessResponse.safeParse(await invokeConnection(organizationId, 'readiness'));
  if (!parsed.success) throw new Error('La configuration SUPER PDP est illisible.');
  return parsed.data;
}

export async function startSuperPdpConnection(organizationId: string): Promise<string> {
  const parsed = startResponse.safeParse(await invokeConnection(organizationId, 'start'));
  if (!parsed.success) throw new Error('Le service n’a pas retourné de lien d’autorisation.');
  const url = new URL(parsed.data.url);
  if (url.origin !== 'https://api.superpdp.tech' || url.pathname !== '/oauth2/authorize')
    throw new Error('Le lien d’autorisation SUPER PDP est invalide.');
  return url.toString();
}

export async function verifySuperPdpConnection(organizationId: string) {
  const parsed = actionResponse.safeParse(await invokeConnection(organizationId, 'verify'));
  if (!parsed.success) throw new Error('Le statut SUPER PDP est incomplet.');
  return parsed.data;
}

export async function disconnectSuperPdp(organizationId: string) {
  const parsed = actionResponse.safeParse(await invokeConnection(organizationId, 'disconnect'));
  if (!parsed.success) throw new Error('La déconnexion SUPER PDP n’a pas été confirmée.');
  return parsed.data;
}

async function invoiceAction(invoiceId: string, action: 'submit' | 'sync') {
  const response = await supabase.functions.invoke<unknown>('superpdp-invoice', {
    headers: await authenticatedFunctionHeaders(),
    body: { invoiceId, action },
  });
  if (response.error)
    throw new Error(
      await messageDeLaFonction(
        response.error,
        action === 'submit'
          ? 'La facture n’a pas pu être transmise.'
          : 'Le statut n’a pas pu être actualisé.',
      ),
    );
  const parsed = transmissionResponse.safeParse(response.data);
  if (!parsed.success) throw new Error('La réponse de transmission est incomplète.');
  return parsed.data;
}

export const submitInvoiceToSuperPdp = (invoiceId: string) => invoiceAction(invoiceId, 'submit');
export const syncInvoiceFromSuperPdp = (invoiceId: string) => invoiceAction(invoiceId, 'sync');

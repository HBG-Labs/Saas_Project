import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import { isPrivateIpv4, isPrivateIpv6 } from '../_shared/contact-scraper.ts';
import {
  CONTACT_SCRAPER_USER_AGENT,
  createContactScraperHandler,
  type CallerStore,
  type PageFetchResult,
} from './handler.ts';

/**
 * Point d'entrée : un seul client Supabase, celui de l'appelant — la RLS
 * juge (même patron que `portal-message-send`). Aucun `service_role` ici :
 * rien dans ce flux n'a besoin de contourner la RLS.
 */

function env(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === '') throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

function callerClient(authorization: string): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
}

function makeCallerStore(caller: SupabaseClient): CallerStore {
  return {
    async getWebsite(siren) {
      const { data } = await caller
        .from('prospect_contacts')
        .select('value')
        .eq('siren', siren)
        .eq('contact_type', 'website')
        .order('collected_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.value as string | undefined) ?? null;
    },
    async insertContacts(siren, contacts) {
      const { data, error } = await caller
        .from('prospect_contacts')
        .upsert(
          contacts.map((c) => ({
            siren,
            contact_type: c.contactType,
            value: c.value,
            source: 'site_officiel',
            confidence: 0.6,
          })),
          { onConflict: 'siren,contact_type,value', ignoreDuplicates: true },
        )
        .select('id, contact_type, value');
      if (error !== null) return { error: error.message };
      return data ?? [];
    },
  };
}

/**
 * Résolution DNS réelle du nom d'hôte, rejetée si une seule des IP
 * obtenues est privée/loopback/lien-local — empêche un domaine public
 * de pointer (« DNS rebinding ») vers un service interne.
 */
async function resolveIsPublic(hostname: string): Promise<boolean> {
  try {
    const [ipv4, ipv6] = await Promise.all([
      Deno.resolveDns(hostname, 'A').catch(() => []),
      Deno.resolveDns(hostname, 'AAAA').catch(() => []),
    ]);
    if (ipv4.length === 0 && ipv6.length === 0) return false;
    if (ipv4.some(isPrivateIpv4)) return false;
    if (ipv6.some(isPrivateIpv6)) return false;
    return true;
  } catch {
    return false;
  }
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 3_000_000;

async function fetchPage(url: string): Promise<PageFetchResult> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': CONTACT_SCRAPER_USER_AGENT, Accept: 'text/html,text/plain,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const contentLength = Number(response.headers.get('content-length') ?? '0');
    if (contentLength > MAX_RESPONSE_BYTES) {
      return { ok: false, status: response.status, text: '' };
    }
    const text = await response.text();
    return { ok: response.ok, status: response.status, text: text.slice(0, MAX_RESPONSE_BYTES) };
  } catch {
    return { ok: false, status: 0, text: '' };
  }
}

Deno.serve(async (request) => {
  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return new Response(JSON.stringify({ error: 'Authentification requise.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const handler = createContactScraperHandler({
    caller: makeCallerStore(callerClient(authorization)),
    fetchPage,
    resolveIsPublic,
  });
  return handler(request);
});

import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

import { createPortalFileUrlHandler, type FileUrlAdmin, type FileUrlCaller } from './handler.ts';

/**
 * Point d'entrée. Le jeton de l'appelant décide (`portal_can_read_file`) ;
 * le rôle de service signe ensuite, pour ce seul fichier, une URL de cinq
 * minutes. Il ne quitte pas cette fonction.
 */

function env(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === '') throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const adminStore: FileUrlAdmin = {
  async signUrl(bucket, path, ttlSeconds) {
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, ttlSeconds);
    if (error !== null || !data?.signedUrl) return null;
    return data.signedUrl;
  },
  async audit(input) {
    await admin.from('audit_logs').insert({
      organization_id: input.organizationId,
      user_id: null,
      actor_label: 'portail client',
      action: 'portal.document_downloaded',
      entity_type: 'customer_contact',
      entity_id: input.contactId,
      metadata: { bucket: input.bucket, path: input.path },
    });
  },
};

Deno.serve((request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return new Response(JSON.stringify({ error: 'Authentification requise.' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const caller = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const callerStore: FileUrlCaller = {
    async canRead(bucket, path) {
      const { data } = await caller.rpc('portal_can_read_file', { p_bucket: bucket, p_path: path });
      return data === true;
    },
    async identity() {
      const { data } = await caller.rpc('portal_my_context');
      const me = Array.isArray(data) ? data[0] : null;
      return me ? { organization_id: me.organization_id, contact_id: me.contact_id } : null;
    },
  };

  return createPortalFileUrlHandler({ caller: callerStore, admin: adminStore })(request);
});

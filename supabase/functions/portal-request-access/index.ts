import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

import { readTransport, sendMessage } from '../_shared/email.ts';
import { createPortalRequestAccessHandler, type AccessStore, type PortalGate } from './handler.ts';

/**
 * Point d'entrée : `verify_jwt = false` — l'appelant n'a pas encore de session.
 *
 * Le client `service_role` sert à trois choses, et rien d'autre : interroger
 * la porte (`portal_gate_for_email`, réservée à ce rôle), consigner la demande
 * dans l'audit, et faire générer le code par Supabase Auth. La clé ne quitte
 * pas cette fonction.
 */

function env(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === '') throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const store: AccessStore = {
  async portalGate(email): Promise<PortalGate | null> {
    const { data, error } = await admin.rpc('portal_gate_for_email', { p_email: email });
    if (error !== null) throw new Error(`portal_gate_for_email : ${error.message}`);
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return null;
    return { contact_id: row.contact_id, organization_id: row.organization_id, organization_name: row.organization_name };
  },

  async recentRequests(contactId, sinceIso) {
    const { count } = await admin
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', 'customer_contact')
      .eq('entity_id', contactId)
      .eq('action', 'portal.code_requested')
      .gte('created_at', sinceIso);
    return count ?? 0;
  },

  async recordRequest(gate) {
    // Le journal est immuable et n'accepte que des insertions : celle-ci
    // trace le fait, jamais le code.
    const { error } = await admin.from('audit_logs').insert({
      organization_id: gate.organization_id,
      user_id: null,
      actor_label: 'portail client',
      action: 'portal.code_requested',
      entity_type: 'customer_contact',
      entity_id: gate.contact_id,
      metadata: {},
    });
    if (error !== null) throw new Error(`audit_logs : ${error.message}`);
  },

  async issueOtp(email) {
    const generate = () => admin.auth.admin.generateLink({ type: 'magiclink', email });
    let result = await generate();
    if (result.error !== null) {
      // Premier accès : le compte n'existe pas encore. On le crée confirmé,
      // marqué « portail » — le navigateur s'en sert pour router vers /portail.
      const created = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        app_metadata: { portal: true },
      });
      if (created.error !== null) throw new Error(`Création du compte : ${created.error.message}`);
      result = await generate();
      if (result.error !== null) throw new Error(`Génération du code : ${result.error.message}`);
    }
    const code = result.data.properties?.email_otp;
    if (typeof code !== 'string' || code.length === 0) throw new Error('Supabase Auth n’a pas fourni de code.');
    return { code };
  },
};

Deno.serve((request) => {
  const state = readTransport('PORTAL_FROM_EMAIL', { require: 'resend' });
  const handler = createPortalRequestAccessHandler({
    store,
    send: (message) => sendMessage(message, state),
    missing: state.missing,
  });
  return handler(request);
});

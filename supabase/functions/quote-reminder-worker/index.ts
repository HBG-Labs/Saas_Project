import { dateLisible, readTransport, sendMessage } from '../_shared/email.ts';
import { createQuoteReminderWorkerHandler } from './handler.ts';

// Même exigence que `portal-message-send` : Resend, et rien d'autre — une
// relance est un message du fil, elle doit pouvoir recevoir une réponse.
const state = readTransport('PORTAL_FROM_EMAIL', { require: 'resend' });
const missing = [...state.missing];
for (const name of ['PORTAL_REPLY_SECRET', 'PORTAL_INBOUND_DOMAIN', 'APP_URL']) {
  if (!Deno.env.get(name)) missing.push(name);
}

Deno.serve(
  createQuoteReminderWorkerHandler({
    url: Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    secret: Deno.env.get('QUOTE_REMINDER_WORKER_SECRET') ?? '',
    missing,
    send: (message) => sendMessage(message, state),
    replySecret: Deno.env.get('PORTAL_REPLY_SECRET') ?? '',
    inboundDomain: Deno.env.get('PORTAL_INBOUND_DOMAIN') ?? '',
    portalUrl: `${(Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')}/portail`,
    formatDate: dateLisible,
  }),
);

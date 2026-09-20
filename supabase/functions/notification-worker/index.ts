import { fuseau, readTransport, sendMessage } from '../_shared/email.ts';
import type { NotificationEmail } from '../_shared/notification-emails.ts';
import { createNotificationWorkerHandler } from './handler.ts';

/**
 * Réveillée chaque minute par pg_cron (`app.trigger_notification_worker`),
 * seulement quand la file a quelque chose à envoyer. Le transport est celui
 * des invitations et des alertes administrateur : rien à configurer de plus.
 */
const transport = readTransport('INVITATION_FROM_EMAIL');
const sendEmail =
  transport.transport === null || transport.from === undefined
    ? null
    : async (content: NotificationEmail, to: string) => {
        const result = await sendMessage(
          { to, subject: content.subject, html: content.html, text: content.text },
          transport,
        );
        return { providerId: result.providerId };
      };

Deno.serve(
  createNotificationWorkerHandler({
    url: Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    secret: Deno.env.get('NOTIFICATION_WORKER_SECRET') ?? '',
    appUrl: Deno.env.get('APP_URL'),
    timeZone: fuseau(),
    sendEmail,
  }),
);

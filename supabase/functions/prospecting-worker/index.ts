import { createRechercheEntreprisesProvider } from '../_shared/prospecting-provider.ts';
import { sendProspectingNotificationEmail } from '../_shared/prospecting-notifications.ts';
import { createProspectingWorkerHandler } from './handler.ts';

// Même destinataire que les alertes d'inscription (Phase 2 validation, point
// 8 : « ne change pas cette configuration silencieusement ») — un seul
// administrateur plateforme aujourd'hui, pas de secret séparé à faire diverger.
const notifyEmail = Deno.env.get('ADMIN_SIGNUP_EMAIL')?.trim() || undefined;
const appUrl = Deno.env.get('APP_URL')?.trim();

Deno.serve(
  createProspectingWorkerHandler({
    url: Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    secret: Deno.env.get('PROSPECTING_WORKER_SECRET') ?? '',
    provider: createRechercheEntreprisesProvider(),
    notifyEmail,
    appUrl: appUrl ? `${appUrl.replace(/\/+$/, '')}/admin/prospection` : undefined,
    sendNotification: notifyEmail ? sendProspectingNotificationEmail : undefined,
  }),
);

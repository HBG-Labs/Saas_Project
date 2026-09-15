import { sendSignupAlertEmail, sendSignupAlertPush } from '../_shared/admin-signup-alerts.ts';
import { horodatage } from '../_shared/email.ts';
import { createSignupAlertWorkerHandler } from './handler.ts';

const adminEmail = Deno.env.get('ADMIN_SIGNUP_EMAIL')?.trim() || undefined;
const oneSignalAppId = Deno.env.get('ONESIGNAL_APP_ID')?.trim() || undefined;
const oneSignalRestApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY')?.trim() || undefined;
const oneSignalExternalUserId = Deno.env.get('ONESIGNAL_ADMIN_EXTERNAL_ID')?.trim() || undefined;

Deno.serve(
  createSignupAlertWorkerHandler({
    url: Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    secret: Deno.env.get('ADMIN_SIGNUP_ALERT_WORKER_SECRET') ?? '',
    adminEmail,
    appUrl: Deno.env.get('APP_URL'),
    formatSignedUpAt: horodatage,
    // `null` plutôt qu'une fonction qui échouerait à l'appel : le worker sait
    // alors DIRECTEMENT que le canal n'est pas configuré, sans avoir à
    // interpréter une exception réseau pour le deviner.
    sendEmail: adminEmail ? (content, to) => sendSignupAlertEmail(content, to) : null,
    oneSignalAppId,
    oneSignalExternalUserId,
    sendPush:
      oneSignalAppId && oneSignalRestApiKey && oneSignalExternalUserId
        ? (payload) => sendSignupAlertPush(payload, { restApiKey: oneSignalRestApiKey })
        : null,
  }),
);

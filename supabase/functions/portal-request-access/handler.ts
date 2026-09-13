import { escapeHtml, type Message, type SendResult } from '../_shared/email.ts';
import { normalizeEmail } from '../_shared/portal-mail.ts';

/**
 * Demande d'accès au portail client : un code à usage unique par courriel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE FONCTION NE RÉVÈLE PAS
 *
 * La réponse est la même pour toute adresse : « si cette adresse a accès, un
 * code vient de partir ». Une adresse inconnue, un accès révoqué, un portail
 * désactivé, une formule sans le module — rien ne se distingue de l'extérieur.
 * Sans quoi la page de connexion deviendrait un moyen de savoir qui est client
 * de qui.
 *
 * CE QUI OUVRE LA PORTE
 *
 * L'adresse doit correspondre à un contact `portal_enabled` dont
 * l'organisation a le portail activé ET la formule qui le comprend — les mêmes
 * conditions que `app.my_portal_contact_ids()` en base, et c'est la base qui
 * les tient : `portalGate` ne fait que les interroger.
 *
 * LE CODE
 *
 * Supabase Auth le génère (`generateLink`, type magiclink → `email_otp`) ; nous
 * l'envoyons nous-mêmes, par Resend, avec notre gabarit. Le navigateur le
 * vérifie ensuite avec `verifyOtp({ type: 'email' })`. La session obtenue est
 * une session Supabase ordinaire : c'est `auth.jwt() ->> 'email'` qui, en base,
 * fait de son porteur un contact du portail — et rien d'autre.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface PortalGate {
  organization_id: string;
  organization_name: string;
  contact_id: string;
}

export interface AccessStore {
  /** Le contact autorisé pour cette adresse, ou `null` — sans dire pourquoi. */
  portalGate(email: string): Promise<PortalGate | null>;
  /** Nombre de codes demandés pour ce contact dans la fenêtre. */
  recentRequests(contactId: string, sinceIso: string): Promise<number>;
  /** Trace la demande (audit) ; jamais le code. */
  recordRequest(gate: PortalGate): Promise<void>;
  /** Fait générer le code par Supabase Auth ; crée le compte s'il n'existe pas. */
  issueOtp(email: string): Promise<{ code: string }>;
}

export interface AccessConfig {
  store: AccessStore;
  send: (message: Message) => Promise<SendResult>;
  missing: string[];
  now?: () => Date;
  /** Fenêtre et plafond : 3 codes par 15 minutes par contact. */
  windowMinutes?: number;
  maxPerWindow?: number;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

const NEUTRAL = { ok: true, message: 'Si cette adresse a accès au portail, un code vient de lui être envoyé.' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function renderOtpEmail(input: { organizationName: string; code: string; expiresMinutes: number }): { subject: string; html: string; text: string } {
  const code = escapeHtml(input.code);
  const org = escapeHtml(input.organizationName);
  const subject = `${input.code} — votre code d'accès à l'espace client ${input.organizationName}`;
  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#111827;max-width:600px">',
    `<p style="margin:0 0 16px">Bonjour,</p>`,
    `<p style="margin:0 0 16px">Voici votre code pour accéder à l'espace client de <strong>${org}</strong> :</p>`,
    `<p style="margin:0 0 16px;font-size:32px;letter-spacing:8px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${code}</p>`,
    `<p style="margin:0 0 16px;color:#4b5563">Il expire dans ${input.expiresMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message : rien ne se passera.</p>`,
    `<p style="margin:12px 0 0;color:#6b7280;font-size:12px">${org} · via REZO360</p>`,
    '</div>',
  ].join('');
  const text = [
    'Bonjour,',
    '',
    `Voici votre code pour accéder à l'espace client de ${input.organizationName} :`,
    '',
    `    ${input.code}`,
    '',
    `Il expire dans ${input.expiresMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message : rien ne se passera.`,
    '',
    `${input.organizationName} · via REZO360`,
  ].join('\n');
  return { subject, html, text };
}

export function createPortalRequestAccessHandler(config: AccessConfig) {
  const clock = config.now ?? (() => new Date());
  const windowMinutes = config.windowMinutes ?? 15;
  const maxPerWindow = config.maxPerWindow ?? 3;

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
    if (config.missing.length > 0) {
      return json({ error: `Envoi non configuré : ${config.missing.join(', ')} absent(s) des secrets de la fonction.` }, 500);
    }

    let raw: { email?: unknown };
    try {
      raw = await request.json() as { email?: unknown };
    } catch {
      return json({ error: 'Corps de requête invalide.' }, 400);
    }
    const email = typeof raw.email === 'string' ? normalizeEmail(raw.email) : '';
    if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: 'Adresse e-mail invalide.' }, 400);

    const gate = await config.store.portalGate(email);
    if (gate === null) return json(NEUTRAL);

    const since = new Date(clock().getTime() - windowMinutes * 60_000).toISOString();
    if (await config.store.recentRequests(gate.contact_id, since) >= maxPerWindow) {
      // Même réponse : le plafond ne se voit pas de l'extérieur, mais rien ne part.
      return json(NEUTRAL);
    }

    await config.store.recordRequest(gate);
    const { code } = await config.store.issueOtp(email);
    const rendered = renderOtpEmail({ organizationName: gate.organization_name, code, expiresMinutes: 60 });
    try {
      await config.send({ to: email, ...rendered });
    } catch (error) {
      // Ici, dire la vérité : l'appelant est autorisé, et il attend un code qui n'arrivera pas.
      const reason = error instanceof Error ? error.message : String(error);
      return json({ error: `Le code n'a pas pu être envoyé : ${reason}` }, 502);
    }
    return json(NEUTRAL);
  };
}

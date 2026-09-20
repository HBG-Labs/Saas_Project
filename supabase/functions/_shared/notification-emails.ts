import { escapeHtml } from './email.ts';

/**
 * Les e-mails de notification (affectation, congé, compte rendu).
 *
 * Tout ce qui est écrit ici vient de `notification_deliveries.payload`, un
 * instantané pris à l'événement par la base. Ce module ne lit rien d'autre :
 * il met en forme, il ne décide pas. Court, en français, un lien profond vers
 * l'écran — arbitrage F.
 */

export type NotificationEvent =
  'mission_assigned' | 'leave_requested' | 'leave_decided' | 'report_submitted' | 'report_rejected';

export interface ClaimedDelivery {
  id: string;
  organization_id: string;
  organization_name: string;
  recipient_user_id: string;
  recipient_email: string;
  recipient_name: string;
  event: NotificationEvent;
  entity_id: string;
  payload: Record<string, unknown>;
  attempts: number;
  notify_new_mission: boolean;
  notify_leave_requests: boolean;
  notify_report_review: boolean;
}

export interface NotificationEmail {
  subject: string;
  html: string;
  text: string;
}

const LEAVE_LABELS: Record<string, string> = {
  paid_leave: 'Congé payé',
  rtt: 'RTT',
  sick_leave: 'Arrêt maladie',
  unpaid: 'Congé sans solde',
  family: 'Événement familial',
  recovery: 'Récupération',
};

/** Le réglage qui gouverne cet événement — évalué à l'envoi (arbitrage D). */
export function wantsEmail(delivery: ClaimedDelivery): boolean {
  switch (delivery.event) {
    case 'mission_assigned':
      return delivery.notify_new_mission;
    case 'leave_requested':
    case 'leave_decided':
      return delivery.notify_leave_requests;
    case 'report_submitted':
    case 'report_rejected':
      return delivery.notify_report_review;
  }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** `2026-11-02` → `2 novembre 2026` ; un ISO complet → date et heure. */
export function dateLisible(value: unknown, timeZone = 'Europe/Paris'): string {
  const raw = str(value);
  if (!raw) return '';
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00Z` : raw);
  if (Number.isNaN(date.getTime())) return raw;
  return raw.length === 10
    ? date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : date.toLocaleString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      });
}

/** `${APP_URL}${path}`, sans double barre ; `null` sans APP_URL. */
export function deepLink(appUrl: string | undefined, path: unknown): string | null {
  const base = appUrl?.trim().replace(/\/+$/, '');
  const chemin = str(path);
  if (!base || !chemin) return null;
  return `${base}${chemin.startsWith('/') ? '' : '/'}${chemin}`;
}

interface Lines {
  subject: string;
  intro: string;
  facts: Array<[string, string]>;
  cta: string;
}

function lines(delivery: ClaimedDelivery, timeZone: string): Lines {
  const p = delivery.payload;
  const who = str(p.actor) || 'Un collègue';
  switch (delivery.event) {
    case 'mission_assigned':
      return {
        subject: `Mission affectée : ${str(p.title) || str(p.reference) || 'nouvelle mission'}`,
        intro: `${who} vous a affecté une mission.`,
        facts: [
          ['Mission', [str(p.reference), str(p.title)].filter(Boolean).join(' — ')],
          ['Quand', dateLisible(p.scheduled_start, timeZone)],
          ['Où', str(p.address)],
          ['Client', str(p.customer_name)],
        ],
        cta: 'Ouvrir la mission',
      };
    case 'leave_requested':
      return {
        subject: `Congé à valider : ${str(p.requester)}`,
        intro: `${str(p.requester) || 'Un membre'} demande un congé.`,
        facts: [
          ['Type', LEAVE_LABELS[str(p.type)] ?? str(p.type)],
          ['Du', dateLisible(p.start_date)],
          ['Au', dateLisible(p.end_date)],
          ['Jours', str(p.days_count) || String(p.days_count ?? '')],
        ],
        cta: 'Ouvrir le planning',
      };
    case 'leave_decided': {
      const accepte = str(p.status) === 'approved';
      return {
        subject: accepte ? 'Congé accordé' : 'Congé refusé',
        intro: `${who} a ${accepte ? 'accordé' : 'refusé'} votre demande de congé.`,
        facts: [
          ['Type', LEAVE_LABELS[str(p.type)] ?? str(p.type)],
          ['Du', dateLisible(p.start_date)],
          ['Au', dateLisible(p.end_date)],
          ['Motif', str(p.review_note)],
        ],
        cta: 'Ouvrir le planning',
      };
    }
    case 'report_submitted':
      return {
        subject: `Compte rendu à contrôler : ${str(p.title) || str(p.reference)}`,
        intro: `${str(p.technician) || 'Un technicien'} a soumis un compte rendu d'intervention.`,
        facts: [['Mission', [str(p.reference), str(p.title)].filter(Boolean).join(' — ')]],
        cta: "Ouvrir l'intervention",
      };
    case 'report_rejected':
      return {
        subject: `Compte rendu à reprendre : ${str(p.title) || str(p.reference)}`,
        intro: `${who} vous renvoie votre compte rendu pour correction.`,
        facts: [
          ['Mission', [str(p.reference), str(p.title)].filter(Boolean).join(' — ')],
          ['Motif', str(p.rejection_reason)],
        ],
        cta: "Ouvrir l'intervention",
      };
  }
}

export function buildNotificationEmail(
  delivery: ClaimedDelivery,
  options: { appUrl?: string | undefined; timeZone?: string } = {},
): NotificationEmail {
  const { subject, intro, facts, cta } = lines(delivery, options.timeZone ?? 'Europe/Paris');
  const link = deepLink(options.appUrl, delivery.payload.path);
  const faits = facts.filter(([, valeur]) => valeur.trim().length > 0);
  const prenom = delivery.recipient_name || 'Bonjour';

  const text = [
    `Bonjour ${prenom},`,
    '',
    intro,
    '',
    ...faits.map(([label, valeur]) => `${label} : ${valeur}`),
    '',
    link ? `${cta} : ${link}` : '',
    '',
    `— REZO360, pour ${delivery.organization_name}`,
    'Vous recevez ce message selon vos réglages de notification dans REZO360.',
  ]
    .filter((ligne, index, tout) => !(ligne === '' && tout[index - 1] === ''))
    .join('\n');

  const html = `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;font-size:15px;color:#1f2937;line-height:1.5">
<p>Bonjour ${escapeHtml(prenom)},</p>
<p>${escapeHtml(intro)}</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
${faits
  .map(
    ([label, valeur]) =>
      `<tr><td style="padding:2px 12px 2px 0;color:#6b7280">${escapeHtml(label)}</td><td style="padding:2px 0">${escapeHtml(valeur)}</td></tr>`,
  )
  .join('\n')}
</table>
${link ? `<p style="margin:20px 0"><a href="${escapeHtml(link)}" style="background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${escapeHtml(cta)}</a></p>` : ''}
<p style="color:#6b7280;font-size:13px">— REZO360, pour ${escapeHtml(delivery.organization_name)}<br>Vous recevez ce message selon vos réglages de notification dans REZO360.</p>
</body></html>`;

  return { subject, html, text };
}

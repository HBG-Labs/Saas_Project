import { escapeHtml, readTransport, sendMessage, type Message, type SendResult, type TransportState } from './email.ts';

/**
 * Notification interne agrégée après un passage du CRON quotidien (§27 du
 * cahier des charges, Phase 10). Réutilise le transport e-mail partagé
 * (`_shared/email.ts`) — même socle que `admin-signup-alerts.ts`, pas un
 * second client à maintenir.
 *
 * ENVOYÉE UNIQUEMENT S'IL Y A QUELQUE CHOSE DE PERTINENT À DIRE : c'est
 * l'appelant (`prospecting-worker/handler.ts`) qui décide de ne construire ce
 * message que si `total > 0` — « Éviter les notifications inutiles si aucune
 * opportunité pertinente » (§27).
 */

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface ProspectingRunBreakdown {
  total: number;
  tiers: { forte: number; moyenne: number; basse: number };
  /** Libellé de zone → nombre de nouvelles opportunités dans cette zone. */
  byZone: Record<string, number>;
}

export function buildProspectingNotificationEmail(
  breakdown: ProspectingRunBreakdown,
  appUrl: string | undefined,
): EmailContent {
  const subject = `${breakdown.total} nouvelle${breakdown.total > 1 ? 's' : ''} opportunité${breakdown.total > 1 ? 's' : ''} REZO360`;

  const tierRows: Array<[string, number]> = (
    [
      ['🔥 Opportunités fortes', breakdown.tiers.forte],
      ['🟠 Opportunités moyennes', breakdown.tiers.moyenne],
      ['🔵 Autres prospects', breakdown.tiers.basse],
    ] as const
  ).filter(([, count]) => count > 0) as Array<[string, number]>;

  const zoneRows = Object.entries(breakdown.byZone).filter(([, count]) => count > 0);

  const textTiers = tierRows.map(([label, count]) => `${label.replace(/^[^\s]+\s/, '')} : ${count}`).join('\n');
  const textZones = zoneRows.map(([label, count]) => `${label} : ${count}`).join('\n');

  const text = [
    `${subject} détectées.`,
    '',
    textTiers,
    '',
    'Répartition géographique :',
    textZones,
    '',
    appUrl ? `Voir le radar : ${appUrl}` : '',
  ]
    .filter((line) => line !== '')
    .join('\n');

  const htmlTierRows = tierRows
    .map(
      ([label, count]) =>
        `<tr><td style="padding:4px 12px 4px 0;">${escapeHtml(label)}</td>` +
        `<td style="padding:4px 0;font-weight:700;">${count}</td></tr>`,
    )
    .join('');

  const htmlZoneRows = zoneRows
    .map(
      ([label, count]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">${escapeHtml(label)}</td>` +
        `<td style="padding:4px 0;font-weight:600;">${count}</td></tr>`,
    )
    .join('');

  const ctaHtml = appUrl
    ? `<p style="margin:24px 0;">
        <a href="${escapeHtml(appUrl)}"
           style="background:#111827;color:#ffffff;padding:10px 20px;border-radius:8px;
                  text-decoration:none;font-weight:600;display:inline-block;">
          Voir le radar
        </a>
      </p>`
    : '';

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;">
      <h1 style="font-size:18px;margin:0 0 16px;">${escapeHtml(subject)} détectées</h1>
      <table style="border-collapse:collapse;margin-bottom:16px;">${htmlTierRows}</table>
      <h2 style="font-size:13px;color:#6b7280;margin:0 0 8px;text-transform:uppercase;">Répartition géographique</h2>
      <table style="border-collapse:collapse;">${htmlZoneRows}</table>
      ${ctaHtml}
    </div>
  `;

  return { subject, html, text };
}

/** Envoi réel, avec le transport partagé — `INVITATION_FROM_EMAIL` comme émetteur, déjà configuré. */
export async function sendProspectingNotificationEmail(content: EmailContent, to: string): Promise<SendResult> {
  const state: TransportState = readTransport('INVITATION_FROM_EMAIL');
  const message: Message = { to, subject: content.subject, html: content.html, text: content.text };
  return sendMessage(message, state);
}

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { escapeHtml, readTransport, sendMessage } from '../_shared/email.ts';

/**
 * Notifie l'équipe d'une demande d'assistance déjà enregistrée.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA DEMANDE EXISTE AVANT CET APPEL, ET C'EST TOUT LE PRINCIPE
 *
 * Le client écrit d'abord dans `support_requests`, puis appelle cette fonction.
 * L'ordre importe : si l'envoi échoue, la demande est conservée et se retrouve
 * dans le tableau de bord. L'inverse — envoyer puis enregistrer — perdrait le
 * message au premier hoquet du serveur de messagerie, ce qui est exactement le
 * défaut qu'on corrige ici.
 *
 * Cette fonction ne renvoie donc JAMAIS d'erreur pour un échec d'envoi. Elle
 * répond `{ notified: false, reason }`, et l'écran le dit honnêtement au
 * client : « votre demande est enregistrée, mais la notification n'est pas
 * partie ; voici notre adresse directe. »
 *
 * POURQUOI `service_role`
 *
 * `support_requests` n'a aucune policy de lecture — délibérément : il n'existe
 * pas d'arrière-guichet, et personne ne doit pouvoir lire les demandes des
 * autres. Relire la ligne demande donc de contourner la RLS, ce qui est le rôle
 * exact de cette clé et la raison pour laquelle elle ne vit que côté serveur.
 *
 * L'appelant ne transmet qu'un IDENTIFIANT. Le contenu du courriel est relu en
 * base : un client qui enverrait un faux message ne pourrait faire expédier que
 * ce qu'il a réellement écrit.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

interface Attachment {
  name?: string;
  path?: string;
  size?: number;
  type?: string;
}

/** Taille lisible : « 2,4 Mo » plutôt que « 2517312 ». */
function taille(octets: number | undefined): string {
  if (octets === undefined) return '';
  if (octets < 1024) return `${String(octets)} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  let requestId: string | undefined;
  try {
    const body = (await request.json()) as { requestId?: string };
    requestId = body.requestId;
  } catch {
    return json({ error: 'Corps de requête invalide.' }, 400);
  }

  if (typeof requestId !== 'string' || requestId === '') {
    return json({ error: 'requestId manquant.' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const { data: demande, error: readError } = await admin
    .from('support_requests')
    .select('id, name, email, phone, message, attachments, user_id, created_at')
    .eq('id', requestId)
    .single();

  if (readError || !demande) {
    return json({ error: 'Demande introuvable.' }, 404);
  }

  const destination = Deno.env.get('SUPPORT_TO_EMAIL') ?? 'contact@rezo360.fr';
  const state = readTransport('INVITATION_FROM_EMAIL');

  if (state.missing.length > 0) {
    // La demande EST enregistrée : ce n'est pas un échec de la requête, c'est
    // une configuration incomplète. On le dit sans perdre le message.
    return json({
      stored: true,
      notified: false,
      reason: `Envoi non configuré : ${state.missing.join(', ')}.`,
    });
  }

  const pieces = Array.isArray(demande.attachments) ? (demande.attachments as Attachment[]) : [];

  // URL signées plutôt que publiques : le dépôt est privé, et une capture
  // d'assistance peut montrer des données client. Sept jours suffisent pour
  // traiter une demande, et le lien s'éteint ensuite de lui-même.
  const liens: string[] = [];
  for (const piece of pieces) {
    if (typeof piece.path !== 'string') continue;
    const { data: signed } = await admin.storage
      .from('support-attachments')
      .createSignedUrl(piece.path, 7 * 24 * 3600);
    if (signed?.signedUrl) {
      liens.push(
        `<li><a href="${signed.signedUrl}">${escapeHtml(piece.name ?? piece.path)}</a>` +
          ` <span style="color:#64748b">${taille(piece.size)}</span></li>`,
      );
    }
  }

  const recu = new Date(demande.created_at as string).toLocaleString('fr-FR');
  const origine = demande.user_id ? 'client connecté' : 'visiteur non connecté';

  const html = `
<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a">
    <table role="presentation" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0">
      <tr><td style="padding:28px 28px 8px">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2563eb">REZO360 — assistance</p>
        <h1 style="margin:12px 0 0;font-size:20px;line-height:1.35">
          ${escapeHtml(demande.name as string)} vous a écrit
        </h1>
      </td></tr>
      <tr><td style="padding:12px 28px 0;font-size:13px;line-height:1.7;color:#334155">
        <p style="margin:0 0 4px"><strong>Adresse</strong> ${escapeHtml(demande.email as string)}</p>
        ${demande.phone ? `<p style="margin:0 0 4px"><strong>Téléphone</strong> ${escapeHtml(demande.phone as string)}</p>` : ''}
        <p style="margin:0 0 4px"><strong>Reçu le</strong> ${escapeHtml(recu)} — ${origine}</p>
      </td></tr>
      <tr><td style="padding:16px 28px 0">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;font-size:14px;line-height:1.65;white-space:pre-wrap">${escapeHtml(demande.message as string)}</div>
      </td></tr>
      ${
        liens.length > 0
          ? `<tr><td style="padding:16px 28px 0;font-size:13px;color:#334155">
               <p style="margin:0 0 6px"><strong>Pièces jointes</strong> <span style="color:#64748b">(liens valables 7 jours)</span></p>
               <ul style="margin:0;padding-left:18px">${liens.join('')}</ul>
             </td></tr>`
          : ''
      }
      <tr><td style="padding:20px 28px 26px;font-size:12px;line-height:1.6;color:#64748b">
        <p style="margin:0">Répondez directement à ce message : il part vers ${escapeHtml(demande.email as string)}.</p>
      </td></tr>
    </table>
  </body>
</html>`;

  const text =
    `${demande.name as string} vous a écrit depuis le centre d'assistance.\n\n` +
    `Adresse : ${demande.email as string}\n` +
    `${demande.phone ? `Téléphone : ${demande.phone as string}\n` : ''}` +
    `Reçu le : ${recu} (${origine})\n\n` +
    `${demande.message as string}\n` +
    `${pieces.length > 0 ? `\n${String(pieces.length)} pièce(s) jointe(s) — voir la version HTML.\n` : ''}`;

  try {
    await sendMessage(
      {
        to: destination,
        subject: `Assistance — ${demande.name as string}`,
        html,
        text,
        // Répondre depuis sa messagerie doit joindre le client, sans recopier
        // son adresse à la main.
        replyTo: demande.email as string,
      },
      state,
    );
  } catch (error) {
    return json({
      stored: true,
      notified: false,
      reason: error instanceof Error ? error.message : 'Envoi impossible.',
    });
  }

  // ---------------------------------------------------------------------------
  // ACCUSÉ DE RÉCEPTION À L'EXPÉDITEUR
  // ---------------------------------------------------------------------------
  //
  // POURQUOI SEULEMENT MAINTENANT, et jamais avant.
  //
  // Cet accusé promet une réponse. Le poster alors que l'équipe n'a rien reçu
  // serait exactement le mensonge que tout ce chantier corrige : un écran qui
  // affichait « envoyé » sans que rien ne parte. Tant que la notification
  // échoue, on ne promet donc rien — la demande reste enregistrée, et l'écran
  // le dit honnêtement.
  //
  // SON ÉCHEC N'ANNULE RIEN. L'important est parti : l'équipe est prévenue et
  // peut répondre. Si la politesse ne trouve pas son destinataire — adresse
  // saisie de travers, boîte pleine — cela ne doit pas transformer une demande
  // traitée en demande perdue.
  //
  // UN MOT SUR L'ABUS : rien ne prouve que l'adresse saisie appartienne à
  // l'expéditeur, et quelqu'un pourrait s'en servir pour faire écrire à un
  // tiers. Le plafond de cinq demandes par heure et par adresse borne le
  // procédé, et le contenu se limite à ce que l'auteur a lui-même tapé.
  const copie = `
<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a">
    <table role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0">
      <tr><td style="padding:28px 28px 8px">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2563eb">REZO360</p>
        <h1 style="margin:12px 0 0;font-size:20px;line-height:1.35">Nous avons bien reçu votre message</h1>
      </td></tr>
      <tr><td style="padding:12px 28px 0;font-size:14px;line-height:1.65;color:#334155">
        <p style="margin:0 0 14px">Bonjour ${escapeHtml((demande.name as string).split(' ')[0] ?? '')},</p>
        <p style="margin:0 0 14px">
          Votre demande est enregistrée. <strong>Une personne la lira</strong> — ce message-ci est
          automatique, la réponse ne le sera pas. Elle vous parviendra à cette adresse.
        </p>
        <p style="margin:0 0 14px">
          Vous n'avez rien d'autre à faire. Si vous pensez à un détail utile entre-temps,
          répondez simplement à ce message : il nous parviendra.
        </p>
      </td></tr>
      <tr><td style="padding:8px 28px 0;font-size:13px;color:#64748b">
        <p style="margin:0 0 6px"><strong>Ce que vous nous avez écrit</strong> — le ${escapeHtml(recu)}</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;font-size:13px;line-height:1.6;color:#334155;white-space:pre-wrap">${escapeHtml(demande.message as string)}</div>
        ${
          pieces.length > 0
            ? `<p style="margin:10px 0 0">${String(pieces.length)} pièce(s) jointe(s) transmise(s) avec votre demande.</p>`
            : ''
        }
      </td></tr>
      <tr><td style="padding:20px 28px 26px;font-size:12px;line-height:1.6;color:#64748b">
        <p style="margin:0">
          Vous nous joignez aussi directement à
          <a href="mailto:${escapeHtml(destination)}" style="color:#2563eb">${escapeHtml(destination)}</a>.
        </p>
      </td></tr>
    </table>
  </body>
</html>`;

  const copieTexte =
    `Bonjour ${(demande.name as string).split(' ')[0] ?? ''},

` +
    `Nous avons bien reçu votre message. Une personne le lira — celui-ci est ` +
    `automatique, la réponse ne le sera pas. Elle vous parviendra à cette adresse.

` +
    `Vous n'avez rien d'autre à faire. Si un détail vous revient, répondez à ce message.

` +
    `--- Ce que vous nous avez écrit, le ${recu} ---
${demande.message as string}
` +
    `${pieces.length > 0 ? `
${String(pieces.length)} piece(s) jointe(s).
` : ''}` +
    `
Vous nous joignez aussi directement à ${destination}.
`;

  let acknowledged = true;

  try {
    await sendMessage(
      {
        to: demande.email as string,
        subject: 'Nous avons bien reçu votre message — REZO360',
        html: copie,
        text: copieTexte,
        // Répondre à l'accusé doit atteindre l'ÉQUIPE, pas la boîte d'envoi.
        replyTo: destination,
      },
      state,
    );
  } catch (error) {
    console.error('Accusé de réception non délivré', error);
    acknowledged = false;
  }

  return json({ stored: true, notified: true, acknowledged });
});

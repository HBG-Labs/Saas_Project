import { createClient } from 'jsr:@supabase/supabase-js@2';

import { escapeHtml, readTransport, sendMessage, type Message } from '../_shared/email.ts';

/**
 * Envoi du courriel d'invitation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UNE EDGE FUNCTION
 *
 * Envoyer un courriel demande un secret — clé d'API ou mot de passe SMTP. Tout
 * secret placé dans le bundle du navigateur est public : n'importe qui pourrait
 * alors émettre des messages en votre nom. Il vit donc ici, côté serveur, et
 * n'en sort pas.
 *
 * CE QUI AUTORISE L'APPEL
 *
 * La fonction n'utilise PAS `service_role`. Elle construit un client Supabase
 * avec le jeton de l'appelant et relit l'invitation sous ses propres droits :
 * la policy `organization_invitations_select` exige `member.invite`. Si la
 * lecture échoue, l'appelant n'avait pas le droit — aucune vérification à
 * réécrire ici, et donc aucune à laisser diverger de la base.
 *
 * L'URL DE L'APPLICATION NE VIENT PAS DU CLIENT
 *
 * `APP_URL` est un secret de déploiement, jamais un paramètre de la requête.
 * Accepter une origine envoyée par le navigateur permettrait de faire partir,
 * depuis votre domaine et avec votre réputation d'expéditeur, un courriel
 * pointant vers un site d'hameçonnage.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX TRANSPORTS, ET POURQUOI
 *
 * Écrire à n'importe quelle adresse — gmail.com, outlook.fr, live.fr — suppose
 * de prouver au réseau qu'on est légitime à envoyer. Il n'existe que deux
 * manières de le faire, et elles couvrent des situations différentes :
 *
 *   SMTP  — on s'authentifie sur une boîte existante, qui répond de nous.
 *           Aucun domaine à posséder, aucun DNS à toucher : c'est le chemin le
 *           plus court vers un envoi qui atteint réellement le destinataire.
 *
 *   Resend — on prouve la propriété d'un domaine par trois enregistrements DNS.
 *           Meilleure délivrabilité, volumes supérieurs, statistiques. Sans
 *           domaine vérifié, Resend refuse tout destinataire autre que le
 *           titulaire du compte : c'est un bac à sable, pas un réglage.
 *
 * Le transport est choisi par la configuration, jamais par le code appelant :
 * `SMTP_HOST` défini l'emporte, sinon `RESEND_API_KEY`. Passer de l'un à l'autre
 * ne demande donc aucun déploiement — seulement de changer les secrets.
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

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  manager: 'Responsable',
  team_leader: "Chef d'équipe",
  technician: 'Technicien',
  employee: 'Employé',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  // Le choix du transport et la lecture de l'expéditeur vivent dans
  // `_shared/email.ts` : deux fonctions écrivent désormais, et deux copies de
  // cette logique auraient divergé au premier correctif.
  const state = readTransport('INVITATION_FROM_EMAIL');
  const appUrl = Deno.env.get('APP_URL');

  if (state.missing.length > 0 || !appUrl) {
    // NOMMER CE QUI MANQUE, et non tout ce qui serait requis.
    //
    // La version précédente énumérait les cinq variables à chaque échec. Avec
    // cinq secrets posés sur six, elle envoyait chercher du mauvais côté :
    // celui qui lit ce message est celui qui peut le corriger, encore
    // faut-il lui dire quoi. Mesuré sur ce déploiement — seul `APP_URL`
    // manquait, et rien ne le disait.
    // `APP_URL` s'ajoute aux manques que le socle détecte : lui seul est propre
    // à l'invitation, qui doit construire un lien cliquable.
    const manquants = [...state.missing];
    if (!appUrl) manquants.push('APP_URL');

    return json(
      {
        error:
          `Envoi non configuré : ${manquants.join(', ')} ` +
          `${manquants.length > 1 ? 'sont absents' : 'est absent'} des secrets de la fonction.`,
      },
      500,
    );
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return json({ error: 'Authentification requise.' }, 401);
  }

  let invitationId: string | undefined;
  try {
    const body = await request.json();
    invitationId = body?.invitationId;
  } catch {
    return json({ error: 'Corps de requête invalide.' }, 400);
  }

  if (typeof invitationId !== 'string' || invitationId === '') {
    return json({ error: 'invitationId manquant.' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  );

  // Lecture sous les droits de l'appelant : c'est la RLS qui autorise ou refuse.
  const { data: invitation, error: readError } = await supabase
    .from('organization_invitations')
    .select('id, email, role, token, expires_at, status, organization:organizations(name)')
    .eq('id', invitationId)
    .single();

  if (readError || !invitation) {
    return json({ error: "Invitation introuvable ou hors de votre portée." }, 403);
  }

  if (invitation.status !== 'pending') {
    return json({ error: "Cette invitation n'est plus en attente." }, 409);
  }

  const organizationName =
    (invitation.organization as { name?: string } | null)?.name ?? 'votre entreprise';
  const roleLabel = ROLE_LABELS[invitation.role] ?? invitation.role;
  const link = `${appUrl.replace(/\/$/, '')}/invitations/${invitation.token}`;
  const expires = new Date(invitation.expires_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const html = `
<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a">
    <table role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0">
      <tr><td style="padding:28px 28px 8px">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2563eb">REZO360</p>
        <h1 style="margin:12px 0 0;font-size:20px;line-height:1.35">
          ${escapeHtml(organizationName)} vous invite à rejoindre son espace de travail
        </h1>
      </td></tr>
      <tr><td style="padding:12px 28px 0;font-size:14px;line-height:1.6;color:#334155">
        <p style="margin:0 0 16px">
          Vous rejoindrez l'équipe avec le rôle <strong>${escapeHtml(roleLabel)}</strong>.
          Vous choisirez vous-même votre mot de passe : ce compte est le vôtre.
        </p>
      </td></tr>
      <tr><td style="padding:20px 28px">
        <a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:8px">
          Rejoindre ${escapeHtml(organizationName)}
        </a>
      </td></tr>
      <tr><td style="padding:0 28px 24px;font-size:12px;line-height:1.6;color:#64748b">
        <p style="margin:0 0 10px">
          Ce lien est nominatif : il ne fonctionne qu'avec l'adresse
          <strong>${escapeHtml(invitation.email)}</strong>, et expire le ${expires}.
        </p>
        <p style="margin:0 0 10px">Si le bouton ne fonctionne pas, copiez cette adresse :</p>
        <p style="margin:0;word-break:break-all;font-family:ui-monospace,monospace;font-size:11px;color:#475569">${link}</p>
        <p style="margin:16px 0 0">
          Vous n'attendiez pas cette invitation ? Ignorez ce message : sans action de votre part, rien ne se passe.
        </p>
      </td></tr>
    </table>
  </body>
</html>`.trim();

  const text = [
    `${organizationName} vous invite à rejoindre son espace de travail REZO360.`,
    ``,
    `Rôle attribué : ${roleLabel}`,
    `Lien d'acceptation : ${link}`,
    ``,
    `Ce lien ne fonctionne qu'avec l'adresse ${invitation.email} et expire le ${expires}.`,
    `Si vous n'attendiez pas cette invitation, ignorez ce message.`,
  ].join('\n');

  const message: Message = {
    to: invitation.email,
    subject: `${organizationName} vous invite sur REZO360`,
    html,
    text,
  };

  try {
    await sendMessage(message, state);
  } catch (thrown) {
    // Le détail du fournisseur part dans les journaux, PAS dans la réponse : il
    // contient l'adresse du serveur, l'identifiant du compte, parfois le motif
    // exact du refus. Consultable par `supabase functions logs send-invitation`.
    console.error(`Envoi ${String(state.transport)} refusé`, thrown);
    return json({ error: "L'envoi du courriel a échoué.", transport: state.transport }, 502);
  }

  return json({ sent: true, email: invitation.email, transport });
});

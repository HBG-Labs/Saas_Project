import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

/**
 * Socle d'envoi de courriel, commun aux fonctions qui écrivent à quelqu'un.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER EXISTE
 *
 * Le transport vivait dans `send-invitation`. Une seconde fonction devant
 * écrire — les demandes d'assistance — il fallait choisir entre le recopier et
 * l'extraire. Recopier aurait produit deux clients SMTP à maintenir, deux
 * choix de transport à garder cohérents, et la certitude qu'un correctif
 * n'atteindrait qu'une des deux copies. Même raisonnement que `_shared/billing.ts`
 * pour Stripe.
 *
 * DEUX TRANSPORTS, ET POURQUOI
 *
 * Écrire à n'importe quelle adresse — gmail.com, outlook.fr, live.fr — suppose
 * de prouver au réseau qu'on est légitime à envoyer. Deux manières, qui
 * couvrent des situations différentes :
 *
 *   SMTP   — on s'authentifie sur une boîte existante, qui répond de nous.
 *            Aucun domaine à posséder, aucun DNS à toucher.
 *
 *   Resend — on prouve la propriété d'un domaine par trois enregistrements DNS.
 *            Meilleure délivrabilité, volumes supérieurs. Sans domaine vérifié,
 *            Resend refuse tout destinataire autre que le titulaire du compte.
 *
 * Le transport est choisi par la CONFIGURATION, jamais par le code appelant :
 * `SMTP_HOST` défini l'emporte, sinon `RESEND_API_KEY`. En changer ne demande
 * aucun déploiement — seulement de changer les secrets.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface Message {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Adresse à laquelle répondre, si elle diffère de l'expéditeur.
   *
   * Indispensable pour l'assistance : le message part de `noreply@`, mais
   * répondre doit joindre le client. Sans cet en-tête, il faut recopier son
   * adresse à la main — le genre de friction qui fait qu'on répond plus tard.
   */
  replyTo?: string;
}

/** Ce que la configuration permet aujourd'hui, ou ce qui lui manque. */
export interface TransportState {
  transport: 'smtp' | 'resend' | null;
  from: string | undefined;
  /** Noms des variables absentes, pour un message qui désigne le manque. */
  missing: string[];
}

/**
 * Lit la configuration d'envoi et NOMME ce qui manque.
 *
 * Énumérer toutes les variables requises à chaque échec envoie chercher du
 * mauvais côté dès que la configuration est presque complète — on relit cinq
 * valeurs correctes sans voir la sixième absente. Constaté sur ce déploiement.
 */
export function readTransport(fromVariable: string): TransportState {
  const smtpHost = Deno.env.get('SMTP_HOST');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get(fromVariable);

  const transport = smtpHost ? 'smtp' : resendKey ? 'resend' : null;
  const missing: string[] = [];

  if (!from) missing.push(fromVariable);
  if (transport === null) {
    missing.push('SMTP_HOST (+ SMTP_USER, SMTP_PASSWORD) ou RESEND_API_KEY');
  }

  return { transport, from, missing };
}

/**
 * Envoi par SMTP, sur une boîte existante.
 *
 * `from` doit correspondre au compte authentifié, ou à l'un de ses alias : la
 * plupart des serveurs refusent d'expédier au nom d'une autre adresse, et ceux
 * qui l'acceptent verront leurs messages rejetés par SPF côté destinataire.
 *
 * Port 465 : TLS d'emblée. Port 587 : connexion en clair puis STARTTLS. C'est le
 * numéro de port qui détermine le mode, pas un réglage séparé — s'y tromper
 * produit une négociation qui échoue sans message clair.
 */
async function sendViaSmtp(message: Message, from: string): Promise<void> {
  const hostname = Deno.env.get('SMTP_HOST') ?? '';
  const port = Number(Deno.env.get('SMTP_PORT') ?? '465');
  const username = Deno.env.get('SMTP_USER') ?? '';
  const password = Deno.env.get('SMTP_PASSWORD') ?? '';

  const client = new SMTPClient({
    connection: { hostname, port, tls: port === 465, auth: { username, password } },
  });

  try {
    await client.send({
      from,
      to: message.to,
      subject: message.subject,
      content: message.text,
      html: message.html,
      ...(message.replyTo === undefined ? {} : { replyTo: message.replyTo }),
    });
  } finally {
    // Fermeture systématique : une connexion laissée ouverte épuise le quota de
    // sessions simultanées du fournisseur, et les envois suivants échouent.
    await client.close();
  }
}

/** Envoi par l'API HTTP de Resend. */
async function sendViaResend(message: Message, from: string, apiKey: string): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo === undefined ? {} : { reply_to: [message.replyTo] }),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend ${response.status} : ${await response.text()}`);
  }
}

/**
 * Délai au-delà duquel on cesse d'attendre le serveur de messagerie.
 *
 * MESURÉ, et non choisi par prudence : un serveur SMTP qui accepte la connexion
 * puis ne répond plus laissait la fonction tourner jusqu'à ce que la plateforme
 * la tue. L'appelant recevait alors un HTTP 503 AU CORPS VIDE — ni motif, ni
 * indication, et l'écran ne pouvait rien dire d'utile.
 *
 * Quinze secondes : largement au-dessus d'un envoi normal, largement en dessous
 * de la limite de la plateforme. Ce qui compte n'est pas la valeur exacte, mais
 * que l'échec soit NOTRE décision, rendue avec un motif, plutôt qu'une
 * exécution interrompue de l'extérieur.
 */
const DELAI_ENVOI_MS = 15_000;

/** Achemine par le transport configuré. Lève si l'envoi échoue ou s'éternise. */
export async function sendMessage(message: Message, state: TransportState): Promise<void> {
  if (state.transport === null || state.from === undefined) {
    throw new Error(`Envoi non configuré : ${state.missing.join(', ')}.`);
  }

  const envoi =
    state.transport === 'smtp'
      ? sendViaSmtp(message, state.from)
      : sendViaResend(message, state.from, Deno.env.get('RESEND_API_KEY') ?? '');

  let minuterie: number | undefined;
  const expiration = new Promise<never>((_, rejeter) => {
    minuterie = setTimeout(() => {
      rejeter(
        new Error(
          `Le serveur de messagerie n'a pas répondu en ${String(DELAI_ENVOI_MS / 1000)} s.`,
        ),
      );
    }, DELAI_ENVOI_MS);
  });

  try {
    await Promise.race([envoi, expiration]);
  } finally {
    if (minuterie !== undefined) clearTimeout(minuterie);
    // L'envoi continue peut-être en arrière-plan ; on ne le laisse pas faire
    // échouer le processus par un rejet non capté.
    void envoi.catch(() => undefined);
  }
}

/** Neutralise le HTML : les valeurs viennent de l'extérieur, pas de nous. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

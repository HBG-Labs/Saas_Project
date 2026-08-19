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
 * Une partie de message encodée en base64.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI PAS L'ENCODAGE PAR DÉFAUT DE LA BIBLIOTHÈQUE
 *
 * `denomailer` encode en quoted-printable, et son encodeur a deux défauts que
 * les destinataires ont vus avant nous :
 *
 *   • `data.replaceAll("=", "=3D")` — le résultat n'est jamais RÉAFFECTÉ. Les
 *     `=` littéraux ne sont donc pas échappés, et notre HTML en est truffé
 *     (`style="…"`, `href="…"`). Le décodeur lit alors des séquences invalides.
 *     C'est de là que vient le `=20` visible en tête des messages reçus.
 *
 *   • le repli de ligne peut placer une coupure douce juste avant un point,
 *     produisant une ligne qui COMMENCE par « . ». En SMTP, un point en début
 *     de ligne doit être doublé ; sans cela le serveur le mange. C'est ainsi
 *     que `aurelie.belli@gmail.com` est arrivé en `gmail` puis `com` recollés
 *     sans leur point.
 *
 * L'alphabet base64 ne contient ni `=` en milieu de flux, ni point : les deux
 * défauts disparaissent par construction, plutôt que d'être contournés. Le
 * repli à 76 caractères suit la RFC 2045.
 *
 * `mimeContent` est la porte prévue par la bibliothèque pour cela : elle écrit
 * l'en-tête `Content-Transfer-Encoding` à partir de ce qu'on lui donne.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function enBase64(mimeType: string, contenu: string) {
  const octets = new TextEncoder().encode(contenu);

  let binaire = '';
  for (const octet of octets) binaire += String.fromCharCode(octet);

  const encode = btoa(binaire);
  const lignes: string[] = [];
  for (let i = 0; i < encode.length; i += 76) lignes.push(encode.slice(i, i + 76));

  return { mimeType, content: lignes.join('\r\n'), transferEncoding: 'base64' };
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
      // `mimeContent` PLUTÔT QUE `content` et `html` — voir `enBase64`.
      mimeContent: [
        enBase64('text/plain; charset="utf-8"', message.text),
        enBase64('text/html; charset="utf-8"', message.html),
      ],
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

/**
 * Fuseau dans lequel les dates des courriels sont écrites.
 *
 * Une fonction Edge tourne en UTC. Sans ce réglage, un message reçu à 00 h 33
 * en Martinique était horodaté « 04:33 » — quatre heures d'écart, sur la seule
 * information dont le lecteur se sert pour savoir si la demande est fraîche.
 *
 * Réglable par le secret `SUPPORT_TIMEZONE` : la valeur par défaut vaut pour
 * l'équipe d'aujourd'hui, elle ne doit pas devenir une hypothèse figée.
 */
export function fuseau(): string {
  return Deno.env.get('SUPPORT_TIMEZONE') ?? 'America/Martinique';
}

/** Date et heure lisibles, dans le fuseau de l'équipe. */
export function horodatage(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: fuseau(),
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/**
 * Date seule, dans le fuseau de l'équipe.
 *
 * `dateStyle` plutôt que `day`/`month`/`year` : la seconde forme, combinée à un
 * `timeZone`, faisait LEVER la fonction Edge — HTTP 500 sans corps, la
 * bibliothèque ICU réduite du runtime ne servant pas toutes les combinaisons.
 * `horodatage` employait déjà `dateStyle` et fonctionnait ; on s'aligne sur ce
 * qui est prouvé plutôt que sur ce qui devrait marcher.
 */
export function dateLisible(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    timeZone: fuseau(),
    dateStyle: 'long',
  });
}

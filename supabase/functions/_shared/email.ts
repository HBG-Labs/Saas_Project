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
  /**
   * En-têtes supplémentaires : `In-Reply-To`, `References`, `Message-ID`.
   *
   * C'est ce qui fait qu'une réponse retrouve son fil. Sans `References`, les
   * clients mail ouvrent chaque échange comme un message isolé, et le webhook
   * entrant n'a plus que l'adresse de réponse pour rattacher — un seul indice
   * là où il en faut deux.
   */
  headers?: Record<string, string>;
  /** Pièces jointes, contenu en base64. Transport Resend uniquement. */
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  /** Contenu encodé en base64. */
  content: string;
  contentType?: string;
}

/** Ce que l'envoi a produit, et qu'il faut conserver pour le suivi. */
export interface SendResult {
  transport: 'smtp' | 'resend';
  /** Identifiant du fournisseur — `id` de Resend. Absent en SMTP. */
  providerId: string | null;
}

/** Ce que la configuration permet aujourd'hui, ou ce qui lui manque. */
export interface TransportState {
  transport: 'smtp' | 'resend' | null;
  from: string | undefined;
  /** Noms des variables absentes, pour un message qui désigne le manque. */
  missing: string[];
  /**
   * Clé Resend, lue une fois ici plutôt qu'au moment d'envoyer : l'envoi ne
   * touche plus à l'environnement, ce qui le rend testable sans permission —
   * exactement comme la CI exécute les tests Deno.
   */
  resendApiKey?: string;
}

export interface TransportInputs {
  smtpHost: string | undefined;
  resendKey: string | undefined;
  from: string | undefined;
  fromVariable: string;
  require?: 'resend';
}

/**
 * Le choix du transport, sans lecture d'environnement : c'est ce que les
 * tests éprouvent. `readTransport` ne fait que lui fournir les valeurs.
 */
export function resolveTransport(inputs: TransportInputs): TransportState {
  const { smtpHost, resendKey, from, fromVariable } = inputs;
  const transport: TransportState['transport'] =
    inputs.require === 'resend'
      ? resendKey
        ? 'resend'
        : null
      : smtpHost
        ? 'smtp'
        : resendKey
          ? 'resend'
          : null;
  const missing: string[] = [];

  if (!from) missing.push(fromVariable);
  if (transport === null) {
    missing.push(
      inputs.require === 'resend'
        ? 'RESEND_API_KEY'
        : 'SMTP_HOST (+ SMTP_USER, SMTP_PASSWORD) ou RESEND_API_KEY',
    );
  }

  return {
    transport,
    from,
    missing,
    ...(transport === 'resend' && resendKey ? { resendApiKey: resendKey } : {}),
  };
}

/**
 * Lit la configuration d'envoi et NOMME ce qui manque.
 *
 * Énumérer toutes les variables requises à chaque échec envoie chercher du
 * mauvais côté dès que la configuration est presque complète — on relit cinq
 * valeurs correctes sans voir la sixième absente. Constaté sur ce déploiement.
 */
export function readTransport(
  fromVariable: string,
  options: {
    /**
     * Impose Resend, même si `SMTP_HOST` est défini.
     *
     * La règle « SMTP l'emporte » reste la bonne pour les courriels ordinaires.
     * Elle ne l'est plus pour la messagerie du portail client : les réponses
     * n'y reviennent que par Resend Inbound, et un message parti par SMTP
     * n'aurait ni identifiant fournisseur, ni suivi de distribution. Le
     * portail exige donc Resend — et se déclare non configuré s'il manque,
     * plutôt que de partir en silence par le mauvais canal.
     */
    require?: 'resend';
  } = {},
): TransportState {
  return resolveTransport({
    smtpHost: Deno.env.get('SMTP_HOST'),
    resendKey: Deno.env.get('RESEND_API_KEY'),
    from: Deno.env.get(fromVariable),
    fromVariable,
    ...(options.require === undefined ? {} : { require: options.require }),
  });
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
async function sendViaSmtp(message: Message, from: string): Promise<SendResult> {
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
      // Les en-têtes de fil et les pièces jointes ne sont pas portés par ce
      // transport : ils n'ont de sens que pour la messagerie, qui exige Resend.
    });
  } finally {
    // Fermeture systématique : une connexion laissée ouverte épuise le quota de
    // sessions simultanées du fournisseur, et les envois suivants échouent.
    await client.close();
  }
  return { transport: 'smtp', providerId: null };
}

/** Charge utile telle que l'API de Resend l'attend. Exportée pour les tests. */
export function buildResendPayload(message: Message, from: string): Record<string, unknown> {
  return {
    from,
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
    ...(message.replyTo === undefined ? {} : { reply_to: [message.replyTo] }),
    ...(message.headers === undefined || Object.keys(message.headers).length === 0
      ? {}
      : { headers: message.headers }),
    ...(message.attachments === undefined || message.attachments.length === 0
      ? {}
      : {
          attachments: message.attachments.map((piece) => ({
            filename: piece.filename,
            content: piece.content,
            ...(piece.contentType === undefined ? {} : { content_type: piece.contentType }),
          })),
        }),
  };
}

/** Envoi par l'API HTTP de Resend. Renvoie l'identifiant attribué. */
async function sendViaResend(
  message: Message,
  from: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildResendPayload(message, from)),
  });

  if (!response.ok) {
    throw new Error(`Resend ${response.status} : ${await response.text()}`);
  }

  // `id` est ce qui relie ensuite les webhooks de distribution au message.
  // Une réponse 200 sans identifiant serait une anomalie du fournisseur, pas
  // une raison de faire échouer un envoi qui a eu lieu.
  const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
  const providerId = typeof body?.id === 'string' && body.id !== '' ? body.id : null;
  return { transport: 'resend', providerId };
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
export async function sendMessage(
  message: Message,
  state: TransportState,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  if (state.transport === null || state.from === undefined) {
    throw new Error(`Envoi non configuré : ${state.missing.join(', ')}.`);
  }

  const envoi =
    state.transport === 'smtp'
      ? sendViaSmtp(message, state.from)
      : sendViaResend(message, state.from, state.resendApiKey ?? '', fetchImpl);

  let minuterie: ReturnType<typeof setTimeout> | undefined;
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
    return await Promise.race([envoi, expiration]);
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

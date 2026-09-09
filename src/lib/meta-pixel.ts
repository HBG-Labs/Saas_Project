import { env } from '@/config/env';
import { hasMarketingConsent, subscribeCookieConsent } from '@/lib/cookie-consent';

/**
 * Pixel Meta — chargement conditionné au consentement, et déclenchement unique.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE MODULE EST INERTE PAR DÉFAUT
 *
 * Il ne fait RIEN tant que deux conditions ne sont pas réunies :
 *   1. `VITE_META_PIXEL_ID` est renseignée ;
 *   2. le visiteur a accepté les cookies « marketing ».
 *
 * L'ordre compte. Sans identifiant, aucun script n'est même envisagé — c'est ce
 * qui rend le développement, les tests et les prévisualisations silencieux sans
 * réglage particulier. Sans consentement, l'identifiant ne suffit pas : le
 * script n'est pas injecté du tout, et pas seulement « mis en sourdine ».
 *
 * C'est la seule lecture défendable de la position de la CNIL sur les traceurs
 * publicitaires. Charger `fbevents.js` puis s'abstenir de l'appeler dépose déjà
 * des cookies tiers : le dépôt a lieu au chargement, pas à l'événement.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI `PageView` N'EST PAS DÉCLENCHÉ ICI
 *
 * L'extrait officiel de Meta se termine par deux lignes :
 *
 *     fbq('init', '<ID>');
 *     fbq('track', 'PageView');     ← ABSENTE ICI, VOLONTAIREMENT
 *
 * REZO360 est une application à navigation côté client. Cette seconde ligne ne
 * se déclencherait qu'une fois, au tout premier chargement : toutes les
 * navigations suivantes — dont `/` → `/register`, c'est-à-dire exactement le
 * parcours acheté en publicité — seraient invisibles.
 *
 * Le réflexe suivant est d'ajouter un `PageView` sur changement de route. Mais
 * si la ligne ci-dessus reste en place, la PREMIÈRE page en compte alors deux :
 * une pour l'init, une pour la route initiale. On gonfle la mesure d'un
 * doublon, à l'endroit le plus visible du tunnel.
 *
 * D'où le choix : `init` ne déclenche rien, et `useMetaPixel` est l'UNIQUE
 * source de `PageView`, première page comprise. Une seule source, jamais deux.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Signature minimale de `fbq`, telle que l'extrait officiel la définit. */
type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded?: boolean;
  version?: string;
  push?: unknown;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

/** Marque le `<script>` injecté, pour ne jamais en poser un second. */
const SCRIPT_ATTRIBUTE = 'data-rezo360-meta-pixel';

let initialise = false;

/** L'identifiant, une fois pour toutes. `undefined` rend tout le module inerte. */
function identifiantPixel(): string | undefined {
  return env.VITE_META_PIXEL_ID;
}

/**
 * Pose la fonction `fbq` et injecte le script.
 *
 * L'amorce reproduit l'extrait officiel de Meta, à la ligne `PageView` près
 * (voir l'en-tête). Sa partie essentielle est la FILE D'ATTENTE : `fbq` existe
 * et accepte des appels avant même que `fbevents.js` soit arrivé, qui les
 * rejoue ensuite. Sans elle, tout événement déclenché pendant le téléchargement
 * du script — le `PageView` de la page d'arrivée, typiquement — serait perdu.
 */
function chargerScript(id: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.fbq !== undefined) return;

  const fbq: Fbq = Object.assign(
    function (...args: unknown[]) {
      /*
        L'extrait officiel écrit ici `n.callMethod.apply(n, arguments)`. La
        forme est équivalente à celle-ci — `callMethod` étant appelée comme
        méthode de `fbq`, son `this` reste `fbq` — et satisfait `prefer-spread`.
      */
      if (fbq.callMethod) {
        fbq.callMethod(...args);
      } else {
        fbq.queue.push(args);
      }
    } as Fbq,
    { queue: [] as unknown[], loaded: true, version: '2.0' },
  );
  fbq.push = fbq;

  window.fbq = fbq;
  window._fbq ??= fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = SCRIPT_SRC;
  script.setAttribute(SCRIPT_ATTRIBUTE, id);
  document.head.appendChild(script);

  fbq('init', id);
}

/**
 * Envoie un événement, si et seulement si tout est réuni.
 *
 * Le consentement est relu À CHAQUE APPEL, et non mémorisé au chargement : un
 * visiteur peut retirer son accord depuis le pied de page ou la page /cookies
 * en cours de session. Le script déjà injecté ne peut pas être retiré du
 * document, mais on cesse immédiatement de lui envoyer quoi que ce soit.
 */
function envoyer(type: 'track' | 'trackCustom', evenement: string, parametres?: object) {
  const id = identifiantPixel();
  if (id === undefined) return;
  if (!hasMarketingConsent()) return;

  if (!initialise) {
    chargerScript(id);
    initialise = true;
  }

  if (parametres === undefined) {
    window.fbq?.(type, evenement);
  } else {
    window.fbq?.(type, evenement, parametres);
  }
}

/**
 * Prépare le pixel au démarrage de l'application.
 *
 * Ne charge rien tant que le consentement n'est pas donné — mais s'abonne aux
 * changements, pour que le script parte dès l'acceptation sans attendre la
 * navigation suivante. Un visiteur qui accepte la bannière puis clique
 * directement sur « Commencer gratuitement » est ainsi mesuré.
 *
 * Renvoie la fonction de désabonnement.
 */
export function initMetaPixel(): () => void {
  const id = identifiantPixel();
  if (id === undefined) return () => {};

  const appliquer = () => {
    if (!initialise && hasMarketingConsent()) {
      chargerScript(id);
      initialise = true;
    }
  };

  appliquer();
  return subscribeCookieConsent(appliquer);
}

/**
 * Le pixel est-il en mesure d'envoyer quelque chose, à cet instant ?
 *
 * `useMetaPixel` s'en sert pour rattraper le consentement tardif : tant que
 * cette fonction répond `false`, les événements sont ABANDONNÉS, pas mis en
 * attente — `envoyer` s'arrête avant d'atteindre la file de `fbq`. Sans ce
 * rattrapage, le visiteur qui accepte la bannière après son arrivée ne serait
 * jamais compté sur la page où il l'a acceptée, c'est-à-dire la page d'entrée
 * de la publicité.
 */
export function metaPixelEstActif(): boolean {
  return identifiantPixel() !== undefined && hasMarketingConsent();
}

/** Une page vue. Voir `useMetaPixel` : c'est sa seule source. */
export function trackPageView() {
  envoyer('track', 'PageView');
}

/**
 * Un compte vient d'être créé.
 *
 * `Lead` plutôt que `CompleteRegistration` : à cet instant le compte existe,
 * mais l'adresse n'est pas encore confirmée et aucune organisation n'a été
 * créée. La personne n'utilise donc pas encore le produit. Réserver
 * `CompleteRegistration` à l'entrée réelle dans l'application laisse les deux
 * événements dire deux choses distinctes, au lieu de compter deux fois la même.
 */
export function trackInscription() {
  envoyer('track', 'Lead');
}

/**
 * Fenêtre au-delà de laquelle un compte n'est plus considéré comme neuf.
 *
 * Généreuse à dessein : elle doit couvrir l'aller-retour complet vers Google,
 * la création du compte côté Supabase et le retour sur cette page, sur un
 * téléphone en 4G médiocre. Trop courte, elle raterait des inscriptions ; trop
 * longue, elle compterait comme inscription la reconnexion d'un compte créé
 * quelques minutes plus tôt.
 */
const FENETRE_COMPTE_NEUF_MS = 120_000;

/** Comptes déjà signalés, pour ne jamais déclarer deux fois la même inscription. */
const inscriptionsDeclarees = new Set<string>();

/**
 * Déclare une inscription arrivée par Google — et seulement si c'en est une.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE N'EST PAS UN SIMPLE APPEL DANS LA PAGE DE RETOUR
 *
 * L'écran de retour OAuth est le MÊME pour une inscription et pour une
 * reconnexion : dans les deux cas, Google renvoie une session valide et rien
 * dans l'URL ne les distingue. Y déclencher `Lead` sans discernement
 * compterait une inscription à chaque connexion — le compteur dériverait
 * d'autant plus vite que le produit marche.
 *
 * La date de création du compte, elle, tranche sans ambiguïté : elle ne change
 * jamais après coup. Un compte créé il y a quelques secondes vient forcément
 * de l'être à l'instant.
 *
 * Le repère par identifiant s'ajoute par-dessus, parce que cette fonction est
 * appelée depuis un effet : sous `StrictMode`, l'effet s'exécute deux fois, et
 * la seule fraîcheur de la date ne suffirait pas à s'en prémunir.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function trackInscriptionSiCompteNeuf(
  utilisateur: { id: string; created_at?: string } | null,
) {
  if (utilisateur === null) return;
  if (utilisateur.created_at === undefined) return;
  if (inscriptionsDeclarees.has(utilisateur.id)) return;

  const creeLe = Date.parse(utilisateur.created_at);
  if (Number.isNaN(creeLe)) return;
  if (Date.now() - creeLe > FENETRE_COMPTE_NEUF_MS) return;

  inscriptionsDeclarees.add(utilisateur.id);
  trackInscription();
}

/** Réinitialisation entre deux tests. Sans usage en production. */
export function __resetMetaPixelPourTests() {
  initialise = false;
  inscriptionsDeclarees.clear();
  delete window.fbq;
  delete window._fbq;
  document.querySelectorAll(`script[${SCRIPT_ATTRIBUTE}]`).forEach((n) => n.remove());
}

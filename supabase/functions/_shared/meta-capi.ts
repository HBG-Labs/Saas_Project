/**
 * API Conversions de Meta — les conversions que le navigateur ne peut pas voir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CÔTÉ SERVEUR, ET PAS DANS LA PAGE
 *
 * Le pixel du navigateur (`src/lib/meta-pixel.ts`) mesure ce qui se passe sous
 * les yeux du visiteur : la page vue, l'inscription. Il ne peut pas mesurer
 * l'abonnement, pour une raison simple : l'abonnement n'est PAS confirmé dans
 * le navigateur.
 *
 * Stripe confirme un paiement par webhook. Le retour du client sur la page de
 * succès est un effet de bord — il peut fermer l'onglet, perdre le réseau, ou
 * régler par un moyen de paiement qui aboutit plusieurs jours plus tard. Un
 * `Purchase` déclenché sur la page de retour manquerait tout cela, et
 * compterait à l'inverse un retour sans paiement effectif.
 *
 * Le webhook, lui, ne se trompe pas : il EST la source de vérité de la
 * facturation. C'est donc de là que partent `StartTrial` et `Purchase`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE MODULE NE DOIT JAMAIS FAIRE ÉCHOUER SON APPELANT
 *
 * Il est appelé depuis `stripe-webhook`, dont l'échec fait rejouer Stripe et,
 * au pire, laisse un abonnement payé sans droits accordés — le défaut le plus
 * coûteux du système, déjà vécu une fois sur ce projet.
 *
 * Une statistique publicitaire ne vaut pas ce risque. Toutes les erreurs sont
 * donc absorbées ici : réseau coupé, jeton expiré, Meta indisponible, réponse
 * illisible. La fonction journalise et rend la main. Elle ne lève jamais.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Version figée : une montée de version de l'API Graph doit être un choix. */
const VERSION_API = 'v21.0';

export type EvenementConversion = 'StartTrial' | 'Purchase';

export interface DonneesConversion {
  evenement: EvenementConversion;
  /** Identifiant d'abonnement Stripe — sert à rendre l'événement déduplicable. */
  referenceStripe: string;
  /** Montant en centimes, tel que Stripe le manipule. */
  montantCents?: number | null;
  devise?: string | null;
  /** Adresse e-mail EN CLAIR : elle est hachée ici, jamais transmise telle quelle. */
  email?: string | null;
  /** Cookies d'attribution capturés dans le navigateur au moment du paiement. */
  fbp?: string | null;
  fbc?: string | null;
  /** Adresse d'où la conversion est partie, pour la cohérence du rapport Meta. */
  urlSource?: string | null;
}

function secret(nom: string): string {
  return Deno.env.get(nom)?.trim() ?? '';
}

/**
 * Quelle conversion déclarer, si tant est qu'il y en ait une.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UNE TRANSITION, PAS UN ÉTAT
 *
 * `applySubscription` s'exécute à CHAQUE événement d'abonnement : création,
 * renouvellement mensuel, changement de carte, résiliation programmée, échec
 * puis reprise de paiement. Déclarer une conversion sur la seule foi du statut
 * courant enverrait le même abonnement des dizaines de fois à Meta.
 *
 * Ce qui distingue une conversion d'une mise à jour ordinaire, c'est le
 * changement d'état. D'où cette fonction, qui compare l'avant et l'après.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE CAS QUI FAIT DÉRIVER LES COMPTEURS
 *
 * Un abonnement qui passe `active` → `past_due` → `active` franchit DEUX fois
 * la frontière de `active`. Compter les deux ferait apparaître deux ventes pour
 * un seul client — et l'erreur grandirait avec le nombre d'incidents de
 * paiement, c'est-à-dire avec la taille du portefeuille.
 *
 * Seul le passage depuis un état NON PAYANT compte donc : essai, abonnement
 * incomplet, ou aucun abonnement antérieur. Un retour de `past_due` est un
 * impayé régularisé, pas une nouvelle vente.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function conversionADeclarer(
  statutAvant: string | null,
  statutApres: string,
): EvenementConversion | null {
  if (statutApres === 'trialing' && statutAvant !== 'trialing') return 'StartTrial';

  if (statutApres === 'active' && (statutAvant === null || ETATS_NON_PAYANTS.has(statutAvant))) {
    return 'Purchase';
  }

  return null;
}

/** États depuis lesquels un passage à `active` constitue une vente nouvelle. */
const ETATS_NON_PAYANTS = new Set(['trialing', 'incomplete']);

/**
 * Filtre un identifiant d'attribution avant tout usage.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CES VALEURS VIENNENT DU NAVIGATEUR, DONC DE L'EXTÉRIEUR
 *
 * Elles sont lues dans `document.cookie` puis postées à
 * `create-checkout-session` : rien n'empêche un client de poster autre chose
 * que ce que le pixel y avait écrit. Elles finissent dans les métadonnées d'un
 * abonnement Stripe, puis dans un appel sortant vers Meta — deux endroits où
 * l'on ne veut pas d'une charge utile arbitraire.
 *
 * Le format réel est étroit : `fb.1.1700000000000.AbCd...`, soit des chiffres,
 * des lettres, des points, des tirets et des soulignés. On s'y tient, et on
 * plafonne la longueur bien en deçà des 500 caractères qu'accepte une valeur de
 * métadonnée Stripe.
 *
 * Une valeur non conforme est ÉCARTÉE, pas corrigée : la conversion partira
 * alors avec le seul e-mail haché pour appariement. Perdre un signal de mesure
 * est sans gravité ; transmettre une donnée non maîtrisée ne l'est pas.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function assainirIdentifiantMeta(valeur: unknown): string | null {
  if (typeof valeur !== 'string') return null;
  const propre = valeur.trim();
  if (propre === '' || propre.length > 255) return null;
  return /^[A-Za-z0-9._-]+$/.test(propre) ? propre : null;
}

/** SHA-256 en hexadécimal — le format exigé par Meta pour les données d'appariement. */
async function sha256Hex(valeur: string): Promise<string> {
  const octets = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valeur));
  return Array.from(new Uint8Array(octets))
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Envoie une conversion à Meta. Ne lève jamais — voir l'en-tête.
 *
 * Inerte tant que `META_PIXEL_ID` et `META_CAPI_ACCESS_TOKEN` ne sont pas tous
 * deux configurés, sur le même principe que le pixel du navigateur : rien ne
 * part depuis un environnement qui n'a pas été explicitement équipé.
 */
export async function envoyerConversionMeta(donnees: DonneesConversion): Promise<void> {
  const pixelId = secret('META_PIXEL_ID');
  const jeton = secret('META_CAPI_ACCESS_TOKEN');

  if (pixelId === '' || jeton === '') return;

  try {
    /*
      APPARIEMENT : sans lui, Meta reçoit une conversion qu'il ne peut rattacher
      à personne, et donc à aucune publicité.

      `fbp` et `fbc` sont les plus fiables — ce sont les cookies posés par le
      pixel dans le navigateur, `fbc` portant l'identifiant du clic publicitaire
      lui-même. Ils voyagent jusqu'ici par les métadonnées de l'abonnement
      Stripe, faute de quoi ils seraient perdus à la redirection vers la page
      de paiement hébergée.

      L'e-mail haché est le filet : il permet l'appariement quand les cookies
      manquent (navigateur restrictif, refus du consentement côté cookies mais
      compte créé). Meta exige un SHA-256 de l'adresse normalisée ; l'adresse
      en clair ne quitte jamais ce serveur.
    */
    const userData: Record<string, unknown> = {};

    if (donnees.email !== null && donnees.email !== undefined && donnees.email !== '') {
      userData.em = [await sha256Hex(donnees.email.trim().toLowerCase())];
    }
    if (donnees.fbp !== null && donnees.fbp !== undefined && donnees.fbp !== '') {
      // Jamais haché : Meta attend ces deux valeurs telles quelles.
      userData.fbp = donnees.fbp;
    }
    if (donnees.fbc !== null && donnees.fbc !== undefined && donnees.fbc !== '') {
      userData.fbc = donnees.fbc;
    }

    if (Object.keys(userData).length === 0) {
      // Aucun signal d'appariement : l'envoi serait comptabilisé sans pouvoir
      // être attribué. On préfère ne rien envoyer plutôt que gonfler un total
      // que personne ne pourra rapprocher d'une campagne.
      console.warn(
        `[meta-capi] ${donnees.evenement} ignoré pour ${donnees.referenceStripe} : ` +
          `aucune donnée d'appariement (ni cookie d'attribution, ni e-mail).`,
      );
      return;
    }

    const evenement: Record<string, unknown> = {
      event_name: donnees.evenement,
      event_time: Math.floor(Date.now() / 1000),
      /*
        IDENTIFIANT DÉTERMINISTE.

        Meta déduplique sur `event_id`. Le construire à partir de l'abonnement
        et du type d'événement garantit qu'un même passage compte une seule
        fois, même si notre garde de transition venait à céder ou si un rejeu
        Stripe traversait tout. C'est une seconde barrière, indépendante de la
        première — et c'est aussi ce qui permettra, si un événement navigateur
        équivalent est ajouté un jour, de ne pas compter deux fois le même acte.
      */
      event_id: `${donnees.evenement.toLowerCase()}_${donnees.referenceStripe}`,
      // La conversion naît d'un paiement web, même si l'appel part du serveur.
      action_source: 'website',
      user_data: userData,
    };

    if (donnees.urlSource !== null && donnees.urlSource !== undefined) {
      evenement.event_source_url = donnees.urlSource;
    }

    if (donnees.montantCents !== null && donnees.montantCents !== undefined) {
      evenement.custom_data = {
        value: donnees.montantCents / 100,
        currency: (donnees.devise ?? 'EUR').toUpperCase(),
      };
    }

    const corps: Record<string, unknown> = { data: [evenement] };

    /*
      Facultatif, et précieux : renseigné, il dirige les événements vers l'outil
      « Événements de test » du gestionnaire Meta, où l'on voit arriver chaque
      envoi en temps réel. C'est le seul moyen de vérifier l'intégration sans
      polluer les statistiques réelles — et sans attendre un vrai abonnement.
    */
    const codeTest = secret('META_CAPI_TEST_EVENT_CODE');
    if (codeTest !== '') corps.test_event_code = codeTest;

    const reponse = await fetch(
      `https://graph.facebook.com/${VERSION_API}/${pixelId}/events?access_token=${encodeURIComponent(jeton)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      },
    );

    if (!reponse.ok) {
      /*
        On journalise le CORPS de la réponse, pas seulement le code.

        Meta répond 400 avec un message précis — jeton expiré, pixel inconnu,
        champ mal formé. Sans ce corps, un `400` isolé ne permet pas de savoir
        laquelle des trois causes s'applique, et l'intégration reste muette
        sans qu'on sache pourquoi.

        Le jeton n'apparaît pas dans ce journal : il est passé en paramètre
        d'URL, qui n'est pas repris ici.
      */
      const detail = await reponse.text().catch(() => '');
      console.error(
        `[meta-capi] ${donnees.evenement} refusé (${String(reponse.status)}) pour ` +
          `${donnees.referenceStripe} : ${detail.slice(0, 500)}`,
      );
      return;
    }

    console.log(`[meta-capi] ${donnees.evenement} envoyé pour ${donnees.referenceStripe}.`);
  } catch (erreur) {
    // Absorbé volontairement. Voir l'en-tête : la facturation prime.
    console.error(
      `[meta-capi] ${donnees.evenement} non envoyé pour ${donnees.referenceStripe} :`,
      erreur instanceof Error ? erreur.message : String(erreur),
    );
  }
}

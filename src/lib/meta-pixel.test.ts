import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { acceptAllCookies, refuseAllCookies, setCookiePreferences } from '@/lib/cookie-consent';

/*
  L'identifiant vient de `import.meta.env`, figé à la compilation. On le rend
  pilotable pour pouvoir éprouver les deux états qui comptent : configuré et
  absent — ce dernier étant celui de tous les environnements de test et de
  développement.
*/
const faux = vi.hoisted(() => ({ pixelId: undefined as string | undefined }));

vi.mock('@/config/env', () => ({
  env: {
    get VITE_META_PIXEL_ID() {
      return faux.pixelId;
    },
  },
}));

const {
  __resetMetaPixelPourTests,
  initMetaPixel,
  metaPixelEstActif,
  trackInscription,
  trackInscriptionSiCompteNeuf,
  trackPageView,
} = await import('@/lib/meta-pixel');

const ID = '123456789012345';

/** Les scripts injectés portent un attribut dédié — on les compte par lui. */
function scriptsInjectes() {
  return document.querySelectorAll('script[data-rezo360-meta-pixel]');
}

/**
 * `fbevents.js` ne se charge jamais sous jsdom : `fbq.callMethod` reste donc
 * indéfini et TOUT appel s'empile dans `fbq.queue`. Cette file est par
 * conséquent la liste exacte de ce que le pixel aurait envoyé.
 */
function evenementsEnvoyes(): unknown[][] {
  const fbq = (window as { fbq?: { queue: unknown[] } }).fbq;
  return (fbq?.queue ?? []) as unknown[][];
}

function evenementsDeType(type: string): unknown[][] {
  return evenementsEnvoyes().filter((appel) => appel[0] === 'track' && appel[1] === type);
}

beforeEach(() => {
  localStorage.clear();
  __resetMetaPixelPourTests();
  faux.pixelId = undefined;
});

afterEach(() => {
  __resetMetaPixelPourTests();
  localStorage.clear();
});

describe('pixel Meta — inerte tant que tout n’est pas réuni', () => {
  it('ne charge rien sans identifiant, même avec le consentement', () => {
    /*
      C'est l'état de tous les postes de développement et de toute la suite de
      tests. Sans cette garantie, chaque exécution de `npm run test` enverrait
      des inscriptions fictives dans les statistiques publicitaires réelles.
    */
    acceptAllCookies();
    initMetaPixel();
    trackPageView();
    trackInscription();

    expect(scriptsInjectes()).toHaveLength(0);
    expect(window.fbq).toBeUndefined();
    expect(metaPixelEstActif()).toBe(false);
  });

  it('ne charge rien avec un identifiant mais sans consentement', () => {
    /*
      LA GARANTIE JURIDIQUE DU MODULE.

      Charger `fbevents.js` puis s'abstenir de l'appeler ne suffirait pas : le
      script dépose ses cookies dès son exécution, avant tout événement. Le
      seul comportement conforme est de ne pas l'injecter du tout.
    */
    faux.pixelId = ID;
    initMetaPixel();
    trackPageView();

    expect(scriptsInjectes()).toHaveLength(0);
    expect(window.fbq).toBeUndefined();
    expect(metaPixelEstActif()).toBe(false);
  });

  it('ne charge rien quand seule la mesure d’audience est acceptée', () => {
    // Le pixel est un traceur publicitaire : il relève de « marketing », pas
    // d'« analytics ». Confondre les deux trahirait un choix explicite.
    faux.pixelId = ID;
    setCookiePreferences({ analytics: true, marketing: false });
    initMetaPixel();
    trackPageView();

    expect(scriptsInjectes()).toHaveLength(0);
    expect(metaPixelEstActif()).toBe(false);
  });

  it('reste fermé quand le consentement stocké est illisible', () => {
    faux.pixelId = ID;
    localStorage.setItem('rezo360_cookie_consent', '{ ceci n’est pas du JSON');
    initMetaPixel();
    trackPageView();

    expect(scriptsInjectes()).toHaveLength(0);
  });
});

describe('pixel Meta — chargement après consentement', () => {
  beforeEach(() => {
    faux.pixelId = ID;
  });

  it('injecte le script une seule fois, quel que soit le nombre d’appels', () => {
    acceptAllCookies();
    initMetaPixel();
    initMetaPixel();
    trackPageView();
    trackPageView();

    expect(scriptsInjectes()).toHaveLength(1);
  });

  it('n’envoie AUCUN PageView à l’initialisation', () => {
    /*
      LE DÉFAUT QUE CE TEST EXISTE POUR EMPÊCHER.

      L'extrait officiel de Meta se termine par `fbq('track', 'PageView')`.
      Le conserver dans une application à navigation côté client ferait compter
      DEUX vues sur la première page : celle de l'init, puis celle envoyée par
      `useMetaPixel` pour la route initiale.

      Le doublon tomberait sur la page d'entrée des publicités — précisément
      celle dont le chiffre sert à juger la campagne. Rien ne le signalerait :
      le nombre resterait plausible, simplement faux.
    */
    acceptAllCookies();
    initMetaPixel();

    expect(evenementsEnvoyes()).toContainEqual(['init', ID]);
    expect(evenementsDeType('PageView')).toHaveLength(0);
  });

  it('part dès l’acceptation, sans attendre la navigation suivante', () => {
    /*
      Le visiteur arrive de la publicité, puis accepte la bannière. Si le
      chargement attendait un changement de route, la page d'arrivée ne serait
      jamais comptée — or c'est celle qui a été payée.
    */
    initMetaPixel();
    expect(scriptsInjectes()).toHaveLength(0);

    acceptAllCookies();

    expect(scriptsInjectes()).toHaveLength(1);
    expect(metaPixelEstActif()).toBe(true);
  });

  it('cesse d’envoyer quand le consentement est retiré en cours de session', () => {
    acceptAllCookies();
    initMetaPixel();
    trackPageView();
    const avant = evenementsDeType('PageView').length;

    refuseAllCookies();
    trackPageView();
    trackInscription();

    // Le script déjà injecté ne peut pas être retiré du document, mais plus
    // rien ne lui est transmis.
    expect(evenementsDeType('PageView')).toHaveLength(avant);
    expect(evenementsDeType('Lead')).toHaveLength(0);
    expect(metaPixelEstActif()).toBe(false);
  });
});

describe('inscription par Google — distinguer un compte neuf d’une reconnexion', () => {
  beforeEach(() => {
    faux.pixelId = ID;
    acceptAllCookies();
    initMetaPixel();
  });

  it('déclare un compte créé à l’instant', () => {
    trackInscriptionSiCompteNeuf({ id: 'u1', created_at: new Date().toISOString() });
    expect(evenementsDeType('Lead')).toHaveLength(1);
  });

  it('ne déclare rien pour une reconnexion sur un compte ancien', () => {
    /*
      L'écran de retour OAuth est le même pour l'inscription et la reconnexion.
      Sans ce filtre, chaque connexion Google compterait une inscription — et
      le compteur dériverait d'autant plus vite que le produit fonctionne.
    */
    const ilYaUnAn = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
    trackInscriptionSiCompteNeuf({ id: 'u2', created_at: ilYaUnAn });
    expect(evenementsDeType('Lead')).toHaveLength(0);
  });

  it('ne compte qu’une fois le même compte, malgré un effet exécuté deux fois', () => {
    // `StrictMode` monte puis remonte chaque composant en développement :
    // l'effet qui appelle cette fonction s'exécute donc deux fois.
    const utilisateur = { id: 'u3', created_at: new Date().toISOString() };
    trackInscriptionSiCompteNeuf(utilisateur);
    trackInscriptionSiCompteNeuf(utilisateur);

    expect(evenementsDeType('Lead')).toHaveLength(1);
  });

  it('ne déclare rien sans utilisateur ni date exploitable', () => {
    trackInscriptionSiCompteNeuf(null);
    trackInscriptionSiCompteNeuf({ id: 'u4' });
    trackInscriptionSiCompteNeuf({ id: 'u5', created_at: 'pas une date' });

    expect(evenementsDeType('Lead')).toHaveLength(0);
  });
});

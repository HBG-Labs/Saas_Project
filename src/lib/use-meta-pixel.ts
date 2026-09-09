import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';

import { subscribeCookieConsent } from '@/lib/cookie-consent';
import { initMetaPixel, metaPixelEstActif, trackPageView } from '@/lib/meta-pixel';

/**
 * Déclare une page vue à chaque navigation — et une seule fois par navigation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE PIÈGE QUE CE HOOK EXISTE POUR ÉVITER
 *
 * Un `fbq('track', 'PageView')` posé dans un effet se déclenche à chaque
 * exécution de cet effet — ce qui n'est pas la même chose qu'à chaque
 * navigation. En développement, `StrictMode` monte puis remonte volontairement
 * chaque composant : le même écran compte alors deux vues.
 *
 * Le résultat n'est pas une panne, c'est pire : des chiffres plausibles mais
 * faux. Un taux de conversion divisé par deux, sans rien qui le signale.
 *
 * D'où le repère explicite ci-dessous. Ce n'est pas « ne s'exécuter qu'une
 * fois » — revenir sur `/` après un passage par `/pricing` doit bien compter
 * une nouvelle vue. C'est « ne jamais compter deux fois d'affilée le même
 * chemin », ce que `useEffect` seul ne garantit pas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ET LE CONSENTEMENT TARDIF
 *
 * Le visiteur arrive de la publicité, la bannière s'affiche, il accepte. Entre
 * son arrivée et son clic, le pixel était inactif : le `PageView` de cette
 * page-là a été abandonné, pas mis en file d'attente (voir `metaPixelEstActif`).
 *
 * Or c'est LA page qui compte — celle que la publicité a payée. `actif` est
 * donc une donnée d'état, pas une simple lecture : quand il bascule, l'effet
 * ci-dessous s'exécute à nouveau, le repère de chemin est encore vide, et la
 * vue est enfin déclarée. Sans cela, toute personne acceptant la bannière
 * manquerait à l'appel exactement là où on la cherche.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useMetaPixel() {
  const { pathname } = useLocation();
  const dernierChemin = useRef<string | null>(null);
  const [actif, setActif] = useState(metaPixelEstActif);

  /*
    `initMetaPixel` injecte le script dès que le consentement le permet — au
    montage s'il est déjà donné, à l'acceptation sinon. L'abonnement local
    ci-dessous sert à autre chose : réveiller le comptage, que le chargement
    du script ne suffit pas à déclencher.
  */
  useEffect(() => {
    const arreterChargement = initMetaPixel();
    const arreterEcoute = subscribeCookieConsent(() => setActif(metaPixelEstActif()));
    return () => {
      arreterChargement();
      arreterEcoute();
    };
  }, []);

  useEffect(() => {
    if (!actif) return;
    if (dernierChemin.current === pathname) return;
    dernierChemin.current = pathname;
    trackPageView();
  }, [pathname, actif]);
}

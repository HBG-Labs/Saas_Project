import { useEffect, useState } from 'react';

const REQUETE = '(prefers-reduced-motion: reduce)';

/**
 * La personne a-t-elle demandé moins de mouvement à son système ?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI EN JAVASCRIPT PLUTÔT QU'EN CSS
 *
 * La variante `motion-reduce:` de Tailwind suffit dès que l'animation est
 * décrite en classes. Elle ne peut rien, en revanche, contre un style EN LIGNE
 * — et une révélation pilotée par la position de défilement calcule forcément
 * ses valeurs en JavaScript, donc les pose en ligne, où elles l'emportent sur
 * toute règle CSS.
 *
 * D'où ce hook : il permet de ne pas produire l'animation du tout, plutôt que
 * de tenter de l'annuler après coup.
 *
 * L'écoute des changements n'est pas un raffinement : la préférence se règle
 * dans le système d'exploitation, sans recharger la page.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function usePrefersReducedMotion(): boolean {
  const [reduit, setReduit] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(REQUETE).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const media = window.matchMedia(REQUETE);
    const surChangement = (e: MediaQueryListEvent) => setReduit(e.matches);

    media.addEventListener('change', surChangement);
    return () => media.removeEventListener('change', surChangement);
  }, []);

  return reduit;
}

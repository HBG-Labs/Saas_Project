import { COMPACT_STORAGE_KEY, THEME_STORAGE_KEY } from './theme-context';

/** Fonds des deux thèmes signature — doivent suivre `--background` d'`index.css`. */
export const BROWSER_BAR_COLOR = { light: '#eef2f5', dark: '#0b1117' } as const;

/**
 * Teinte la barre du navigateur mobile d'après le thème RÉELLEMENT appliqué.
 *
 * `index.html` déclarait deux balises `theme-color` conditionnées à
 * `prefers-color-scheme`, donc au système et non au produit : depuis que le
 * défaut est clair quel que soit le système, un utilisateur en système sombre
 * voyait une application claire surmontée d'une barre sombre.
 */
export function applyBrowserBarColor(isDark: boolean): void {
  const meta = document.getElementById('theme-color-meta');
  if (meta) meta.setAttribute('content', isDark ? BROWSER_BAR_COLOR.dark : BROWSER_BAR_COLOR.light);
}

/**
 * Applique le thème et la densité AVANT le premier rendu React.
 *
 * Appelé depuis `main.tsx` en tout premier, avant `createRoot`. Sans cela, la
 * page s'affiche brièvement avec les styles par défaut puis bascule — évitant
 * ainsi tout flash visuel.
 *
 * Volontairement synchrone et sans dépendance : plus tôt il s'exécute, mieux
 * c'est.
 */
export function applyStoredTheme(): void {
  try {
    /*
      Le défaut est CLAIR, et suit le preset signature « Atelier Jour ».

      Cette ligne lisait auparavant `prefers-color-scheme` en l'absence de
      choix stocké. Elle peignait donc en sombre pour un système en sombre,
      alors que `ThemeProvider` rebasculait aussitôt en clair d'après le preset
      par défaut : exactement le flash que ce script existe pour éviter.

      Le premier rendu suit donc le choix explicite de la personne, et à défaut
      le thème par défaut du produit. Un basculement se fait en un clic depuis
      l'en-tête, et il est mémorisé.
    */
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const isDark = stored === 'dark';

    document.documentElement.classList.toggle('dark', isDark);
    applyBrowserBarColor(isDark);

    const storedCompact = localStorage.getItem(COMPACT_STORAGE_KEY) === 'true';
    document.documentElement.classList.toggle('compact-mode', storedCompact);
    document.documentElement.setAttribute('data-density', storedCompact ? 'compact' : 'comfortable');
  } catch {
    // localStorage peut être inaccessible (mode privé strict, iframe cloisonnée).
    // Les styles par défaut restent utilisables : on n'interrompt pas le
    // démarrage de l'application pour une préférence d'affichage.
  }
}


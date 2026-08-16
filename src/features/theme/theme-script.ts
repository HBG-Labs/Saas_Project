import { COMPACT_STORAGE_KEY, THEME_STORAGE_KEY } from './theme-context';

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
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || (stored !== 'light' && prefersDark);

    document.documentElement.classList.toggle('dark', isDark);

    const storedCompact = localStorage.getItem(COMPACT_STORAGE_KEY) === 'true';
    document.documentElement.classList.toggle('compact-mode', storedCompact);
    document.documentElement.setAttribute('data-density', storedCompact ? 'compact' : 'comfortable');
  } catch {
    // localStorage peut être inaccessible (mode privé strict, iframe cloisonnée).
    // Les styles par défaut restent utilisables : on n'interrompt pas le
    // démarrage de l'application pour une préférence d'affichage.
  }
}


import { THEME_STORAGE_KEY } from './theme-context';

/**
 * Applique le thème AVANT le premier rendu React.
 *
 * Appelé depuis `main.tsx` en tout premier, avant `createRoot`. Sans cela, la
 * page s'affiche brièvement en clair puis bascule en sombre — le « flash of
 * incorrect theme », particulièrement désagréable dans une pièce sombre.
 *
 * Volontairement synchrone et sans dépendance : plus tôt il s'exécute, mieux
 * c'est.
 */
export function applyStoredTheme(): void {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || ((stored === null || stored === 'system') && prefersDark);

    document.documentElement.classList.toggle('dark', isDark);
  } catch {
    // localStorage peut être inaccessible (mode privé strict, iframe cloisonnée).
    // Le thème clair par défaut reste utilisable : on n'interrompt pas le
    // démarrage de l'application pour une préférence d'affichage.
  }
}

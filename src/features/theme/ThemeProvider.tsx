import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  THEME_STORAGE_KEY,
  ThemeContext,
  type ResolvedTheme,
  type Theme,
  type ThemeContextValue,
} from './theme-context';

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Stockage inaccessible : valeur par défaut.
  }
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  const resolvedTheme: ResolvedTheme = theme;

  // Effet légitime : synchroniser un système externe (le DOM) avec l'état React.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  // Plus aucun abonnement à `prefers-color-scheme` : le thème ne suit plus le
  // système, il vaut « clair » ou « sombre », choisi explicitement et mémorisé.
  // L'écouteur qui subsistait ici appelait un `setSystemDark` supprimé avec ce
  // mode — il n'aurait jamais pu s'exécuter sans lever une ReferenceError.

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Préférence non persistée : l'application reste utilisable pour la session.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

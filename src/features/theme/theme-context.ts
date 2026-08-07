import { createContext } from 'react';

/** `system` suit le réglage du système d'exploitation et réagit à ses changements. */
export type Theme = 'light' | 'dark' | 'system';

/** Le thème effectivement appliqué, une fois `system` résolu. */
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export const THEME_STORAGE_KEY = 'nexoratech-theme';

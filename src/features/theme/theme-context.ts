import { createContext } from 'react';

import type { AccentColorId } from './accent-colors';
import type { ThemePresetId } from './theme-presets';

export type Theme = 'light' | 'dark';

/** Le thème effectivement appliqué ('light' ou 'dark'). */
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  preset: ThemePresetId;
  accentColor: AccentColorId;
  compactMode: boolean;
  setTheme: (theme: Theme) => void;
  setPreset: (preset: ThemePresetId) => void;
  setAccentColor: (accent: AccentColorId) => void;
  setCompactMode: (compact: boolean) => void;
  resetCustomization: () => void;
  isCustomizerOpen: boolean;
  setIsCustomizerOpen: (open: boolean) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export const THEME_STORAGE_KEY = 'nexoratech-theme';
export const PRESET_STORAGE_KEY = 'nexoratech-theme-preset';
export const ACCENT_STORAGE_KEY = 'nexoratech-accent-color';
export const COMPACT_STORAGE_KEY = 'pref_compact_mode';


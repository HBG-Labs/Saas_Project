import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  ACCENT_STORAGE_KEY,
  COMPACT_STORAGE_KEY,
  PRESET_STORAGE_KEY,
  THEME_STORAGE_KEY,
  ThemeContext,
  type ResolvedTheme,
  type Theme,
  type ThemeContextValue,
} from './theme-context';
import { ACCENT_COLORS, type AccentColorId } from './accent-colors';
import { applyBrowserBarColor } from './theme-script';
import { DEFAULT_THEME_PRESET, THEME_PRESETS, type ThemePresetId } from './theme-presets';

/**
 * Les deux ambiances signature, celles que le basculeur Clair / Sombre atteint.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI DES CONSTANTES ET NON DES CHAÎNES ÉPARPILLÉES
 *
 * Le basculeur écrivait `setPreset('default')` pour « Sombre ». C'était juste
 * tant que `default` s'appelait « Cockpit Cobalt » et valait `baseMode: 'dark'`.
 * En devenant « Atelier Jour », ce preset est passé en CLAIR — et le bouton
 * « Sombre » a continué de pointer dessus. Il ne changeait donc plus rien :
 * deux modes rigoureusement identiques, sans la moindre erreur pour le
 * signaler.
 *
 * Nommer les deux cibles empêche la prochaine repeinte de les désaccorder en
 * silence : renommer un preset ne suffit plus, il faut passer ici.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const PRESET_CLAIR: ThemePresetId = 'default';
const PRESET_SOMBRE: ThemePresetId = 'atelier-nuit';

function readStoredPreset(): ThemePresetId {
  try {
    const stored = localStorage.getItem(PRESET_STORAGE_KEY) as ThemePresetId | null;
    if (stored && THEME_PRESETS.some((p) => p.id === stored)) return stored;

    // Repli pour les installations antérieures à `PRESET_STORAGE_KEY`, qui
    // n'ont conservé qu'un mode. On les ramène sur les ambiances signature —
    // renvoyer le preset « light » (Épure Studio) enverrait ces personnes sur
    // une ambiance qu'elles n'ont jamais choisie.
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'dark') return PRESET_SOMBRE;
    if (storedTheme === 'light') return PRESET_CLAIR;
  } catch {
    // Stockage inaccessible
  }
  return PRESET_CLAIR;
}

function readStoredAccent(): AccentColorId {
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY) as AccentColorId | null;
    if (stored && ACCENT_COLORS.some((a) => a.id === stored)) return stored;
  } catch {
    // Stockage inaccessible
  }
  return 'auto';
}

function readStoredCompact(): boolean {
  try {
    return localStorage.getItem(COMPACT_STORAGE_KEY) === 'true';
  } catch {
    // Stockage inaccessible
  }
  return false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<ThemePresetId>(readStoredPreset);
  const [accentColor, setAccentColorState] = useState<AccentColorId>(readStoredAccent);
  const [compactMode, setCompactModeState] = useState<boolean>(readStoredCompact);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  const activePreset = useMemo(
    () => THEME_PRESETS.find((p) => p.id === preset) ?? DEFAULT_THEME_PRESET,
    [preset],
  );

  const theme: Theme = activePreset.baseMode;
  const resolvedTheme: ResolvedTheme = theme;

  // Effet légitime : synchroniser les variables CSS et classes DOM avec l'état
  useEffect(() => {
    const root = document.documentElement;

    // 1. Classe dark/light et mode compact haute densité
    root.classList.toggle('dark', resolvedTheme === 'dark');
    applyBrowserBarColor(resolvedTheme === 'dark');
    root.classList.toggle('compact-mode', compactMode);
    root.setAttribute('data-theme', preset);
    root.setAttribute('data-density', compactMode ? 'compact' : 'comfortable');

    // 2. Nettoyer les variables personnalisées précédentes
    const allCssVarKeys = new Set<string>();
    THEME_PRESETS.forEach((p) => Object.keys(p.variables).forEach((k) => allCssVarKeys.add(k)));
    ACCENT_COLORS.forEach((a) => {
      Object.keys(a.lightVariables).forEach((k) => allCssVarKeys.add(k));
      Object.keys(a.darkVariables).forEach((k) => allCssVarKeys.add(k));
    });

    allCssVarKeys.forEach((key) => {
      root.style.removeProperty(key);
    });

    // 3. Appliquer les variables du preset
    Object.entries(activePreset.variables).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });

    // 4. Appliquer la surcharge de couleur principale si définie
    if (accentColor !== 'auto') {
      const accent = ACCENT_COLORS.find((a) => a.id === accentColor);
      if (accent) {
        const accentVars = resolvedTheme === 'dark' ? accent.darkVariables : accent.lightVariables;
        Object.entries(accentVars).forEach(([key, val]) => {
          root.style.setProperty(key, val);
        });
      }
    }
  }, [preset, activePreset, resolvedTheme, accentColor, compactMode]);

  const setPreset = useCallback((next: ThemePresetId) => {
    setPresetState(next);
    const target = THEME_PRESETS.find((p) => p.id === next);
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, next);
      if (target) {
        localStorage.setItem(THEME_STORAGE_KEY, target.baseMode);
      }
    } catch {
      // Stockage inaccessible
    }
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      // `setPreset` persiste déjà le mode de base du preset choisi : réécrire
      // `next` par-dessus laisserait passer une incohérence si les deux
      // venaient à diverger, au lieu de la faire remonter.
      setPreset(next === 'dark' ? PRESET_SOMBRE : PRESET_CLAIR);
    },
    [setPreset],
  );

  const setAccentColor = useCallback((next: AccentColorId) => {
    setAccentColorState(next);
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, next);
    } catch {
      // Stockage inaccessible
    }
  }, []);

  const setCompactMode = useCallback((next: boolean) => {
    setCompactModeState(next);
    try {
      localStorage.setItem(COMPACT_STORAGE_KEY, String(next));
    } catch {
      // Stockage inaccessible
    }
  }, []);

  const resetCustomization = useCallback(() => {
    setPresetState(PRESET_CLAIR);
    setAccentColorState('auto');
    setCompactModeState(false);
    try {
      localStorage.removeItem(PRESET_STORAGE_KEY);
      localStorage.removeItem(ACCENT_STORAGE_KEY);
      localStorage.removeItem(COMPACT_STORAGE_KEY);
      // 'light', et non 'dark' : la remise à zéro rétablit « Atelier Jour »,
      // qui est clair. Écrire 'dark' ici laissait en mémoire un mode que
      // l'écran ne montrait pas.
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
    } catch {
      // Stockage inaccessible
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      preset,
      accentColor,
      compactMode,
      setTheme,
      setPreset,
      setAccentColor,
      setCompactMode,
      resetCustomization,
      isCustomizerOpen,
      setIsCustomizerOpen,
    }),
    [
      theme,
      resolvedTheme,
      preset,
      accentColor,
      compactMode,
      setTheme,
      setPreset,
      setAccentColor,
      setCompactMode,
      resetCustomization,
      isCustomizerOpen,
      setIsCustomizerOpen,
    ],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}


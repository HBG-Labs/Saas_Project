export type ThemePresetId =
  | 'default'
  | 'atelier-nuit'
  | 'basic'
  | 'light'
  | 'dark'
  | 'luxury'
  | 'retro'
  | 'arctic'
  | 'nature'
  | 'ember'
  | 'dracula'
  | 'midnight';

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  description: string;
  baseMode: 'light' | 'dark';
  preview: {
    primary: string;
    surface: string;
    background: string;
  };
  variables: Record<string, string>;
}

/**
 * Thème signature — Atelier Jour.
 *
 * Clair par défaut : REZO360 se lit dehors, en plein jour, souvent à bout de
 * bras. Le mode sombre reste un vrai mode (« Atelier Nuit », ci-dessous), pour
 * le local technique et le travail de nuit — mais ce n'est pas l'apparence de
 * départ.
 *
 * Les variables d'un preset sont posées EN STYLE INLINE sur `<html>` par
 * `ThemeProvider` : elles écrasent `styles/index.css`. Un preset désaccordé
 * avec la feuille de style annule donc silencieusement la palette du produit —
 * raison pour laquelle ces valeurs doivent rester identiques à celles du bloc
 * `:root` de `index.css`.
 */
export const DEFAULT_THEME_PRESET: ThemePreset = {
  id: 'default',
  label: 'Atelier Jour (Défaut)',
  description: 'Thème signature REZO360 — papier et encre, lisible en plein jour',
  baseMode: 'light',
  preview: {
    primary: '#1b44c8',
    surface: '#ffffff',
    background: '#eef2f5',
  },
  variables: {
    '--background': '#eef2f5',
    '--surface': '#ffffff',
    '--surface-raised': '#ffffff',
    '--surface-sunken': '#e6ecf1',
    '--surface-subtle': '#f6f8fa',
    '--surface-hover': '#e9eff4',
    '--border': '#d8e0e7',
    '--border-strong': '#b8c5cf',
    '--foreground': '#0e1720',
    '--muted-foreground': '#46545f',
    '--subtle-foreground': '#77868f',
    '--primary': '#1b44c8',
    '--primary-hover': '#163aac',
    '--primary-active': '#12308f',
    '--primary-foreground': '#ffffff',
    '--primary-subtle': '#e4e9fb',
    '--ring': '#1b44c8',
  },
};

/** Contrepartie sombre du thème signature — valeurs identiques au bloc `.dark`. */
export const ATELIER_NUIT_PRESET: ThemePreset = {
  id: 'atelier-nuit',
  label: 'Atelier Nuit',
  description: 'Le thème signature en sombre — local technique et travail de nuit',
  baseMode: 'dark',
  preview: {
    primary: '#7fa0ff',
    surface: '#121b23',
    background: '#0b1117',
  },
  variables: {
    '--background': '#0b1117',
    '--surface': '#121b23',
    '--surface-raised': '#18242e',
    '--surface-sunken': '#070c11',
    '--surface-subtle': '#0f171f',
    '--surface-hover': '#1c2a35',
    '--border': '#22303a',
    '--border-strong': '#33444f',
    '--foreground': '#e8eff4',
    '--muted-foreground': '#9baab6',
    '--subtle-foreground': '#6b7c87',
    '--primary': '#7fa0ff',
    '--primary-hover': '#9db6ff',
    '--primary-active': '#6288f5',
    '--primary-foreground': '#0b1117',
    '--primary-subtle': '#1a2540',
    '--ring': '#7fa0ff',
  },
};

export const THEME_PRESETS: readonly ThemePreset[] = [
  DEFAULT_THEME_PRESET,
  ATELIER_NUIT_PRESET,
  {
    id: 'basic',
    label: 'Titane Minimaliste',
    description: 'Monochrome contrasté pour un focus absolu',
    baseMode: 'dark',
    preview: {
      primary: '#111827',
      surface: '#ffffff',
      background: '#09090b',
    },
    variables: {
      '--background': '#09090b',
      '--surface': '#121215',
      '--surface-raised': '#1c1c22',
      '--surface-sunken': '#000000',
      '--surface-subtle': '#16161b',
      '--surface-hover': '#24242c',
      '--border': '#27272a',
      '--border-strong': '#3f3f46',
      '--foreground': '#fafafa',
      '--muted-foreground': '#a1a1aa',
      '--subtle-foreground': '#71717a',
      '--primary': '#e4e4e7',
      '--primary-hover': '#ffffff',
      '--primary-active': '#d4d4d8',
      '--primary-foreground': '#09090b',
      '--primary-subtle': '#27272a',
      '--ring': '#e4e4e7',
    },
  },
  {
    id: 'light',
    label: 'Épure Studio',
    description: 'Mode clair contemporain, lisibilité lumineuse',
    baseMode: 'light',
    preview: {
      primary: '#2563eb',
      surface: '#ffffff',
      background: '#f8fafc',
    },
    variables: {
      '--background': '#f8fafc',
      '--surface': '#ffffff',
      '--surface-raised': '#ffffff',
      '--surface-sunken': '#f1f5f9',
      '--surface-subtle': '#f8fafc',
      '--surface-hover': '#f1f5f9',
      '--border': '#e2e8f0',
      '--border-strong': '#cbd5e1',
      '--foreground': '#0f172a',
      '--muted-foreground': '#475569',
      '--subtle-foreground': '#94a3b8',
      '--primary': '#2563eb',
      '--primary-hover': '#1d4ed8',
      '--primary-active': '#1e40af',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#eff6ff',
      '--ring': '#2563eb',
    },
  },
  {
    id: 'dark',
    label: 'OLED Carbone',
    description: 'Noirs absolus ultra-économes et bleu cyan',
    baseMode: 'dark',
    preview: {
      primary: '#38bdf8',
      surface: '#09090b',
      background: '#000000',
    },
    variables: {
      '--background': '#000000',
      '--surface': '#0a0a0c',
      '--surface-raised': '#141418',
      '--surface-sunken': '#000000',
      '--surface-subtle': '#0e0e12',
      '--surface-hover': '#1a1a20',
      '--border': '#18181b',
      '--border-strong': '#27272a',
      '--foreground': '#f4f4f5',
      '--muted-foreground': '#a1a1aa',
      '--subtle-foreground': '#71717a',
      '--primary': '#38bdf8',
      '--primary-hover': '#7dd3fc',
      '--primary-active': '#0284c7',
      '--primary-foreground': '#0f172a',
      '--primary-subtle': '#082f49',
      '--ring': '#38bdf8',
    },
  },
  {
    id: 'luxury',
    label: 'Améthyste Royale',
    description: 'Teinte violette royale et finitions précieuses',
    baseMode: 'dark',
    preview: {
      primary: '#a855f7',
      surface: '#180d26',
      background: '#0d0517',
    },
    variables: {
      '--background': '#0d0517',
      '--surface': '#170c26',
      '--surface-raised': '#24133b',
      '--surface-sunken': '#07020d',
      '--surface-subtle': '#1c0f30',
      '--surface-hover': '#2f1a4d',
      '--border': '#351b54',
      '--border-strong': '#4c2678',
      '--foreground': '#faf5ff',
      '--muted-foreground': '#d8b4fe',
      '--subtle-foreground': '#a855f7',
      '--primary': '#a855f7',
      '--primary-hover': '#c084fc',
      '--primary-active': '#9333ea',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#3b0764',
      '--ring': '#a855f7',
    },
  },
  {
    id: 'retro',
    label: 'Cuivre & Atelier',
    description: 'Palette artisanale chaleureuse, tons ambrés & terre',
    baseMode: 'light',
    preview: {
      primary: '#d97706',
      surface: '#fffbf5',
      background: '#faf5ee',
    },
    variables: {
      '--background': '#f8f3eb',
      '--surface': '#fffdfa',
      '--surface-raised': '#ffffff',
      '--surface-sunken': '#ede3d5',
      '--surface-subtle': '#fbf7f0',
      '--surface-hover': '#f4ebd9',
      '--border': '#e2d3be',
      '--border-strong': '#cbb69b',
      '--foreground': '#292524',
      '--muted-foreground': '#78716c',
      '--subtle-foreground': '#a8a29e',
      '--primary': '#d97706',
      '--primary-hover': '#b45309',
      '--primary-active': '#92400e',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#fef3c7',
      '--ring': '#d97706',
    },
  },
  {
    id: 'arctic',
    label: 'Glacier Boréal',
    description: 'Fraîcheur boréale, cyan glacé & clarté vivifiante',
    baseMode: 'light',
    preview: {
      primary: '#0284c7',
      surface: '#ffffff',
      background: '#f0f9ff',
    },
    variables: {
      '--background': '#f0f9ff',
      '--surface': '#ffffff',
      '--surface-raised': '#ffffff',
      '--surface-sunken': '#e0f2fe',
      '--surface-subtle': '#f0f9ff',
      '--surface-hover': '#e0f2fe',
      '--border': '#bae6fd',
      '--border-strong': '#7dd3fc',
      '--foreground': '#082f49',
      '--muted-foreground': '#0369a1',
      '--subtle-foreground': '#38bdf8',
      '--primary': '#0284c7',
      '--primary-hover': '#0369a1',
      '--primary-active': '#075985',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#e0f2fe',
      '--ring': '#0284c7',
    },
  },
  {
    id: 'nature',
    label: 'Émeraude & Forêt',
    description: 'Espaces verts, écologie & fraîcheur végétale',
    baseMode: 'light',
    preview: {
      primary: '#16a34a',
      surface: '#ffffff',
      background: '#f0fdf4',
    },
    variables: {
      '--background': '#f0fdf4',
      '--surface': '#ffffff',
      '--surface-raised': '#ffffff',
      '--surface-sunken': '#dcfce7',
      '--surface-subtle': '#f0fdf4',
      '--surface-hover': '#dcfce7',
      '--border': '#bbf7d0',
      '--border-strong': '#86efac',
      '--foreground': '#052e16',
      '--muted-foreground': '#166534',
      '--subtle-foreground': '#4ade80',
      '--primary': '#16a34a',
      '--primary-hover': '#15803d',
      '--primary-active': '#166534',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#dcfce7',
      '--ring': '#16a34a',
    },
  },
  {
    id: 'ember',
    label: 'Rubis & Énergie',
    description: 'Ambiance puissante haute énergie & sécurité incendie',
    baseMode: 'dark',
    preview: {
      primary: '#ef4444',
      surface: '#1c0c0c',
      background: '#120505',
    },
    variables: {
      '--background': '#120505',
      '--surface': '#1c0c0c',
      '--surface-raised': '#2b1313',
      '--surface-sunken': '#080202',
      '--surface-subtle': '#220e0e',
      '--surface-hover': '#381818',
      '--border': '#451a1a',
      '--border-strong': '#632525',
      '--foreground': '#fff1f2',
      '--muted-foreground': '#fda4af',
      '--subtle-foreground': '#f43f5e',
      '--primary': '#ef4444',
      '--primary-hover': '#f87171',
      '--primary-active': '#dc2626',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#450a0a',
      '--ring': '#ef4444',
    },
  },
  {
    id: 'dracula',
    label: 'Nébuleuse Nuit',
    description: 'Violet nocturne mystique & néons doux',
    baseMode: 'dark',
    preview: {
      primary: '#c084fc',
      surface: '#191624',
      background: '#100e17',
    },
    variables: {
      '--background': '#100e17',
      '--surface': '#191624',
      '--surface-raised': '#242033',
      '--surface-sunken': '#09070d',
      '--surface-subtle': '#1e1a2c',
      '--surface-hover': '#2f2a42',
      '--border': '#332d47',
      '--border-strong': '#484063',
      '--foreground': '#f5f3ff',
      '--muted-foreground': '#c4b5fd',
      '--subtle-foreground': '#a78bfa',
      '--primary': '#c084fc',
      '--primary-hover': '#d8b4fe',
      '--primary-active': '#a855f7',
      '--primary-foreground': '#0f172a',
      '--primary-subtle': '#2e1065',
      '--ring': '#c084fc',
    },
  },
  {
    id: 'midnight',
    label: 'Bleu Nuit Sidéral',
    description: 'Profondeur cosmique indigo pour longues sessions nocturnes',
    baseMode: 'dark',
    preview: {
      primary: '#818cf8',
      surface: '#0b1120',
      background: '#040711',
    },
    variables: {
      '--background': '#040711',
      '--surface': '#0a101f',
      '--surface-raised': '#121b33',
      '--surface-sunken': '#020308',
      '--surface-subtle': '#0e162b',
      '--surface-hover': '#182442',
      '--border': '#1e2b4d',
      '--border-strong': '#2c3e6b',
      '--foreground': '#e0e7ff',
      '--muted-foreground': '#a5b4fc',
      '--subtle-foreground': '#818cf8',
      '--primary': '#818cf8',
      '--primary-hover': '#a5b4fc',
      '--primary-active': '#6366f1',
      '--primary-foreground': '#040711',
      '--primary-subtle': '#1e1b4b',
      '--ring': '#818cf8',
    },
  },
] as const;

export const DEFAULT_PRESET_ID: ThemePresetId = 'default';

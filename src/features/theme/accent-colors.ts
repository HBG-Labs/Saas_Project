/**
 * Les neuf choix historiques, rétablis à la demande de Harry.
 * Source : accent-colors.ts avant c1de617. Les pastilles et les familles de
 * couleurs sont conservées ; les tons de texte sont ajustés pour rester lisibles
 * sur les surfaces Atelier. Les statuts métier ne sont jamais personnalisés.
 */
export type AccentColorId =
  'auto' | 'navy' | 'blue' | 'purple' | 'green' | 'red' | 'amber' | 'pink' | 'cyan';

export interface AccentColor {
  id: AccentColorId;
  label: string;
  hex: string;
  isAuto?: boolean;
  lightVariables: Record<string, string>;
  darkVariables: Record<string, string>;
  contrastVariables: Record<string, string>;
}

/** Reprise inverse des nuances bleues, sans perdre les préférences enregistrées. */
export const ACCENTS_RETIRES: Readonly<Record<string, AccentColorId>> = {
  ardoise: 'cyan',
  acier: 'navy',
  azur: 'green',
  cobalt: 'blue',
  outremer: 'amber',
  indigo: 'red',
  saphir: 'pink',
  encre: 'purple',
};

/** Une couleur choisie doit aussi repeindre les nouvelles commandes Atelier. */
function commandes(variables: Record<string, string>): Record<string, string> {
  if (!variables['--primary']) return variables;
  return {
    ...variables,
    '--action': variables['--primary'],
    '--action-hover': variables['--primary-hover']!,
    '--action-active': variables['--primary-active']!,
    '--action-foreground': variables['--primary-foreground']!,
    '--action-text': variables['--primary'],
    '--nav-selected': variables['--primary'],
    '--nav-foreground': variables['--primary-foreground']!,
    '--nav-subtle': variables['--primary-subtle']!,
    '--nav-text': variables['--primary'],
    '--workspace-selected': variables['--primary'],
    '--workspace-foreground': variables['--primary-foreground']!,
    '--settings-selected': variables['--primary'],
    '--settings-foreground': variables['--primary-foreground']!,
  };
}

const COULEURS_HISTORIQUES: readonly AccentColor[] = [
  {
    id: 'auto',
    label: 'Automatique (Atelier)',
    hex: '#1b44c8',
    isAuto: true,
    lightVariables: {},
    darkVariables: {},
    contrastVariables: {},
  },
  {
    id: 'navy',
    label: 'Bleu Marine / Nuit',
    hex: '#1e3a8a',
    lightVariables: {
      '--primary': '#1e3a8a',
      '--primary-hover': '#172554',
      '--primary-active': '#1e40af',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#dbeafe',
      '--ring': '#1e3a8a',
    },
    darkVariables: {
      '--primary': '#60a5fa',
      '--primary-hover': '#93c5fd',
      '--primary-active': '#3b82f6',
      '--primary-foreground': '#0f172a',
      '--primary-subtle': '#172554',
      '--ring': '#60a5fa',
    },
    contrastVariables: {
      '--primary': '#172554',
      '--primary-hover': '#10203f',
      '--primary-active': '#0c182f',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#dbeafe',
      '--ring': '#172554',
    },
  },
  {
    id: 'blue',
    label: 'Bleu Cobalt Tech',
    hex: '#2563eb',
    lightVariables: {
      '--primary': '#2563eb',
      '--primary-hover': '#1d4ed8',
      '--primary-active': '#1e40af',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#eff6ff',
      '--ring': '#2563eb',
    },
    darkVariables: {
      '--primary': '#60a5fa',
      '--primary-hover': '#93c5fd',
      '--primary-active': '#3b82f6',
      '--primary-foreground': '#0f172a',
      '--primary-subtle': '#1e293b',
      '--ring': '#60a5fa',
    },
    contrastVariables: {
      '--primary': '#1e40af',
      '--primary-hover': '#172f81',
      '--primary-active': '#10235f',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#eff6ff',
      '--ring': '#1e40af',
    },
  },
  {
    id: 'purple',
    label: 'Violet Digital',
    hex: '#8b5cf6',
    lightVariables: {
      '--primary': '#7c3aed',
      '--primary-hover': '#6d28d9',
      '--primary-active': '#5b21b6',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#f5f3ff',
      '--ring': '#7c3aed',
    },
    darkVariables: {
      '--primary': '#a78bfa',
      '--primary-hover': '#c4b5fd',
      '--primary-active': '#9b72f8',
      '--primary-foreground': '#0f172a',
      '--primary-subtle': '#2e1065',
      '--ring': '#a78bfa',
    },
    contrastVariables: {
      '--primary': '#5b21b6',
      '--primary-hover': '#4c1d95',
      '--primary-active': '#3b1675',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#f5f3ff',
      '--ring': '#5b21b6',
    },
  },
  {
    id: 'green',
    label: 'Vert Émeraude',
    hex: '#10b981',
    lightVariables: {
      '--primary': '#147a3b',
      '--primary-hover': '#166534',
      '--primary-active': '#14532d',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#f0fdf4',
      '--ring': '#147a3b',
    },
    darkVariables: {
      '--primary': '#34d399',
      '--primary-hover': '#6ee7b7',
      '--primary-active': '#10b981',
      '--primary-foreground': '#052e16',
      '--primary-subtle': '#064e3b',
      '--ring': '#34d399',
    },
    contrastVariables: {
      '--primary': '#14532d',
      '--primary-hover': '#104425',
      '--primary-active': '#0b321a',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#f0fdf4',
      '--ring': '#14532d',
    },
  },
  {
    id: 'red',
    label: 'Rouge Rubis',
    hex: '#ef4444',
    lightVariables: {
      '--primary': '#c92323',
      '--primary-hover': '#b91c1c',
      '--primary-active': '#991b1b',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#fef2f2',
      '--ring': '#c92323',
    },
    darkVariables: {
      '--primary': '#f87171',
      '--primary-hover': '#fca5a5',
      '--primary-active': '#ef4444',
      '--primary-foreground': '#290707',
      '--primary-subtle': '#450a0a',
      '--ring': '#f87171',
    },
    contrastVariables: {
      '--primary': '#8b1818',
      '--primary-hover': '#7f1d1d',
      '--primary-active': '#601616',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#fef2f2',
      '--ring': '#8b1818',
    },
  },
  {
    id: 'amber',
    label: 'Ambre & Or Chaud',
    hex: '#d97706',
    lightVariables: {
      '--primary': '#ad5009',
      '--primary-hover': '#92400e',
      '--primary-active': '#78350f',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#fffbeb',
      '--ring': '#ad5009',
    },
    darkVariables: {
      '--primary': '#fbbf24',
      '--primary-hover': '#fcd34d',
      '--primary-active': '#f59e0b',
      '--primary-foreground': '#451a03',
      '--primary-subtle': '#451a03',
      '--ring': '#fbbf24',
    },
    contrastVariables: {
      '--primary': '#78350f',
      '--primary-hover': '#652c0c',
      '--primary-active': '#4b2008',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#fffbeb',
      '--ring': '#78350f',
    },
  },
  {
    id: 'pink',
    label: 'Rose Fuchsia',
    hex: '#ec4899',
    lightVariables: {
      '--primary': '#c8226d',
      '--primary-hover': '#be185d',
      '--primary-active': '#9d174d',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#fdf2f8',
      '--ring': '#c8226d',
    },
    darkVariables: {
      '--primary': '#f472b6',
      '--primary-hover': '#f9a8d4',
      '--primary-active': '#ec4899',
      '--primary-foreground': '#330518',
      '--primary-subtle': '#500724',
      '--ring': '#f472b6',
    },
    contrastVariables: {
      '--primary': '#831843',
      '--primary-hover': '#651133',
      '--primary-active': '#4b0b25',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#fdf2f8',
      '--ring': '#831843',
    },
  },
  {
    id: 'cyan',
    label: 'Cyan & Océan',
    hex: '#06b6d4',
    lightVariables: {
      '--primary': '#0e7490',
      '--primary-hover': '#155e75',
      '--primary-active': '#164e63',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#ecfeff',
      '--ring': '#0e7490',
    },
    darkVariables: {
      '--primary': '#22d3ee',
      '--primary-hover': '#67e8f9',
      '--primary-active': '#06b6d4',
      '--primary-foreground': '#083344',
      '--primary-subtle': '#083344',
      '--ring': '#22d3ee',
    },
    contrastVariables: {
      '--primary': '#164e63',
      '--primary-hover': '#103b4b',
      '--primary-active': '#0c2b38',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#ecfeff',
      '--ring': '#164e63',
    },
  },
];

export const ACCENT_COLORS: readonly AccentColor[] = COULEURS_HISTORIQUES.map((color) => ({
  ...color,
  lightVariables: commandes(color.lightVariables),
  darkVariables: commandes(color.darkVariables),
  contrastVariables: commandes(color.contrastVariables),
}));

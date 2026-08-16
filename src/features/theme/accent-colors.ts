export type AccentColorId =
  | 'auto'
  | 'navy'
  | 'blue'
  | 'purple'
  | 'green'
  | 'red'
  | 'amber'
  | 'pink'
  | 'cyan';

export interface AccentColor {
  id: AccentColorId;
  label: string;
  hex: string;
  isAuto?: boolean;
  lightVariables: Record<string, string>;
  darkVariables: Record<string, string>;
}

export const ACCENT_COLORS: readonly AccentColor[] = [
  {
    id: 'auto',
    label: 'Automatique (Selon le thème)',
    hex: '#64748b',
    isAuto: true,
    lightVariables: {},
    darkVariables: {},
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
      '--primary-subtle': '#1e3a8a',
      '--ring': '#60a5fa',
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
      '--primary': '#3b82f6',
      '--primary-hover': '#60a5fa',
      '--primary-active': '#2563eb',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#1e293b',
      '--ring': '#3b82f6',
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
      '--primary-active': '#8b5cf6',
      '--primary-foreground': '#0f172a',
      '--primary-subtle': '#2e1065',
      '--ring': '#a78bfa',
    },
  },
  {
    id: 'green',
    label: 'Vert Émeraude',
    hex: '#10b981',
    lightVariables: {
      '--primary': '#16a34a',
      '--primary-hover': '#15803d',
      '--primary-active': '#166534',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#f0fdf4',
      '--ring': '#16a34a',
    },
    darkVariables: {
      '--primary': '#34d399',
      '--primary-hover': '#6ee7b7',
      '--primary-active': '#10b981',
      '--primary-foreground': '#064e3b',
      '--primary-subtle': '#064e3b',
      '--ring': '#34d399',
    },
  },
  {
    id: 'red',
    label: 'Rouge Rubis',
    hex: '#ef4444',
    lightVariables: {
      '--primary': '#dc2626',
      '--primary-hover': '#b91c1c',
      '--primary-active': '#991b1b',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#fef2f2',
      '--ring': '#dc2626',
    },
    darkVariables: {
      '--primary': '#f87171',
      '--primary-hover': '#fca5a5',
      '--primary-active': '#ef4444',
      '--primary-foreground': '#450a0a',
      '--primary-subtle': '#450a0a',
      '--ring': '#f87171',
    },
  },
  {
    id: 'amber',
    label: 'Ambre & Or Chaud',
    hex: '#d97706',
    lightVariables: {
      '--primary': '#d97706',
      '--primary-hover': '#b45309',
      '--primary-active': '#92400e',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#fffbeb',
      '--ring': '#d97706',
    },
    darkVariables: {
      '--primary': '#fbbf24',
      '--primary-hover': '#fcd34d',
      '--primary-active': '#f59e0b',
      '--primary-foreground': '#451a03',
      '--primary-subtle': '#451a03',
      '--ring': '#fbbf24',
    },
  },
  {
    id: 'pink',
    label: 'Rose Fuchsia',
    hex: '#ec4899',
    lightVariables: {
      '--primary': '#db2777',
      '--primary-hover': '#be185d',
      '--primary-active': '#9d174d',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#fdf2f8',
      '--ring': '#db2777',
    },
    darkVariables: {
      '--primary': '#f472b6',
      '--primary-hover': '#f9a8d4',
      '--primary-active': '#ec4899',
      '--primary-foreground': '#500724',
      '--primary-subtle': '#500724',
      '--ring': '#f472b6',
    },
  },
  {
    id: 'cyan',
    label: 'Cyan & Océan',
    hex: '#06b6d4',
    lightVariables: {
      '--primary': '#0891b2',
      '--primary-hover': '#0e7490',
      '--primary-active': '#155e75',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#ecfeff',
      '--ring': '#0891b2',
    },
    darkVariables: {
      '--primary': '#22d3ee',
      '--primary-hover': '#67e8f9',
      '--primary-active': '#06b6d4',
      '--primary-foreground': '#083344',
      '--primary-subtle': '#083344',
      '--ring': '#22d3ee',
    },
  },
] as const;

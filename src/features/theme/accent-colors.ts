/**
 * Les neuf nuances d'accent — neuf bleus, et non neuf couleurs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI NEUF BLEUS
 *
 * Une couleur d'accent surcharge `--primary` : c'est elle qu'on voit sur chaque
 * lien et chaque anneau de focus. Tant que le choix allait
 * du vert au rose, choisir un accent ne personnalisait pas REZO360 — cela le
 * remplaçait. Le bleu de la marque n'était plus reconnaissable à l'écran.
 *
 * Les neuf nuances sont donc posées sur un même arc de TEINTE autour du bleu
 * REZO `#1b44c8` (OKLCH H 265°) : quatre plus froides, quatre plus profondes.
 * À chaque étape, la luminosité a été recalculée pour retrouver exactement le
 * contraste du bleu REZO. Une nuance change la teinte, jamais le poids — l'écart
 * de contraste entre la plus froide et la plus profonde est de 0,06 point.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN TROISIÈME JEU DE VARIABLES
 *
 * `ThemeProvider` applique l'accent APRÈS le preset. Avec deux jeux seulement,
 * choisir un accent dans « Contraste élevé » écrasait le bleu renforcé du thème
 * par celui du thème clair : le thème d'accessibilité perdait son accessibilité
 * dès qu'on le personnalisait, sans que rien ne le signale.
 *
 * `contrastVariables` tient le niveau du preset (≈ 11:1 contre blanc).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QU'UNE NUANCE NE TOUCHE PAS
 *
 * Uniquement les six variables ci-dessous. Succès, avertissement, erreur et
 * information restent ceux de la feuille de styles : une couleur qui porte un
 * sens ne se personnalise pas.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type AccentColorId =
  'auto' | 'ardoise' | 'acier' | 'azur' | 'cobalt' | 'outremer' | 'indigo' | 'saphir' | 'encre';

export interface AccentColor {
  id: AccentColorId;
  label: string;
  /** Pastille du sélecteur. Pour `auto`, le bleu REZO lui-même. */
  hex: string;
  isAuto?: boolean;
  lightVariables: Record<string, string>;
  darkVariables: Record<string, string>;
  /** Jeu dédié à « Contraste élevé ». Vide pour `auto`, qui laisse le preset. */
  contrastVariables: Record<string, string>;
}

/**
 * Anciens accents, et la nuance qui les remplace.
 *
 * Le choix ne vit que dans le navigateur. Sans cette table, `readStoredAccent`
 * retombe sur `auto` dès que l'identifiant lui est inconnu : tout le monde
 * perdrait son réglage d'un chargement à l'autre, sans explication.
 *
 * La correspondance est injective — deux anciens accents ne tombent jamais sur
 * la même nuance, pour que chacun garde un choix distinct. Trois reprises sont
 * littérales (cyan → la plus froide, blue → Cobalt, purple → la plus profonde) ;
 * les cinq autres suivent l'ordre de la série.
 */
export const ACCENTS_RETIRES: Readonly<Record<string, AccentColorId>> = {
  cyan: 'ardoise',
  navy: 'acier',
  green: 'azur',
  blue: 'cobalt',
  amber: 'outremer',
  red: 'indigo',
  pink: 'saphir',
  purple: 'encre',
};

export const ACCENT_COLORS: readonly AccentColor[] = [
  {
    id: 'auto',
    label: 'Bleu REZO (automatique)',
    hex: '#1b44c8',
    isAuto: true,
    lightVariables: {},
    darkVariables: {},
    contrastVariables: {},
  },
  {
    id: 'ardoise',
    label: 'Bleu Ardoise',
    hex: '#00539a',
    lightVariables: {
      '--primary': '#00539a',
      '--primary-hover': '#004785',
      '--primary-active': '#003a70',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#e0ebf6',
      '--ring': '#00539a',
    },
    darkVariables: {
      '--primary': '#6ea7e7',
      '--primary-hover': '#90bced',
      '--primary-active': '#4d91da',
      '--primary-foreground': '#0e1b36',
      '--primary-subtle': '#14304d',
      '--ring': '#6ea7e7',
    },
    contrastVariables: {
      '--primary': '#003c73',
      '--primary-hover': '#003262',
      '--primary-active': '#002a54',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#e8f1fb',
      '--ring': '#003c73',
    },
  },
  {
    id: 'acier',
    label: 'Bleu Acier',
    hex: '#0050a6',
    lightVariables: {
      '--primary': '#0050a6',
      '--primary-hover': '#004490',
      '--primary-active': '#003879',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#e0eaf8',
      '--ring': '#0050a6',
    },
    darkVariables: {
      '--primary': '#6fa6f0',
      '--primary-hover': '#91bbf3',
      '--primary-active': '#4e8fe4',
      '--primary-foreground': '#0e1b36',
      '--primary-subtle': '#152f51',
      '--ring': '#6fa6f0',
    },
    contrastVariables: {
      '--primary': '#003a7d',
      '--primary-hover': '#00306b',
      '--primary-active': '#00285c',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#e8f1fc',
      '--ring': '#003a7d',
    },
  },
  {
    id: 'azur',
    label: 'Bleu Azur',
    hex: '#004db4',
    lightVariables: {
      '--primary': '#004db4',
      '--primary-hover': '#00419c',
      '--primary-active': '#003584',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#e0eafa',
      '--ring': '#004db4',
    },
    darkVariables: {
      '--primary': '#6fa5f8',
      '--primary-hover': '#91baf9',
      '--primary-active': '#508ded',
      '--primary-foreground': '#0e1b36',
      '--primary-subtle': '#162e55',
      '--ring': '#6fa5f8',
    },
    contrastVariables: {
      '--primary': '#003787',
      '--primary-hover': '#002e75',
      '--primary-active': '#002665',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#e8f1fe',
      '--ring': '#003787',
    },
  },
  {
    id: 'cobalt',
    label: 'Bleu Cobalt',
    hex: '#0146c7',
    lightVariables: {
      '--primary': '#0146c7',
      '--primary-hover': '#023cab',
      '--primary-active': '#03328e',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#e1eafb',
      '--ring': '#0146c7',
    },
    darkVariables: {
      '--primary': '#72a3fe',
      '--primary-hover': '#92b9fe',
      '--primary-active': '#548bf4',
      '--primary-foreground': '#0e1b36',
      '--primary-subtle': '#172d58',
      '--ring': '#72a3fe',
    },
    contrastVariables: {
      '--primary': '#00319a',
      '--primary-hover': '#002885',
      '--primary-active': '#002074',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#e9f1ff',
      '--ring': '#00319a',
    },
  },
  {
    id: 'outremer',
    label: 'Bleu Outremer',
    hex: '#2d41c9',
    lightVariables: {
      '--primary': '#2d41c9',
      '--primary-hover': '#2537ad',
      '--primary-active': '#1e2e8f',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#e3e9fb',
      '--ring': '#2d41c9',
    },
    darkVariables: {
      '--primary': '#81a0ff',
      '--primary-hover': '#9db6ff',
      '--primary-active': '#6787f5',
      '--primary-foreground': '#0e1b36',
      '--primary-subtle': '#1f2c58',
      '--ring': '#81a0ff',
    },
    contrastVariables: {
      '--primary': '#1e2b9f',
      '--primary-hover': '#18228b',
      '--primary-active': '#131b79',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#eaf0ff',
      '--ring': '#1e2b9f',
    },
  },
  {
    id: 'indigo',
    label: 'Bleu Indigo',
    hex: '#363fc9',
    lightVariables: {
      '--primary': '#363fc9',
      '--primary-hover': '#2e36ad',
      '--primary-active': '#252c90',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#e4e9fb',
      '--ring': '#363fc9',
    },
    darkVariables: {
      '--primary': '#879eff',
      '--primary-hover': '#a1b5ff',
      '--primary-active': '#6e85f5',
      '--primary-foreground': '#0e1b36',
      '--primary-subtle': '#222b58',
      '--ring': '#879eff',
    },
    contrastVariables: {
      '--primary': '#26299f',
      '--primary-hover': '#1f208b',
      '--primary-active': '#191979',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#ebf0ff',
      '--ring': '#26299f',
    },
  },
  {
    id: 'saphir',
    label: 'Bleu Saphir',
    hex: '#3f3dc8',
    lightVariables: {
      '--primary': '#3f3dc8',
      '--primary-hover': '#3534ac',
      '--primary-active': '#2b2b8f',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#e5e9fb',
      '--ring': '#3f3dc8',
    },
    darkVariables: {
      '--primary': '#8c9dff',
      '--primary-hover': '#a5b4ff',
      '--primary-active': '#7584f5',
      '--primary-foreground': '#0e1b36',
      '--primary-subtle': '#252b58',
      '--ring': '#8c9dff',
    },
    contrastVariables: {
      '--primary': '#2d279f',
      '--primary-hover': '#251e8b',
      '--primary-active': '#1f1779',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#ecf0ff',
      '--ring': '#2d279f',
    },
  },
  {
    id: 'encre',
    label: 'Bleu Encre',
    hex: '#463ac8',
    lightVariables: {
      '--primary': '#463ac8',
      '--primary-hover': '#3b32ac',
      '--primary-active': '#31298f',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#e5e9fb',
      '--ring': '#463ac8',
    },
    darkVariables: {
      '--primary': '#929bff',
      '--primary-hover': '#a9b3ff',
      '--primary-active': '#7b82f5',
      '--primary-foreground': '#0e1b36',
      '--primary-subtle': '#272a58',
      '--ring': '#929bff',
    },
    contrastVariables: {
      '--primary': '#33259e',
      '--primary-hover': '#2b1c8b',
      '--primary-active': '#241579',
      '--primary-foreground': '#ffffff',
      '--primary-subtle': '#edefff',
      '--ring': '#33259e',
    },
  },
] as const;

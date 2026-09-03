/**
 * Génère la bibliothèque d'avatars REZO360 — 50 SVG + leur catalogue TypeScript.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN GÉNÉRATEUR PLUTÔT QUE 50 FICHIERS ÉCRITS À LA MAIN
 *
 * Cinquante SVG dessinés un par un divergent : une oreille placée deux pixels
 * plus haut ici, une épaule plus large là, et la collection cesse de paraître
 * conçue par la même personne. Un système paramétré impose la même grille, les
 * mêmes proportions et la même palette à tous — c'est lui qui produit l'effet
 * « un seul directeur artistique ».
 *
 * Il rend aussi la bibliothèque REPRODUCTIBLE : corriger la forme d'un nez ou
 * la teinte d'une carnation se fait ici, pas dans cinquante fichiers.
 *
 * LES DEUX SORTIES VIENNENT DE LA MÊME TABLE
 *
 * `SPECS` décrit les cinquante avatars. Le script en tire les SVG *et*
 * `src/config/avatars.ts`. Deux sources séparées finiraient par se
 * contredire — un identifiant présent dans le catalogue sans fichier en face,
 * ou l'inverse, et la galerie afficherait un trou.
 *
 * Relancer :  node scripts/generate-avatars.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER_SVG = join(RACINE, 'public', 'avatars');
// `src/config/`, pas `src/features/profile/` : c'est une donnée statique, sans
// dépendance, au même titre que `routes.ts` ou `navigation.ts` — et c'est ce
// qui permet à `components/ui/UserAvatar.tsx` de l'importer sans franchir la
// frontière qui interdit aux primitives UI de dépendre d'une feature.
const FICHIER_CATALOGUE = join(RACINE, 'src', 'config', 'avatars.ts');

// ─────────────────────────────────────────────────────────────── PALETTES
//
// Carnations : huit tons continus du plus clair au plus profond. Aucune n'est
// associée à une origine ni à un rôle — elles se combinent librement avec
// toutes les coiffures et toutes les tenues, ce qui est précisément ce qui
// évite le stéréotype.
const CARNATIONS = {
  c1: { base: '#f6d9c2', ombre: '#e8bfa2' },
  c2: { base: '#efc7a4', ombre: '#dcac86' },
  c3: { base: '#e2ad84', ombre: '#cb9066' },
  c4: { base: '#d19265', ombre: '#b6754a' },
  c5: { base: '#b8764c', ombre: '#9c5c36' },
  c6: { base: '#96583a', ombre: '#7b4227' },
  c7: { base: '#74402a', ombre: '#5c301d' },
  c8: { base: '#54301f', ombre: '#3f2215' },
};

const CHEVEUX = {
  noir: { base: '#1c1c22', clair: '#31313c' },
  brunFonce: '#2e2018',
  brun: '#4a3122',
  chataigne: '#6b4226',
  auburn: '#8a4a2b',
  roux: '#a8492a',
  blond: '#c39a58',
  blondClair: '#ddc088',
  gris: '#8c9199',
  argent: '#c6ccd3',
};
const teinteCheveux = (id) => (typeof CHEVEUX[id] === 'string' ? CHEVEUX[id] : CHEVEUX[id].base);

// Fonds repris de l'interface : la pastille ne doit jamais concurrencer le
// visage, d'où des teintes très désaturées autour du gris-bleu du produit.
const FONDS = {
  f1: '#dbe3f7', // tint du primaire
  f2: '#e6ecf1', // surface-sunken
  f3: '#dcebe4',
  f4: '#f3e6d5',
  f5: '#e7e1f2',
  f6: '#d9e8ef',
  f7: '#f2e2e2',
  f8: '#e5eadd',
};

const TENUES = {
  bleu: '#1b44c8',
  marine: '#22314f',
  ardoise: '#41515f',
  sarcelle: '#1f6f6a',
  anthracite: '#2b3138',
  blanc: '#eef2f7',
  gris: '#8d98a4',
  hiVis: '#e8a33d',
  bordeaux: '#6d2f3d',
  foret: '#2f5741',
  brique: '#a0522d',
  lavande: '#6f6bb5',
};

const TRAIT = '#14202b'; // yeux, bouche, lunettes — un seul encrage pour tous

// ────────────────────────────────────────────────────── GÉOMÉTRIE DE BASE
//
// Toile de 128x128, tête centrée sur (64, 54). Ces constantes sont le
// squelette commun : c'est parce qu'elles ne bougent jamais que les cinquante
// avatars se superposent parfaitement dans un cercle.
const CX = 64;
const CY_TETE = 54;

const VISAGES = {
  ovale: { w: 22, h: 27, jaw: 11 },
  rond: { w: 23.5, h: 24.5, jaw: 15 },
  carre: { w: 23, h: 26, jaw: 18 },
  effile: { w: 22, h: 28, jaw: 7.5 },
};

function cheminTete(forme) {
  const { w, h, jaw } = VISAGES[forme];
  const haut = CY_TETE - h;
  const mach = CY_TETE + h * 0.52;
  const menton = CY_TETE + h;
  return [
    `M ${CX - w} ${CY_TETE}`,
    `C ${CX - w} ${haut} ${CX + w} ${haut} ${CX + w} ${CY_TETE}`,
    `C ${CX + w} ${mach} ${CX + jaw} ${menton} ${CX} ${menton}`,
    `C ${CX - jaw} ${menton} ${CX - w} ${mach} ${CX - w} ${CY_TETE}`,
    'Z',
  ].join(' ');
}

// ─────────────────────────────────────────────────────────────── COIFFURES
//
// Chaque coiffure rend deux couches : `arriere`, posée avant la tête (volumes,
// longueurs, nattes), et `avant`, posée après (frange, mèches, contours). Sans
// cette séparation, une chevelure longue passerait devant le visage.
const COIFFURES = {
  rase: (c) => ({
    arriere: '',
    avant: `<path d="M ${CX - 21} ${CY_TETE - 8} C ${CX - 21} ${CY_TETE - 30} ${CX + 21} ${CY_TETE - 30} ${CX + 21} ${CY_TETE - 8} C ${CX + 14} ${CY_TETE - 19} ${CX - 14} ${CY_TETE - 19} ${CX - 21} ${CY_TETE - 8} Z" fill="${c}"/>`,
  }),
  courte: (c) => ({
    arriere: '',
    avant: `<path d="M ${CX - 23} ${CY_TETE - 4} C ${CX - 24} ${CY_TETE - 32} ${CX + 24} ${CY_TETE - 32} ${CX + 23} ${CY_TETE - 4} C ${CX + 20} ${CY_TETE - 14} ${CX + 12} ${CY_TETE - 20} ${CX} ${CY_TETE - 20} C ${CX - 12} ${CY_TETE - 20} ${CX - 20} ${CY_TETE - 14} ${CX - 23} ${CY_TETE - 4} Z" fill="${c}"/>`,
  }),
  raie: (c) => ({
    arriere: '',
    avant:
      `<path d="M ${CX - 23} ${CY_TETE - 3} C ${CX - 25} ${CY_TETE - 33} ${CX + 24} ${CY_TETE - 33} ${CX + 23} ${CY_TETE - 5} C ${CX + 21} ${CY_TETE - 17} ${CX + 4} ${CY_TETE - 23} ${CX - 6} ${CY_TETE - 17} C ${CX - 14} ${CY_TETE - 12} ${CX - 20} ${CY_TETE - 10} ${CX - 23} ${CY_TETE - 3} Z" fill="${c}"/>`,
  }),
  ondulee: (c) => ({
    arriere: `<path d="M ${CX - 26} ${CY_TETE + 6} C ${CX - 30} ${CY_TETE - 26} ${CX + 30} ${CY_TETE - 26} ${CX + 26} ${CY_TETE + 6} C ${CX + 22} ${CY_TETE - 4} ${CX - 22} ${CY_TETE - 4} ${CX - 26} ${CY_TETE + 6} Z" fill="${c}"/>`,
    avant: `<path d="M ${CX - 23} ${CY_TETE - 2} C ${CX - 26} ${CY_TETE - 30} ${CX + 26} ${CY_TETE - 30} ${CX + 23} ${CY_TETE - 2} C ${CX + 18} ${CY_TETE - 13} ${CX + 10} ${CY_TETE - 9} ${CX - 2} ${CY_TETE - 16} C ${CX - 12} ${CY_TETE - 21} ${CX - 19} ${CY_TETE - 13} ${CX - 23} ${CY_TETE - 2} Z" fill="${c}"/>`,
  }),
  bouclee: (c) => {
    const b = [];
    const points = [
      [-19, -18], [-11, -24], [0, -26], [11, -24], [19, -18],
      [-22, -9], [22, -9], [-15, -22], [15, -22],
    ];
    for (const [dx, dy] of points) {
      b.push(`<circle cx="${CX + dx}" cy="${CY_TETE + dy}" r="8" fill="${c}"/>`);
    }
    return { arriere: '', avant: b.join('') };
  },
  afro: (c) => ({
    arriere: `<circle cx="${CX}" cy="${CY_TETE - 10}" r="31" fill="${c}"/>`,
    avant: `<path d="M ${CX - 22} ${CY_TETE - 8} C ${CX - 22} ${CY_TETE - 26} ${CX + 22} ${CY_TETE - 26} ${CX + 22} ${CY_TETE - 8} C ${CX + 15} ${CY_TETE - 17} ${CX - 15} ${CY_TETE - 17} ${CX - 22} ${CY_TETE - 8} Z" fill="${c}"/>`,
  }),
  crepue: (c) => {
    const b = [];
    for (const [dx, dy, r] of [
      [-17, -20, 9], [0, -25, 10], [17, -20, 9], [-23, -8, 8], [23, -8, 8],
    ]) {
      b.push(`<circle cx="${CX + dx}" cy="${CY_TETE + dy}" r="${r}" fill="${c}"/>`);
    }
    return { arriere: '', avant: b.join('') };
  },
  /*
    LOCKS ET TRESSES PENDENT — ELLES NE SE DRESSENT JAMAIS AU-DESSUS DU CRÂNE.

    La première version dessinait des barres (locks) ou des traits (tresses)
    plats à partir du sommet de la tête. À la jonction avec le contour arrondi
    du crâne, l'écart entre une forme à angle droit et une silhouette courbe
    créait une rangée de pointes noires — rendu à l'écran, cela se lisait
    comme une couronne de piquants, pas comme une coiffure. Précisément le
    risque de caricature que le brief demandait d'éviter.

    Les deux styles suivent maintenant le même principe : un bonnet lisse
    (`avant`) couvre le crâne sans aucune aspérité, et les mèches — dans
    `arriere`, donc masquées par le visage partout où elles le recouvrent —
    ne redeviennent visibles qu'EN DESSOUS de la mâchoire, retombant vers le
    cou et les épaules.
  */
  locks: (c) => {
    const brins = [-20, -11, 0, 11, 20]
      .map((dx, i) => {
        const longueur = 30 + (i % 2 === 0 ? 6 : 0);
        return `<rect x="${CX + dx - 3.6}" y="${CY_TETE - 2}" width="7.2" height="${longueur}" rx="3.6" fill="${c}"/>`;
      })
      .join('');
    return {
      arriere:
        `<path d="M ${CX - 24} ${CY_TETE - 4} C ${CX - 28} ${CY_TETE + 14} ${CX - 25} ${CY_TETE + 28} ${CX - 27} ${CY_TETE + 36} L ${CX + 27} ${CY_TETE + 36} C ${CX + 25} ${CY_TETE + 28} ${CX + 28} ${CY_TETE + 14} ${CX + 24} ${CY_TETE - 4} Z" fill="${c}"/>` +
        brins,
      avant: `<path d="M ${CX - 22} ${CY_TETE - 7} C ${CX - 22} ${CY_TETE - 27} ${CX + 22} ${CY_TETE - 27} ${CX + 22} ${CY_TETE - 7} C ${CX + 15} ${CY_TETE - 17} ${CX - 15} ${CY_TETE - 17} ${CX - 22} ${CY_TETE - 7} Z" fill="${c}"/>`,
    };
  },
  tresses: (c) => {
    const nattes = [-19, -10, 10, 19]
      .map((dx) => {
        const bas = CY_TETE + 30 + Math.abs(dx) * 0.15;
        return `<path d="M ${CX + dx} ${CY_TETE - 4} C ${CX + dx - 2} ${CY_TETE + 10} ${CX + dx + 2} ${CY_TETE + 20} ${CX + dx} ${bas}" stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
      })
      .join('');
    return {
      arriere: `<path d="M ${CX - 23} ${CY_TETE + 2} C ${CX - 25} ${CY_TETE + 24} ${CX + 25} ${CY_TETE + 24} ${CX + 23} ${CY_TETE + 2} Z" fill="${c}"/>${nattes}`,
      avant: `<path d="M ${CX - 22} ${CY_TETE - 8} C ${CX - 22} ${CY_TETE - 28} ${CX + 22} ${CY_TETE - 28} ${CX + 22} ${CY_TETE - 8} Z" fill="${c}"/>`,
    };
  },
  chignon: (c) => ({
    arriere: `<circle cx="${CX}" cy="${CY_TETE - 32}" r="11" fill="${c}"/>`,
    avant: `<path d="M ${CX - 23} ${CY_TETE - 6} C ${CX - 24} ${CY_TETE - 30} ${CX + 24} ${CY_TETE - 30} ${CX + 23} ${CY_TETE - 6} C ${CX + 16} ${CY_TETE - 22} ${CX - 16} ${CY_TETE - 22} ${CX - 23} ${CY_TETE - 6} Z" fill="${c}"/>`,
  }),
  queue: (c) => ({
    arriere: `<path d="M ${CX + 20} ${CY_TETE - 14} C ${CX + 34} ${CY_TETE - 8} ${CX + 34} ${CY_TETE + 18} ${CX + 26} ${CY_TETE + 24} C ${CX + 30} ${CY_TETE + 6} ${CX + 28} ${CY_TETE - 6} ${CX + 20} ${CY_TETE - 14} Z" fill="${c}"/>`,
    avant: `<path d="M ${CX - 23} ${CY_TETE - 6} C ${CX - 24} ${CY_TETE - 30} ${CX + 24} ${CY_TETE - 30} ${CX + 23} ${CY_TETE - 6} C ${CX + 16} ${CY_TETE - 21} ${CX - 16} ${CY_TETE - 21} ${CX - 23} ${CY_TETE - 6} Z" fill="${c}"/>`,
  }),
  longueRaide: (c) => ({
    arriere: `<path d="M ${CX - 25} ${CY_TETE - 10} L ${CX - 27} ${CY_TETE + 34} L ${CX + 27} ${CY_TETE + 34} L ${CX + 25} ${CY_TETE - 10} Z" fill="${c}"/>`,
    avant: `<path d="M ${CX - 24} ${CY_TETE - 4} C ${CX - 25} ${CY_TETE - 32} ${CX + 25} ${CY_TETE - 32} ${CX + 24} ${CY_TETE - 4} C ${CX + 20} ${CY_TETE - 18} ${CX - 20} ${CY_TETE - 18} ${CX - 24} ${CY_TETE - 4} Z" fill="${c}"/>`,
  }),
  longueOndulee: (c) => ({
    arriere: `<path d="M ${CX - 26} ${CY_TETE - 8} C ${CX - 32} ${CY_TETE + 12} ${CX - 24} ${CY_TETE + 24} ${CX - 28} ${CY_TETE + 36} L ${CX + 28} ${CY_TETE + 36} C ${CX + 24} ${CY_TETE + 24} ${CX + 32} ${CY_TETE + 12} ${CX + 26} ${CY_TETE - 8} Z" fill="${c}"/>`,
    avant: `<path d="M ${CX - 24} ${CY_TETE - 3} C ${CX - 26} ${CY_TETE - 31} ${CX + 26} ${CY_TETE - 31} ${CX + 24} ${CY_TETE - 3} C ${CX + 18} ${CY_TETE - 14} ${CX + 8} ${CY_TETE - 11} ${CX - 4} ${CY_TETE - 17} C ${CX - 13} ${CY_TETE - 21} ${CX - 20} ${CY_TETE - 14} ${CX - 24} ${CY_TETE - 3} Z" fill="${c}"/>`,
  }),
  carreCourt: (c) => ({
    arriere: `<path d="M ${CX - 26} ${CY_TETE - 8} L ${CX - 26} ${CY_TETE + 16} C ${CX - 20} ${CY_TETE + 22} ${CX + 20} ${CY_TETE + 22} ${CX + 26} ${CY_TETE + 16} L ${CX + 26} ${CY_TETE - 8} Z" fill="${c}"/>`,
    avant: `<path d="M ${CX - 24} ${CY_TETE - 4} C ${CX - 25} ${CY_TETE - 31} ${CX + 25} ${CY_TETE - 31} ${CX + 24} ${CY_TETE - 4} C ${CX + 18} ${CY_TETE - 17} ${CX - 18} ${CY_TETE - 17} ${CX - 24} ${CY_TETE - 4} Z" fill="${c}"/>`,
  }),
  degrade: (c) => ({
    arriere: '',
    avant:
      `<path d="M ${CX - 22} ${CY_TETE - 6} C ${CX - 23} ${CY_TETE - 31} ${CX + 23} ${CY_TETE - 31} ${CX + 22} ${CY_TETE - 6} L ${CX + 20} ${CY_TETE - 12} C ${CX + 10} ${CY_TETE - 22} ${CX - 10} ${CY_TETE - 22} ${CX - 20} ${CY_TETE - 12} Z" fill="${c}"/>` +
      `<rect x="${CX - 23}" y="${CY_TETE - 12}" width="4" height="12" rx="2" fill="${c}"/>` +
      `<rect x="${CX + 19}" y="${CY_TETE - 12}" width="4" height="12" rx="2" fill="${c}"/>`,
  }),
  chauve: () => ({ arriere: '', avant: '' }),
  degarnie: (c) => ({
    arriere: '',
    avant:
      `<path d="M ${CX - 23} ${CY_TETE - 2} C ${CX - 24} ${CY_TETE - 18} ${CX - 20} ${CY_TETE - 22} ${CX - 16} ${CY_TETE - 20} C ${CX - 20} ${CY_TETE - 12} ${CX - 21} ${CY_TETE - 8} ${CX - 21} ${CY_TETE - 2} Z" fill="${c}"/>` +
      `<path d="M ${CX + 23} ${CY_TETE - 2} C ${CX + 24} ${CY_TETE - 18} ${CX + 20} ${CY_TETE - 22} ${CX + 16} ${CY_TETE - 20} C ${CX + 20} ${CY_TETE - 12} ${CX + 21} ${CY_TETE - 8} ${CX + 21} ${CY_TETE - 2} Z" fill="${c}"/>`,
  }),
  foulard: (c) => ({
    arriere: '',
    avant:
      `<path d="M ${CX - 24} ${CY_TETE - 2} C ${CX - 26} ${CY_TETE - 32} ${CX + 26} ${CY_TETE - 32} ${CX + 24} ${CY_TETE - 2} C ${CX + 16} ${CY_TETE - 10} ${CX - 16} ${CY_TETE - 10} ${CX - 24} ${CY_TETE - 2} Z" fill="${c}"/>` +
      `<path d="M ${CX + 18} ${CY_TETE - 12} C ${CX + 30} ${CY_TETE - 10} ${CX + 32} ${CY_TETE + 2} ${CX + 26} ${CY_TETE + 8} C ${CX + 26} ${CY_TETE - 2} ${CX + 23} ${CY_TETE - 8} ${CX + 18} ${CY_TETE - 12} Z" fill="${c}" opacity="0.85"/>`,
  }),
};

// ──────────────────────────────────────────────────────────────── PILOSITÉ
const PILOSITE = {
  aucune: () => '',
  barbeNaissante: (c, forme) => {
    const { w, h, jaw } = VISAGES[forme];
    return `<path d="M ${CX - w + 1} ${CY_TETE + 2} C ${CX - w + 1} ${CY_TETE + h * 0.6} ${CX - jaw} ${CY_TETE + h} ${CX} ${CY_TETE + h} C ${CX + jaw} ${CY_TETE + h} ${CX + w - 1} ${CY_TETE + h * 0.6} ${CX + w - 1} ${CY_TETE + 2} C ${CX + 12} ${CY_TETE + 14} ${CX - 12} ${CY_TETE + 14} ${CX - w + 1} ${CY_TETE + 2} Z" fill="${c}" opacity="0.32"/>`;
  },
  moustache: (c) => `<path d="M ${CX - 9} ${CY_TETE + 12} C ${CX - 5} ${CY_TETE + 9} ${CX + 5} ${CY_TETE + 9} ${CX + 9} ${CY_TETE + 12} C ${CX + 5} ${CY_TETE + 14} ${CX - 5} ${CY_TETE + 14} ${CX - 9} ${CY_TETE + 12} Z" fill="${c}"/>`,
  bouc: (c) =>
    `<path d="M ${CX - 9} ${CY_TETE + 12} C ${CX - 5} ${CY_TETE + 9} ${CX + 5} ${CY_TETE + 9} ${CX + 9} ${CY_TETE + 12} C ${CX + 5} ${CY_TETE + 14} ${CX - 5} ${CY_TETE + 14} ${CX - 9} ${CY_TETE + 12} Z" fill="${c}"/>` +
    `<path d="M ${CX - 7} ${CY_TETE + 19} C ${CX - 4} ${CY_TETE + 17} ${CX + 4} ${CY_TETE + 17} ${CX + 7} ${CY_TETE + 19} C ${CX + 6} ${CY_TETE + 26} ${CX - 6} ${CY_TETE + 26} ${CX - 7} ${CY_TETE + 19} Z" fill="${c}"/>`,
  barbeCourte: (c, forme) => {
    const { w, h, jaw } = VISAGES[forme];
    return `<path d="M ${CX - w} ${CY_TETE + 1} C ${CX - w} ${CY_TETE + h * 0.62} ${CX - jaw} ${CY_TETE + h + 1} ${CX} ${CY_TETE + h + 1} C ${CX + jaw} ${CY_TETE + h + 1} ${CX + w} ${CY_TETE + h * 0.62} ${CX + w} ${CY_TETE + 1} C ${CX + 13} ${CY_TETE + 16} ${CX - 13} ${CY_TETE + 16} ${CX - w} ${CY_TETE + 1} Z" fill="${c}"/>`;
  },
  barbePleine: (c, forme) => {
    const { w, h, jaw } = VISAGES[forme];
    return `<path d="M ${CX - w - 1} ${CY_TETE - 6} C ${CX - w - 2} ${CY_TETE + h * 0.75} ${CX - jaw} ${CY_TETE + h + 5} ${CX} ${CY_TETE + h + 5} C ${CX + jaw} ${CY_TETE + h + 5} ${CX + w + 2} ${CY_TETE + h * 0.75} ${CX + w + 1} ${CY_TETE - 6} C ${CX + 15} ${CY_TETE + 15} ${CX - 15} ${CY_TETE + 15} ${CX - w - 1} ${CY_TETE - 6} Z" fill="${c}"/>`;
  },
};

// ───────────────────────────────────────────────────────────────── LUNETTES
const LUNETTES = {
  aucune: () => '',
  rectangulaires: () =>
    `<g fill="none" stroke="${TRAIT}" stroke-width="2.4">` +
    `<rect x="${CX - 21}" y="${CY_TETE - 6}" width="17" height="13" rx="3"/>` +
    `<rect x="${CX + 4}" y="${CY_TETE - 6}" width="17" height="13" rx="3"/>` +
    `<path d="M ${CX - 4} ${CY_TETE} L ${CX + 4} ${CY_TETE}"/></g>`,
  rondes: () =>
    `<g fill="none" stroke="${TRAIT}" stroke-width="2.4">` +
    `<circle cx="${CX - 12}" cy="${CY_TETE}" r="8.5"/>` +
    `<circle cx="${CX + 12}" cy="${CY_TETE}" r="8.5"/>` +
    `<path d="M ${CX - 3.5} ${CY_TETE} L ${CX + 3.5} ${CY_TETE}"/></g>`,
  protection: () =>
    `<path d="M ${CX - 23} ${CY_TETE - 7} L ${CX + 23} ${CY_TETE - 7} L ${CX + 22} ${CY_TETE + 7} C ${CX + 10} ${CY_TETE + 10} ${CX - 10} ${CY_TETE + 10} ${CX - 22} ${CY_TETE + 7} Z" fill="#cfe3f2" opacity="0.55" stroke="${TRAIT}" stroke-width="2.2" stroke-linejoin="round"/>`,
};

// ─────────────────────────────────────────────────────────────────── TENUES
//
// Les épaules sont toujours dessinées sur la même arche : c'est le second
// invariant qui tient la collection ensemble. Seuls le col et les détails
// changent.
function epaules(couleur) {
  return `<path d="M 12 128 C 14 104 34 92 64 92 C 94 92 114 104 116 128 Z" fill="${couleur}"/>`;
}

const TENUES_RENDU = {
  teeShirt: (c) => `${epaules(c)}<path d="M 55 92 C 58 100 70 100 73 92 C 70 98 58 98 55 92 Z" fill="${c}" opacity="0.5"/>`,
  polo: (c) =>
    `${epaules(c)}` +
    `<path d="M 55 92 L 64 106 L 73 92 L 68 91 L 64 99 L 60 91 Z" fill="#ffffff" opacity="0.9"/>` +
    `<rect x="${CX - 1.4}" y="100" width="2.8" height="16" rx="1.4" fill="#ffffff" opacity="0.55"/>`,
  chemise: (c) =>
    `${epaules(c)}` +
    `<path d="M 54 92 L 64 108 L 74 92 L 68 90 L 64 100 L 60 90 Z" fill="#ffffff"/>` +
    `<path d="M 56 93 L 64 107 L 60 93 Z" fill="${c}" opacity="0.35"/>`,
  blazer: (c) =>
    `${epaules(c)}` +
    `<path d="M 52 93 C 58 106 60 116 60 128 L 68 128 C 68 116 70 106 76 93 L 70 91 L 64 104 L 58 91 Z" fill="#eef2f7"/>` +
    `<path d="M 52 93 C 57 104 58 116 58 128 L 50 128 C 49 112 49 100 52 93 Z" fill="${c}" opacity="0.75"/>` +
    `<path d="M 76 93 C 71 104 70 116 70 128 L 78 128 C 79 112 79 100 76 93 Z" fill="${c}" opacity="0.75"/>`,
  gilet: (c) =>
    `${epaules(TENUES.ardoise)}` +
    `<path d="M 20 128 C 22 106 38 95 56 93 L 56 128 Z" fill="${c}"/>` +
    `<path d="M 108 128 C 106 106 90 95 72 93 L 72 128 Z" fill="${c}"/>` +
    `<rect x="20" y="112" width="88" height="5" fill="#e9eef4" opacity="0.85"/>`,
  polaire: (c) =>
    `${epaules(c)}` +
    `<path d="M 56 92 C 58 104 58 116 58 128 L 70 128 C 70 116 70 104 72 92 Z" fill="${c}"/>` +
    `<rect x="${CX - 1.2}" y="94" width="2.4" height="34" fill="#eef2f7" opacity="0.7"/>` +
    `<path d="M 56 92 C 60 96 68 96 72 92 L 72 96 C 68 100 60 100 56 96 Z" fill="#eef2f7" opacity="0.55"/>`,
  chemiseTravail: (c) =>
    `${epaules(c)}` +
    `<path d="M 54 92 L 64 106 L 74 92 L 69 90 L 64 99 L 59 90 Z" fill="${c}"/>` +
    `<path d="M 54 92 L 64 106 L 74 92" fill="none" stroke="#0f1720" stroke-width="1.6" opacity="0.35"/>` +
    `<rect x="80" y="104" width="11" height="9" rx="1.6" fill="#0f1720" opacity="0.18"/>`,
};

// ────────────────────────────────────────────────────────────── EXPRESSIONS
const BOUCHES = {
  neutre: `<path d="M ${CX - 6} ${CY_TETE + 15} L ${CX + 6} ${CY_TETE + 15}" stroke="${TRAIT}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`,
  sourire: `<path d="M ${CX - 7} ${CY_TETE + 13} C ${CX - 3} ${CY_TETE + 18} ${CX + 3} ${CY_TETE + 18} ${CX + 7} ${CY_TETE + 13}" stroke="${TRAIT}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`,
  sourireLarge: `<path d="M ${CX - 8} ${CY_TETE + 13} C ${CX - 4} ${CY_TETE + 20} ${CX + 4} ${CY_TETE + 20} ${CX + 8} ${CY_TETE + 13} Z" fill="${TRAIT}"/>`,
  calme: `<path d="M ${CX - 6} ${CY_TETE + 14} C ${CX - 2} ${CY_TETE + 16} ${CX + 2} ${CY_TETE + 16} ${CX + 6} ${CY_TETE + 14}" stroke="${TRAIT}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`,
};

// ─────────────────────────────────────────────────────── ASSEMBLAGE D'UN SVG
function construireAvatar(spec) {
  const peau = CARNATIONS[spec.carnation];
  const cheveux = teinteCheveux(spec.couleurCheveux);
  const coiffure = COIFFURES[spec.coiffure](spec.coiffure === 'foulard' ? TENUES[spec.couleurTenue] : cheveux);
  const tete = cheminTete(spec.visage);
  const { h } = VISAGES[spec.visage];

  const sourcils = `<g stroke="${cheveux}" stroke-width="2.6" stroke-linecap="round">
    <path d="M ${CX - 18} ${CY_TETE - 9} C ${CX - 15} ${CY_TETE - 12} ${CX - 9} ${CY_TETE - 12} ${CX - 6} ${CY_TETE - 10}" fill="none"/>
    <path d="M ${CX + 6} ${CY_TETE - 10} C ${CX + 9} ${CY_TETE - 12} ${CX + 15} ${CY_TETE - 12} ${CX + 18} ${CY_TETE - 9}" fill="none"/>
  </g>`;

  const yeux = `<g fill="${TRAIT}">
    <ellipse cx="${CX - 12}" cy="${CY_TETE}" rx="2.6" ry="3"/>
    <ellipse cx="${CX + 12}" cy="${CY_TETE}" rx="2.6" ry="3"/>
  </g>`;

  const nez = `<path d="M ${CX - 2} ${CY_TETE + 7} C ${CX - 2} ${CY_TETE + 10} ${CX + 2} ${CY_TETE + 10} ${CX + 2.5} ${CY_TETE + 8}" stroke="${peau.ombre}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;

  const oreilles = `<g fill="${peau.base}">
    <ellipse cx="${CX - 23}" cy="${CY_TETE + 3}" rx="4" ry="5.5"/>
    <ellipse cx="${CX + 23}" cy="${CY_TETE + 3}" rx="4" ry="5.5"/>
  </g>`;

  const cou = `<path d="M ${CX - 8} ${CY_TETE + h - 4} L ${CX - 8} 96 L ${CX + 8} 96 L ${CX + 8} ${CY_TETE + h - 4} Z" fill="${peau.ombre}"/>`;

  const pilosite = PILOSITE[spec.pilosite](cheveux, spec.visage);
  const lunettes = LUNETTES[spec.lunettes]();
  const tenue = TENUES_RENDU[spec.tenue](TENUES[spec.couleurTenue]);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="Avatar ${spec.id}">
<circle cx="64" cy="64" r="64" fill="${FONDS[spec.fond]}"/>
<g clip-path="url(#r)">
${coiffure.arriere}
${cou}
${tenue}
${oreilles}
<path d="${tete}" fill="${peau.base}"/>
${sourcils}
${yeux}
${nez}
${BOUCHES[spec.bouche]}
${pilosite}
${coiffure.avant}
${lunettes}
</g>
<clipPath id="r"><circle cx="64" cy="64" r="64"/></clipPath>
</svg>`;
}

// ══════════════════════════════════════════════ LES CINQUANTE AVATARS
//
// Table écrite à la main, et non tirée au sort. Un tirage produit des grappes :
// six barbus d'affilée, aucune carnation foncée avec des lunettes, trois
// coiffures identiques. La représentation se compose, elle ne s'improvise pas.
//
// `t` porte les traits exposés à la galerie pour le filtrage.
const SPECS = [
  { visage: 'ovale',   carnation: 'c1', coiffure: 'courte',        couleurCheveux: 'brunFonce',  pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'polo',           couleurTenue: 'bleu',       bouche: 'sourire',      fond: 'f1' },
  { visage: 'carre',   carnation: 'c5', coiffure: 'rase',          couleurCheveux: 'noir',       pilosite: 'barbeCourte',     lunettes: 'aucune',         tenue: 'chemiseTravail', couleurTenue: 'ardoise',    bouche: 'calme',        fond: 'f2' },
  { visage: 'effile',  carnation: 'c2', coiffure: 'longueOndulee', couleurCheveux: 'chataigne',  pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'blazer',         couleurTenue: 'marine',     bouche: 'sourire',      fond: 'f5' },
  { visage: 'rond',    carnation: 'c7', coiffure: 'afro',          couleurCheveux: 'noir',       pilosite: 'aucune',          lunettes: 'rondes',         tenue: 'teeShirt',       couleurTenue: 'sarcelle',   bouche: 'sourireLarge', fond: 'f3' },
  { visage: 'ovale',   carnation: 'c3', coiffure: 'raie',          couleurCheveux: 'brun',       pilosite: 'moustache',       lunettes: 'aucune',         tenue: 'chemise',        couleurTenue: 'blanc',      bouche: 'neutre',       fond: 'f6' },
  { visage: 'carre',   carnation: 'c8', coiffure: 'locks',         couleurCheveux: 'noir',       pilosite: 'barbeCourte',     lunettes: 'aucune',         tenue: 'polaire',        couleurTenue: 'anthracite', bouche: 'calme',        fond: 'f4' },
  { visage: 'effile',  carnation: 'c1', coiffure: 'chignon',       couleurCheveux: 'blond',      pilosite: 'aucune',          lunettes: 'rectangulaires', tenue: 'blazer',         couleurTenue: 'bordeaux',   bouche: 'sourire',      fond: 'f7' },
  { visage: 'rond',    carnation: 'c4', coiffure: 'bouclee',       couleurCheveux: 'brunFonce',  pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'polo',           couleurTenue: 'foret',      bouche: 'sourire',      fond: 'f8' },
  { visage: 'ovale',   carnation: 'c6', coiffure: 'tresses',       couleurCheveux: 'noir',       pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'chemise',        couleurTenue: 'lavande',    bouche: 'sourireLarge', fond: 'f1' },
  { visage: 'carre',   carnation: 'c2', coiffure: 'degarnie',      couleurCheveux: 'gris',       pilosite: 'barbePleine',     lunettes: 'rectangulaires', tenue: 'gilet',          couleurTenue: 'hiVis',      bouche: 'calme',        fond: 'f2' },

  { visage: 'ovale',   carnation: 'c3', coiffure: 'carreCourt',    couleurCheveux: 'auburn',     pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'teeShirt',       couleurTenue: 'brique',     bouche: 'sourire',      fond: 'f4' },
  { visage: 'rond',    carnation: 'c1', coiffure: 'degrade',       couleurCheveux: 'brun',       pilosite: 'barbeNaissante',  lunettes: 'aucune',         tenue: 'polaire',        couleurTenue: 'marine',     bouche: 'neutre',       fond: 'f6' },
  { visage: 'effile',  carnation: 'c7', coiffure: 'crepue',        couleurCheveux: 'noir',       pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'blazer',         couleurTenue: 'sarcelle',   bouche: 'sourire',      fond: 'f3' },
  { visage: 'carre',   carnation: 'c4', coiffure: 'chauve',        couleurCheveux: 'noir',       pilosite: 'bouc',            lunettes: 'aucune',         tenue: 'chemiseTravail', couleurTenue: 'ardoise',    bouche: 'calme',        fond: 'f2' },
  { visage: 'ovale',   carnation: 'c5', coiffure: 'queue',         couleurCheveux: 'brunFonce',  pilosite: 'aucune',          lunettes: 'rondes',         tenue: 'chemise',        couleurTenue: 'blanc',      bouche: 'sourire',      fond: 'f5' },
  { visage: 'rond',    carnation: 'c2', coiffure: 'ondulee',       couleurCheveux: 'roux',       pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'polo',           couleurTenue: 'bleu',       bouche: 'sourireLarge', fond: 'f7' },
  { visage: 'effile',  carnation: 'c8', coiffure: 'longueRaide',   couleurCheveux: 'noir',       pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'blazer',         couleurTenue: 'anthracite', bouche: 'calme',        fond: 'f1' },
  { visage: 'carre',   carnation: 'c3', coiffure: 'courte',        couleurCheveux: 'gris',       pilosite: 'barbeCourte',     lunettes: 'rectangulaires', tenue: 'chemise',        couleurTenue: 'gris',       bouche: 'neutre',       fond: 'f8' },
  { visage: 'ovale',   carnation: 'c6', coiffure: 'foulard',       couleurCheveux: 'noir',       pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'teeShirt',       couleurTenue: 'bordeaux',   bouche: 'sourire',      fond: 'f4' },
  { visage: 'rond',    carnation: 'c1', coiffure: 'rase',          couleurCheveux: 'blondClair', pilosite: 'aucune',          lunettes: 'protection',     tenue: 'gilet',          couleurTenue: 'hiVis',      bouche: 'calme',        fond: 'f6' },

  { visage: 'effile',  carnation: 'c4', coiffure: 'chignon',       couleurCheveux: 'brunFonce',  pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'chemise',        couleurTenue: 'sarcelle',   bouche: 'sourire',      fond: 'f3' },
  { visage: 'carre',   carnation: 'c7', coiffure: 'locks',         couleurCheveux: 'brun',       pilosite: 'bouc',            lunettes: 'aucune',         tenue: 'polo',           couleurTenue: 'foret',      bouche: 'sourire',      fond: 'f5' },
  { visage: 'ovale',   carnation: 'c2', coiffure: 'longueOndulee', couleurCheveux: 'blond',      pilosite: 'aucune',          lunettes: 'rectangulaires', tenue: 'blazer',         couleurTenue: 'lavande',    bouche: 'calme',        fond: 'f7' },
  { visage: 'rond',    carnation: 'c5', coiffure: 'bouclee',       couleurCheveux: 'noir',       pilosite: 'barbeNaissante',  lunettes: 'aucune',         tenue: 'polaire',        couleurTenue: 'ardoise',    bouche: 'neutre',       fond: 'f2' },
  { visage: 'effile',  carnation: 'c1', coiffure: 'carreCourt',    couleurCheveux: 'argent',     pilosite: 'aucune',          lunettes: 'rondes',         tenue: 'chemise',        couleurTenue: 'blanc',      bouche: 'sourire',      fond: 'f1' },
  { visage: 'carre',   carnation: 'c6', coiffure: 'crepue',        couleurCheveux: 'noir',       pilosite: 'barbePleine',     lunettes: 'aucune',         tenue: 'chemiseTravail', couleurTenue: 'marine',     bouche: 'calme',        fond: 'f8' },
  { visage: 'ovale',   carnation: 'c3', coiffure: 'queue',         couleurCheveux: 'chataigne',  pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'teeShirt',       couleurTenue: 'bleu',       bouche: 'sourireLarge', fond: 'f4' },
  { visage: 'rond',    carnation: 'c8', coiffure: 'tresses',       couleurCheveux: 'noir',       pilosite: 'aucune',          lunettes: 'rectangulaires', tenue: 'blazer',         couleurTenue: 'bordeaux',   bouche: 'sourire',      fond: 'f6' },
  { visage: 'carre',   carnation: 'c2', coiffure: 'degrade',       couleurCheveux: 'noir',       pilosite: 'barbeCourte',     lunettes: 'aucune',         tenue: 'polo',           couleurTenue: 'anthracite', bouche: 'neutre',       fond: 'f3' },
  { visage: 'effile',  carnation: 'c4', coiffure: 'ondulee',       couleurCheveux: 'brun',       pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'chemise',        couleurTenue: 'gris',       bouche: 'sourire',      fond: 'f5' },

  { visage: 'ovale',   carnation: 'c7', coiffure: 'rase',          couleurCheveux: 'noir',       pilosite: 'moustache',       lunettes: 'rondes',         tenue: 'polaire',        couleurTenue: 'sarcelle',   bouche: 'calme',        fond: 'f7' },
  { visage: 'rond',    carnation: 'c1', coiffure: 'longueRaide',   couleurCheveux: 'brunFonce',  pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'teeShirt',       couleurTenue: 'lavande',    bouche: 'sourire',      fond: 'f2' },
  { visage: 'carre',   carnation: 'c5', coiffure: 'chauve',        couleurCheveux: 'gris',       pilosite: 'barbePleine',     lunettes: 'aucune',         tenue: 'gilet',          couleurTenue: 'hiVis',      bouche: 'calme',        fond: 'f1' },
  { visage: 'effile',  carnation: 'c3', coiffure: 'chignon',       couleurCheveux: 'auburn',     pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'blazer',         couleurTenue: 'foret',      bouche: 'sourire',      fond: 'f8' },
  { visage: 'ovale',   carnation: 'c6', coiffure: 'afro',          couleurCheveux: 'brunFonce',  pilosite: 'barbeNaissante',  lunettes: 'aucune',         tenue: 'chemiseTravail', couleurTenue: 'brique',     bouche: 'sourire',      fond: 'f4' },
  { visage: 'rond',    carnation: 'c2', coiffure: 'courte',        couleurCheveux: 'blondClair', pilosite: 'aucune',          lunettes: 'rectangulaires', tenue: 'chemise',        couleurTenue: 'blanc',      bouche: 'neutre',       fond: 'f6' },
  { visage: 'carre',   carnation: 'c8', coiffure: 'degrade',       couleurCheveux: 'noir',       pilosite: 'bouc',            lunettes: 'protection',     tenue: 'gilet',          couleurTenue: 'hiVis',      bouche: 'calme',        fond: 'f3' },
  { visage: 'effile',  carnation: 'c4', coiffure: 'carreCourt',    couleurCheveux: 'roux',       pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'polo',           couleurTenue: 'bleu',       bouche: 'sourireLarge', fond: 'f5' },
  { visage: 'ovale',   carnation: 'c1', coiffure: 'raie',          couleurCheveux: 'argent',     pilosite: 'moustache',       lunettes: 'rectangulaires', tenue: 'blazer',         couleurTenue: 'marine',     bouche: 'calme',        fond: 'f7' },
  { visage: 'rond',    carnation: 'c7', coiffure: 'locks',         couleurCheveux: 'noir',       pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'polaire',        couleurTenue: 'ardoise',    bouche: 'sourire',      fond: 'f2' },

  { visage: 'carre',   carnation: 'c3', coiffure: 'ondulee',       couleurCheveux: 'gris',       pilosite: 'barbeCourte',     lunettes: 'aucune',         tenue: 'chemise',        couleurTenue: 'gris',       bouche: 'neutre',       fond: 'f1' },
  { visage: 'effile',  carnation: 'c5', coiffure: 'tresses',       couleurCheveux: 'brun',       pilosite: 'aucune',          lunettes: 'rondes',         tenue: 'teeShirt',       couleurTenue: 'sarcelle',   bouche: 'sourire',      fond: 'f8' },
  { visage: 'ovale',   carnation: 'c2', coiffure: 'queue',         couleurCheveux: 'noir',       pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'chemiseTravail', couleurTenue: 'foret',      bouche: 'calme',        fond: 'f4' },
  { visage: 'rond',    carnation: 'c6', coiffure: 'crepue',        couleurCheveux: 'auburn',     pilosite: 'aucune',          lunettes: 'rectangulaires', tenue: 'blazer',         couleurTenue: 'bordeaux',   bouche: 'sourire',      fond: 'f6' },
  { visage: 'carre',   carnation: 'c1', coiffure: 'degarnie',      couleurCheveux: 'argent',     pilosite: 'barbePleine',     lunettes: 'aucune',         tenue: 'polo',           couleurTenue: 'anthracite', bouche: 'calme',        fond: 'f3' },
  { visage: 'effile',  carnation: 'c8', coiffure: 'longueOndulee', couleurCheveux: 'noir',       pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'chemise',        couleurTenue: 'lavande',    bouche: 'sourireLarge', fond: 'f5' },
  { visage: 'ovale',   carnation: 'c4', coiffure: 'bouclee',       couleurCheveux: 'chataigne',  pilosite: 'barbeNaissante',  lunettes: 'aucune',         tenue: 'polaire',        couleurTenue: 'brique',     bouche: 'sourire',      fond: 'f7' },
  { visage: 'rond',    carnation: 'c3', coiffure: 'foulard',       couleurCheveux: 'brunFonce',  pilosite: 'aucune',          lunettes: 'aucune',         tenue: 'teeShirt',       couleurTenue: 'sarcelle',   bouche: 'sourire',      fond: 'f2' },
  { visage: 'carre',   carnation: 'c7', coiffure: 'rase',          couleurCheveux: 'noir',       pilosite: 'barbeCourte',     lunettes: 'protection',     tenue: 'gilet',          couleurTenue: 'hiVis',      bouche: 'calme',        fond: 'f1' },
  { visage: 'effile',  carnation: 'c2', coiffure: 'carreCourt',    couleurCheveux: 'blond',      pilosite: 'aucune',          lunettes: 'rondes',         tenue: 'blazer',         couleurTenue: 'marine',     bouche: 'sourire',      fond: 'f8' },
];

// ────────────────────────────────────────────────── ÉTIQUETTES DE FILTRAGE
const FAMILLE_COIFFURE = {
  rase: 'courts', courte: 'courts', raie: 'courts', degrade: 'courts',
  chauve: 'courts', degarnie: 'courts',
  ondulee: 'ondules', bouclee: 'boucles', crepue: 'crepus', afro: 'crepus',
  locks: 'locks', tresses: 'tresses',
  chignon: 'attaches', queue: 'attaches', foulard: 'attaches',
  longueRaide: 'longs', longueOndulee: 'longs', carreCourt: 'longs',
};

function construireCatalogue(specs) {
  const lignes = specs.map((s) => {
    const traits = [
      `coiffure: '${FAMILLE_COIFFURE[s.coiffure]}'`,
      `carnation: '${s.carnation}'`,
      `lunettes: ${s.lunettes !== 'aucune'}`,
      `pilosite: ${s.pilosite !== 'aucune'}`,
      `tenue: '${s.tenue}'`,
    ].join(', ');
    return `  { id: '${s.id}', ${traits} },`;
  });

  return `/**
 * Catalogue des avatars REZO360 — GÉNÉRÉ, ne pas modifier à la main.
 *
 * Produit par \`scripts/generate-avatars.mjs\`, en même temps que les SVG de
 * \`public/avatars/\`. Les deux sorties viennent de la même table : un
 * identifiant ne peut donc pas exister ici sans son fichier, ni l'inverse.
 *
 * Pour changer la collection, éditer le script puis relancer :
 *   node scripts/generate-avatars.mjs
 */

/** Familles de coiffure, telles qu'exposées aux filtres de la galerie. */
export type FamilleCoiffure =
  | 'courts'
  | 'ondules'
  | 'boucles'
  | 'crepus'
  | 'locks'
  | 'tresses'
  | 'attaches'
  | 'longs';

export interface AvatarCatalogue {
  id: string;
  coiffure: FamilleCoiffure;
  /** Identifiant de carnation, de la plus claire (c1) à la plus profonde (c8). */
  carnation: string;
  lunettes: boolean;
  pilosite: boolean;
  tenue: string;
}

export const AVATARS: readonly AvatarCatalogue[] = [
${lignes.join('\n')}
];

/** Identifiant retenu quand aucun choix n'a été fait, ni aucun repli possible. */
export const AVATAR_PAR_DEFAUT = '${specs[0].id}';

const IDS = new Set(AVATARS.map((a) => a.id));

/** L'identifiant désigne-t-il un avatar de la collection courante ? */
export function estAvatarConnu(id: string | null | undefined): id is string {
  return typeof id === 'string' && IDS.has(id);
}

/**
 * Chemin du fichier SVG. Statique et servi par le CDN : aucun appel réseau
 * applicatif, et le navigateur le met en cache comme n'importe quelle image.
 */
export function cheminAvatar(id: string): string {
  return \`/avatars/\${id}.svg\`;
}
`;
}

// ──────────────────────────────────────────────────────────────── EXÉCUTION
const specs = SPECS.map((s, i) => ({ ...s, id: `avatar-${String(i + 1).padStart(2, '0')}` }));

if (specs.length !== 50) {
  throw new Error(`La table doit décrire exactement 50 avatars, elle en décrit ${specs.length}.`);
}

// Le dossier est VIDÉ avant écriture : sans cela, un ancien fichier survivrait
// à un changement de nommage et la galerie afficherait un avatar retiré.
mkdirSync(DOSSIER_SVG, { recursive: true });
for (const fichier of readdirSync(DOSSIER_SVG)) {
  rmSync(join(DOSSIER_SVG, fichier), { force: true });
}

let total = 0;
for (const spec of specs) {
  const svg = construireAvatar(spec);
  writeFileSync(join(DOSSIER_SVG, `${spec.id}.svg`), svg, 'utf8');
  total += Buffer.byteLength(svg, 'utf8');
}

writeFileSync(FICHIER_CATALOGUE, construireCatalogue(specs), 'utf8');

console.log(`${specs.length} avatars écrits dans public/avatars/`);
console.log(`Poids total : ${(total / 1024).toFixed(1)} Ko — moyenne ${(total / specs.length).toFixed(0)} octets`);
console.log(`Catalogue : src/config/avatars.ts`);

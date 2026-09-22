import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONTRASTE_ELEVE_PRESET } from '@/features/theme/theme-presets';

/**
 * Le contraste de la palette, mesuré sur TOUTES les surfaces.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE TEST EXISTE
 *
 * Deux défauts ont vécu des mois dans la feuille de styles, sans qu'aucun
 * outil ne les voie :
 *
 * - `--border-strong` borde les cases, poignées et contrôles compacts.
 *   WCAG 1.4.11 lui impose 3:1 contre la surface qui le porte. Il tenait
 *   1,76:1 en clair et 1,46:1 en sombre.
 *
 * - `--subtle-foreground` du thème sombre portait le commentaire « 4,93:1
 *   minimum ». Le chiffre était exact — mais mesuré contre `--surface`
 *   seulement. Contre `--surface-hover`, la plus claire des six, il tombait à
 *   3,99:1.
 *
 * Le second cas dit tout : la relecture ne suffit pas, parce qu'on vérifie la
 * surface à laquelle on pense, et jamais les cinq autres. Ce test les croise
 * toutes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/*
  Lecture du fichier sur le disque, et non par import.

  Vitest traite `index.css` via Tailwind : les `@theme` et les variables y sont
  transformés, et `?raw` ne rend rien d'exploitable. Le dépôt est en CRLF, d'où
  la normalisation.
*/
const CSS = readFileSync(join(process.cwd(), 'src', 'styles', 'index.css'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

/** Extrait les couleurs hexadécimales du bloc ouvert par ce sélecteur. */
function lireBloc(selecteur: string, nomLisible: string): Record<string, string> {
  const depart = CSS.indexOf(selecteur);
  if (depart === -1) throw new Error(`Bloc « ${nomLisible} » introuvable dans index.css`);

  const ouvrante = CSS.indexOf('{', depart);
  let profondeur = 0;
  let fin = -1;
  for (let i = ouvrante; i < CSS.length; i += 1) {
    if (CSS[i] === '{') profondeur += 1;
    else if (CSS[i] === '}') {
      profondeur -= 1;
      if (profondeur === 0) {
        fin = i;
        break;
      }
    }
  }
  if (fin === -1) throw new Error(`Fin du bloc « ${nomLisible} » introuvable`);

  const variables: Record<string, string> = {};
  for (const ligne of CSS.slice(ouvrante + 1, fin).matchAll(
    /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g,
  )) {
    const nom = ligne[1];
    const valeur = ligne[2];
    if (nom !== undefined && valeur !== undefined) variables[nom] = valeur;
  }
  return variables;
}

function luminance(hex: string): number {
  const canal = (paire: string) => {
    const v = parseInt(paire, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const corps = hex.replace('#', '');
  return (
    0.2126 * canal(corps.slice(0, 2)) +
    0.7152 * canal(corps.slice(2, 4)) +
    0.0722 * canal(corps.slice(4, 6))
  );
}

function contraste(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Les six fonds sur lesquels un texte peut atterrir. */
const SURFACES = [
  '--surface',
  '--surface-raised',
  '--background',
  '--surface-subtle',
  '--surface-hover',
  '--surface-sunken',
] as const;

/** Chaque encre, avec le seuil que lui impose son usage. */
const ENCRES: readonly (readonly [string, number, string])[] = [
  ['--foreground', 4.5, 'texte courant'],
  ['--muted-foreground', 4.5, 'texte secondaire'],
  ['--subtle-foreground', 4.5, 'texte tertiaire'],
  ['--primary', 4.5, 'liens et actions'],
  ['--accent', 4.5, 'accent de marque'],
  ['--success', 4.5, 'libellé de succès'],
  ['--warning', 4.5, 'libellé d’avertissement'],
  ['--error', 4.5, 'libellé d’erreur'],
  ['--info', 4.5, 'libellé d’information'],
  // WCAG 1.4.11 : la bordure d'un contrôle n'est pas du texte, mais elle
  // délimite un élément d'interface. Seuil 3:1, pas 4,5:1.
  ['--border-strong', 3, 'bordure des contrôles compacts'],
];

const THEMES = [
  [':root,', 'Atelier Jour'],
  ['.dark {', 'Atelier Nuit'],
] as const;

describe.each([
  ['Jour', lireBloc(':root,', 'Jour'), 4.5],
  ['Nuit', lireBloc('.dark {', 'Nuit'), 4.5],
  ['Contraste élevé', CONTRASTE_ELEVE_PRESET.variables, 7],
] as const)('Atelier — aplats colorés %s', (nom, v, seuil) => {
  it.each([
    ['--action', '--action-foreground'],
    ['--action-hover', '--action-foreground'],
    ['--action-active', '--action-foreground'],
    ['--nav-selected', '--nav-foreground'],
    ['--workspace-selected', '--workspace-foreground'],
    ['--settings-selected', '--settings-foreground'],
  ])('%s garde une encre lisible', (fond, encre) => {
    expect(v[fond], `${nom} ${fond}`).toMatch(/^#[0-9a-f]{6}$/i);
    expect(v[encre], `${nom} ${encre}`).toMatch(/^#[0-9a-f]{6}$/i);
    expect(contraste(v[fond] ?? '', v[encre] ?? '')).toBeGreaterThanOrEqual(seuil);
  });
});

describe.each(THEMES)('palette — %s', (selecteur, nom) => {
  const v = lireBloc(selecteur, nom);

  it('déclare les six surfaces et toutes les encres', () => {
    // Un jeton absent ferait passer les croisements ci-dessous en silence :
    // `undefined` ne se compare à aucun seuil, et `it.each` ne boucle sur rien.
    for (const surface of SURFACES) {
      expect(v[surface], `${nom} : ${surface} manquant`).toMatch(/^#[0-9a-f]{6}$/i);
    }
    for (const [encre] of ENCRES) {
      expect(v[encre], `${nom} : ${encre} manquant`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(ENCRES)('%s tient son seuil sur les six surfaces', (encre, seuil, usage) => {
    const couleur = v[encre];
    expect(couleur, `${encre} manquant`).toBeDefined();

    for (const surface of SURFACES) {
      const fond = v[surface];
      expect(fond, `${surface} manquant`).toBeDefined();
      if (couleur === undefined || fond === undefined) continue;

      expect(
        contraste(couleur, fond),
        `${nom} — ${usage} (${encre} ${couleur}) sur ${surface} (${fond})`,
      ).toBeGreaterThanOrEqual(seuil);
    }
  });

  it('garde sa profondeur cohérente', () => {
    /*
      Les six surfaces ne se rangent PAS dans le même ordre d'un thème à
      l'autre, et c'est voulu : en sombre, élever une surface l'éclaircit, donc
      `--surface-hover` y est la plus claire des six, alors qu'en clair elle
      est plus sombre que la carte qu'elle survole.

      Ce qui doit tenir dans les deux, ce sont les rapports — pas l'ordre
      absolu. En résolvant des contrastes on déplace des luminosités, et rien
      ne signale qu'on vient d'inverser deux barreaux.
    */
    const L = (cle: string) => {
      const couleur = v[cle];
      expect(couleur, `${cle} manquant`).toBeDefined();
      return luminance(couleur ?? '#000000');
    };

    // Une carte se détache toujours de la page, dans les deux thèmes.
    expect(L('--surface'), 'la carte doit se détacher du fond').toBeGreaterThan(L('--background'));

    // `raised` est au-dessus de `surface`, jamais en dessous.
    expect(L('--surface-raised'), 'surface-raised sous surface').toBeGreaterThanOrEqual(
      L('--surface'),
    );

    // `sunken` est le creux : la plus sombre des six, partout.
    const toutes = SURFACES.map((cle) => L(cle));
    expect(L('--surface-sunken'), 'surface-sunken n’est pas la plus creusée').toBe(
      Math.min(...toutes),
    );

    /*
      Le survol doit se voir. Une valeur trop proche de `--surface` produit un
      état qui existe dans le code et pas à l'écran — la panne la plus difficile
      à remarquer, puisque rien ne manque : il ne se passe simplement rien.
    */
    expect(
      contraste(v['--surface-hover'] ?? '#000000', v['--surface'] ?? '#000000'),
      'le survol ne se distingue pas de la surface',
    ).toBeGreaterThan(1.05);
  });
});

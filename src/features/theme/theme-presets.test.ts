import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ATELIER_NUIT_PRESET,
  DEFAULT_THEME_PRESET,
  THEME_PRESETS,
  THEMES_RETIRES,
} from './theme-presets';
import { BROWSER_BAR_COLOR } from './theme-script';

/**
 * Les préréglages signature doivent refléter les blocs CSS, à la valeur près.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE TEST EXISTE
 *
 * Un préréglage pose ses variables EN LIGNE sur `<html>`. Une variable inline
 * l'emporte sur toute feuille de style : quand le préréglage et le bloc CSS
 * divergent, c'est le préréglage qui s'applique, et le bloc ne sert plus à
 * rien.
 *
 * C'est arrivé le 07/09/2026. La palette sombre est passée de l'ardoise au
 * marine dans `index.css` ; `theme-presets.ts` est resté en arrière. Pendant
 * vingt-quatre heures la repalette n'a EU AUCUN EFFET dès que le thème sombre
 * était choisi — c'est-à-dire toujours, en sombre. Aucune erreur, aucun
 * avertissement : seulement une barre supérieure anthracite au-dessus d'un
 * contenu marine, que rien ne permettait de relier à sa cause.
 *
 * Modifier l'un sans l'autre ne casse rien et ne signale rien. Ce test est la
 * seule chose qui le signale.
 *
 * Il ne vérifie QUE les variables que le préréglage déclare : celles qu'il
 * laisse au CSS n'ont aucun conflit possible, et les exiger obligerait à
 * recopier la palette entière à chaque nouveau jeton.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/*
  LU PAR `node:fs`, PAS PAR L'IMPORT `?raw` DE VITE.

  La configuration Vitest pose `css: false` : les imports de feuilles de style
  sont neutralisés, et `?raw` ne rend rien d'exploitable. Un test qui
  comparerait à une chaîne vide serait vert en permanence — exactement le
  genre de garde-fou qui rassure sans rien garder.

  Le dépôt est en CRLF, d'où la normalisation.
*/
const CSS = readFileSync(join(process.cwd(), 'src', 'styles', 'index.css'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

/** Extrait les paires `--nom: valeur;` du bloc ouvert par ce sélecteur. */
function lireBloc(selecteur: RegExp, nomLisible: string): Record<string, string> {
  const trouve = selecteur.exec(CSS);
  if (trouve === null) {
    throw new Error(`Bloc « ${nomLisible} » introuvable dans index.css`);
  }

  const ouvrante = CSS.indexOf('{', trouve.index);
  const fin = CSS.indexOf('\n  }', ouvrante);
  if (fin === -1) {
    throw new Error(`Fin du bloc « ${nomLisible} » introuvable`);
  }

  const variables: Record<string, string> = {};
  for (const paire of CSS.slice(ouvrante + 1, fin).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    variables[paire[1] as string] = (paire[2] as string).trim();
  }
  return variables;
}

describe('préréglages de thème, miroirs des blocs CSS', () => {
  const clair = lireBloc(/:root,\s*\.theme-jour-verrouille\s*\{/, ':root');
  const sombre = lireBloc(/\n\s*\.dark\s*\{/, '.dark');

  it('lit bien les deux blocs', () => {
    // Si le parseur casse, tout le reste comparerait des objets vides — le pire
    // des verdicts, puisqu'il serait vert.
    expect(Object.keys(clair).length).toBeGreaterThan(20);
    expect(Object.keys(sombre).length).toBeGreaterThan(20);
    expect(clair['--background']).toBe('#f7f8fa');
    expect(sombre['--background']).toBe('#1c2947');
  });

  it('les thèmes signature ne redéclarent aucune variable', () => {
    /*
      L'INVARIANT S'EST INVERSÉ, ET C'EST UN PROGRÈS.

      Ces valeurs étaient recopiées ici à l'identique des blocs `:root` et
      `.dark`, et deux tests vérifiaient qu'elles ne divergeaient pas. Une
      garantie utile, mais qui surveillait un problème au lieu de le
      supprimer : le préréglage posant ses variables EN STYLE INLINE sur
      `<html>`, il l'emportait sur la feuille de style.

      Il n'y a plus qu'une source. Les tests d'égalité passeraient désormais à
      vide — sur un objet sans clé, `for...of` ne boucle pas et n'affirme
      rien. Ils sont donc remplacés par ce qu'il faut réellement tenir.
    */
    expect(Object.keys(DEFAULT_THEME_PRESET.variables)).toEqual([]);
    expect(Object.keys(ATELIER_NUIT_PRESET.variables)).toEqual([]);
  });

  it('la coque publique hérite de la nouvelle typographie globale', () => {
    const coquePublique = lireBloc(
      /\.public-shell,\s*\.theme-jour-verrouille\s*\{/,
      '.public-shell',
    );

    expect(CSS).toMatch(/--font-sans:\s*'Nunito'/);
    expect(CSS).toMatch(/--font-display:\s*'Nunito'/);
    expect(coquePublique['--font-sans']).toBeUndefined();
    expect(coquePublique['--font-display']).toBeUndefined();
  });

  it('Atelier Nuit reste bleu ardoise sans surface ni ombre noire', () => {
    expect(
      [
        '--background',
        '--surface',
        '--surface-raised',
        '--surface-sunken',
        '--surface-subtle',
        '--surface-hover',
      ].map((token) => sombre[token]),
    ).toEqual(['#1c2947', '#243150', '#26324f', '#182541', '#222f4e', '#283654']);

    for (const shadow of ['--shadow-raised', '--shadow-overlay', '--shadow-modal']) {
      expect(sombre[shadow], shadow).not.toContain('0 0 0');
    }
  });

  it('le contraste élevé, lui, déclare bien ses variables', () => {
    // Seul thème à s'écarter volontairement de la feuille : s'il n'appliquait
    // rien, il serait identique au thème clair sans que rien ne le signale.
    const contraste = THEME_PRESETS.find((p) => p.id === 'contraste-eleve');
    expect(contraste).toBeDefined();
    expect(Object.keys(contraste?.variables ?? {}).length).toBeGreaterThan(10);
  });

  it('chaque thème retiré ramène vers une ambiance qui existe', () => {
    /*
      Le choix de thème ne vit que dans le navigateur. Sans cette table, le
      repli générique enverrait vers le thème CLAIR quelqu'un qui travaillait
      en sombre — au prochain chargement, et sans explication.
    */
    const retenus = new Set(THEME_PRESETS.map((preset) => preset.id));
    for (const [retire, cible] of Object.entries(THEMES_RETIRES)) {
      expect(retenus.has(retire as never), `« ${retire} » ne doit plus être proposé`).toBe(false);
      expect(retenus.has(cible), `« ${retire} » pointe vers « ${cible} », inexistant`).toBe(true);
    }
  });

  it('n’annonce pas dans l’aperçu une couleur qu’il n’applique pas', () => {
    // L'aperçu est la pastille du sélecteur de thème. Mentir dessus fait
    // choisir un thème sur une couleur qu'on ne verra jamais.
    for (const preset of THEME_PRESETS) {
      const variables = preset.variables as Record<string, string | undefined>;
      // Sans variables propres, le thème rend ce que dit la feuille de style :
      // c'est donc à elle que l'aperçu doit correspondre.
      const source = preset.baseMode === 'dark' ? sombre : clair;

      for (const nom of ['background', 'surface'] as const) {
        const applique = variables[`--${nom}`] ?? source[`--${nom}`] ?? '';
        expect(preset.preview[nom].toLowerCase(), `aperçu « ${nom} » de « ${preset.label} »`).toBe(
          applique.toLowerCase(),
        );
      }
    }
  });

  it('teinte la barre du navigateur avec le fond réellement utilisé', () => {
    /*
      `BROWSER_BAR_COLOR` alimente `<meta name="theme-color">`, la teinte que
      les navigateurs mobiles donnent à leur propre barre. Elle doit valoir le
      fond de page, sinon la barre annonce une couleur que l'application
      n'emploie plus.

      C'est arrivé : le sombre y est resté à `#0b1117`, l'ancienne ardoise,
      pendant que la palette passait au marine. Rien ne le signalait — la barre
      appartient au navigateur, aucune capture d'écran de l'application ne la
      montre.
    */
    expect(BROWSER_BAR_COLOR.light.toLowerCase()).toBe(clair['--background']?.toLowerCase());
    expect(BROWSER_BAR_COLOR.dark.toLowerCase()).toBe(sombre['--background']?.toLowerCase());
  });

  it('donne un identifiant distinct à chaque préréglage', () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

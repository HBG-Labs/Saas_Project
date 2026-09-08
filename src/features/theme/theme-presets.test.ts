import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ATELIER_NUIT_PRESET, DEFAULT_THEME_PRESET, THEME_PRESETS } from './theme-presets';

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
    expect(clair['--background']).toBe('#eef2f5');
    expect(sombre['--background']).toBe('#0e1b36');
  });

  it('« Atelier Nuit » déclare exactement les valeurs du bloc `.dark`', () => {
    for (const [nom, valeur] of Object.entries(ATELIER_NUIT_PRESET.variables)) {
      expect(
        valeur.toLowerCase(),
        `« ${nom} » vaut ${valeur} dans le préréglage et ${sombre[nom]} dans .dark — ` +
          `le préréglage gagne, la valeur CSS ne sert à rien`,
      ).toBe((sombre[nom] ?? '').toLowerCase());
    }
  });

  it('« Atelier Jour » déclare exactement les valeurs du bloc clair', () => {
    for (const [nom, valeur] of Object.entries(DEFAULT_THEME_PRESET.variables)) {
      expect(
        valeur.toLowerCase(),
        `« ${nom} » vaut ${valeur} dans le préréglage et ${clair[nom]} dans :root`,
      ).toBe((clair[nom] ?? '').toLowerCase());
    }
  });

  it('n’annonce pas dans l’aperçu une couleur qu’il n’applique pas', () => {
    // L'aperçu est la pastille du sélecteur de thème. Mentir dessus fait
    // choisir un thème sur une couleur qu'on ne verra jamais.
    for (const preset of [DEFAULT_THEME_PRESET, ATELIER_NUIT_PRESET]) {
      const variables = preset.variables as Record<string, string | undefined>;

      expect(preset.preview.background.toLowerCase(), `aperçu de « ${preset.label} »`).toBe(
        (variables['--background'] ?? '').toLowerCase(),
      );
      expect(preset.preview.surface.toLowerCase(), `aperçu de « ${preset.label} »`).toBe(
        (variables['--surface'] ?? '').toLowerCase(),
      );
    }
  });

  it('donne un identifiant distinct à chaque préréglage', () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

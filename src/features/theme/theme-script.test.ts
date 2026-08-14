import { describe, expect, it } from 'vitest';

// `?raw` plutôt que `node:fs` : le projet `tsconfig.app.json` ne déclare pas
// les types Node, et c'est voulu — rien sous `src/` ne doit pouvoir appeler le
// système de fichiers. C'est le même procédé que `src/test/sql-fixtures.ts`.
import indexHtml from '../../../index.html?raw';

import { THEME_STORAGE_KEY } from './theme-context';

/**
 * Le thème est posé deux fois : par un script en ligne dans `index.html`, avant
 * la première peinture, puis par `applyStoredTheme()` une fois le bundle
 * chargé. Cette duplication est voulue — un fichier externe arriverait trop
 * tard pour éviter le clignotement — mais elle crée un couplage muet.
 *
 * Renommer `THEME_STORAGE_KEY` sans toucher au HTML ne casserait rien de
 * visible : l'application continuerait de fonctionner, en ignorant simplement
 * la préférence enregistrée au premier rendu. Un défaut qu'on met des semaines
 * à remarquer, et qu'on attribue au navigateur.
 */
describe('script de thème en ligne', () => {
  const html = indexHtml;

  it('lit la même clé de stockage que le code applicatif', () => {
    expect(html).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
  });

  it("s'exécute avant le bundle, sinon il ne sert à rien", () => {
    const inlineScript = html.indexOf('localStorage.getItem(');
    const bundle = html.indexOf('<script type="module"');

    expect(inlineScript).toBeGreaterThan(-1);
    expect(bundle).toBeGreaterThan(-1);
    expect(inlineScript).toBeLessThan(bundle);
  });

  it("ne fige plus un thème sombre sur l'élément racine", () => {
    // `<html class="dark">` en dur imposait le thème sombre à tout le monde
    // jusqu'au chargement du JavaScript.
    expect(html).not.toMatch(/<html[^>]*class="[^"]*dark/);
  });
});

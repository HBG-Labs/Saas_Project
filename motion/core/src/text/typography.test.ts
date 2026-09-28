import { describe, expect, it } from 'vitest';

import { applyTypography, applyTypographyToRuns, NBSP, NNBSP, typographyProvenance } from './typography.ts';

const fr = (text: string) => applyTypography(text, 'fr-FR').text;

describe('typographie française', () => {
  it('espace fine insécable avant ? ! ; (remplace l’espace ordinaire, n’en ajoute jamais deux)', () => {
    expect(fr('Et si la Lune disparaissait ?')).toBe(`Et si la Lune disparaissait${NNBSP}?`);
    expect(fr('Vraiment?')).toBe(`Vraiment${NNBSP}?`);
    expect(fr('Stop !')).toBe(`Stop${NNBSP}!`);
    expect(fr('un ; deux')).toBe(`un${NNBSP}; deux`);
    expect(fr(`Déjà${NNBSP}?`)).toBe(`Déjà${NNBSP}?`);
  });

  it('espace insécable avant les deux-points, sauf heures et adresses', () => {
    expect(fr('Réponse : oui')).toBe(`Réponse${NBSP}: oui`);
    expect(fr('à 10:30')).toBe('à 10:30');
    expect(fr('https://exemple.test')).toBe('https://exemple.test');
  });

  it('guillemets français avec espaces fines insécables intérieures', () => {
    expect(fr('Elle a dit "reviens"')).toBe(`Elle a dit «${NNBSP}reviens${NNBSP}»`);
    expect(fr('« reviens »')).toBe(`«${NNBSP}reviens${NNBSP}»`);
    expect(fr('«reviens»')).toBe(`«${NNBSP}reviens${NNBSP}»`);
  });

  it('apostrophe typographique et points de suspension', () => {
    expect(fr("l'eau d'aujourd'hui...")).toBe('l’eau d’aujourd’hui…');
  });

  it('suite de ponctuation : une seule espace, devant la première', () => {
    expect(fr('Quoi ?!')).toBe(`Quoi${NNBSP}?!`);
  });

  it('idempotente : appliquer deux fois ne change rien', () => {
    const once = fr('« Et si la Lune n\'était plus là ? » ... Réponse : non !');
    expect(fr(once)).toBe(once);
  });

  it('à travers les runs : l’espace devant « ? » appartient au run de la ponctuation', () => {
    const runs = (...texts: string[]) => texts.map((text) => ({ text, break_after: false }));
    expect(applyTypographyToRuns(runs('Et si la Lune ', 'disparaissait', ' ?'), 'fr-FR').texts).toEqual([
      'Et si la Lune ',
      'disparaissait',
      `${NNBSP}?`,
    ]);
    expect(applyTypographyToRuns(runs('elle est ', '?'), 'fr-FR').texts).toEqual(['elle est', `${NNBSP}?`]);
    expect(applyTypographyToRuns(runs('Il a dit "', 'jamais', '" hier'), 'fr-FR').texts).toEqual([
      `Il a dit «${NNBSP}`,
      'jamais',
      `${NNBSP}» hier`,
    ]);
    // Une coupure explicite sépare deux paragraphes : pas de recollage.
    expect(applyTypographyToRuns([{ text: 'Et si', break_after: true }, { text: '? non', break_after: false }], 'fr-FR').texts[0]).toBe('Et si');
  });

  it('trace les règles appliquées et leur version ; autre langue : texte intact', () => {
    expect(applyTypography('Et si ?', 'fr-FR').applied).toEqual(['fr.high_punctuation']);
    expect(applyTypography('What if? "Yes"', 'en-US')).toEqual({ text: 'What if? "Yes"', applied: [] });
    expect(typographyProvenance('fr-CA')).toBe('fr@1.0.0');
    expect(typographyProvenance('en-US')).toBe('none@1.0.0');
  });
});

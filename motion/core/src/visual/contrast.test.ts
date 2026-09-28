import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../style/contrast.ts';
import { clone, readFixture } from '../test-support.ts';
import { readVersioned } from '../validation/versioning.ts';
import { applyTreatment, CONTRAST_FLOORS, contrastOfLuminances, quantile, relativeLuminanceRgb, textCategory } from './contrast.ts';

describe('P1.5 — lisibilité : planchers et catégories', () => {
  it('planchers du moteur : 3:1 (grand texte), 4.5:1 (texte courant)', () => {
    expect(CONTRAST_FLOORS).toEqual({ large: 3, normal: 4.5 });
  });

  it('catégorie rapportée à un téléphone de 390 px CSS : 24 px CSS, ou 18,66 px CSS en gras', () => {
    // 540 px de sortie : 1 px = 390/540 px CSS → 24 px CSS ≈ 33,2 px ; 18,66 px CSS ≈ 25,8 px.
    expect(textCategory(34, 400, 540)).toBe('large');
    expect(textCategory(32, 400, 540)).toBe('normal');
    expect(textCategory(26, 700, 540)).toBe('large');
    expect(textCategory(25, 700, 540)).toBe('normal');
    // Indépendant de la résolution : même texte à 1080 px.
    expect(textCategory(68, 400, 1080)).toBe(textCategory(34, 400, 540));
  });

  it('une seule implémentation WCAG : API palette et API pixels donnent le même ratio', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 9);
    const l1 = relativeLuminanceRgb(0x11 / 255, 0x11 / 255, 0x11 / 255);
    const l2 = relativeLuminanceRgb(0xff / 255, 0xe1 / 255, 0x4d / 255);
    expect(contrastOfLuminances(l1, l2)).toBeCloseTo(contrastRatio('#111111', '#FFE14D'), 12);
  });

  it('quantile par rang, sans interpolation ni valeur inventée', () => {
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 0.1)).toBe(2);
    expect(quantile([7], 0.1)).toBe(7);
    expect(() => quantile([], 0.1)).toThrowError();
  });
});

describe('P1.5 — modèle du traitement (vérifié contre le rendu réel de Chromium)', () => {
  it('traitement neutre : couleur inchangée', () => {
    expect(applyTreatment([0.2, 0.4, 0.6], { grayscale: 0, contrast: 1, tint: null })).toEqual([0.2, 0.4, 0.6]);
  });

  it('niveaux de gris (matrice Filter Effects), contraste borné, voile par composition', () => {
    const [r, g, b] = applyTreatment([1, 0, 0], { grayscale: 1, contrast: 1, tint: null });
    expect(r).toBeCloseTo(0.2126, 9);
    expect(g).toBeCloseTo(0.2126, 9);
    expect(b).toBeCloseTo(0.2126, 9);
    expect(applyTreatment([0.9, 0.5, 0.1], { grayscale: 0, contrast: 2, tint: null })).toEqual([1, 0.5, 0]);
    const veiled = applyTreatment([0, 0, 0], { grayscale: 0, contrast: 1, tint: { color: '#FFFFFF', opacity: 0.25 } });
    expect(veiled).toEqual([0.25, 0.25, 0.25]);
  });
});

describe('P1.5 — style 0.5.0', () => {
  it('migration 0.4.0 → 0.5.0 : amplitudes d’image nulles (mouvement indisponible), planchers du moteur', () => {
    const doc = clone(readFixture('profiles/fixture_ink.style.json'));
    doc.schema_version = '0.4.0';
    delete doc.motion_personality.amplitude.image_push_scale;
    delete doc.motion_personality.amplitude.image_pan_scale;
    delete doc.motion_personality.amplitude.image_pan_travel;
    delete doc.rhythm_personality.reading.min_contrast;
    const read = readVersioned('creative-style-profile', doc);
    expect(read.ok && read.migratedFrom).toBe('0.4.0');
    expect(read.ok && read.value.motion_personality.amplitude).toMatchObject({ image_push_scale: null, image_pan_scale: null, image_pan_travel: null });
    expect(read.ok && read.value.rhythm_personality.reading.min_contrast).toEqual({ large: 3, normal: 4.5 });
  });
});

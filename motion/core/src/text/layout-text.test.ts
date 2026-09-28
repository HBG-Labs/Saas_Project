import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fixtureFontSha, fixtureShaper } from '../test-support.ts';
import { layoutTextBlock, TextFitError } from './layout-text.ts';
import type { TextBlockInput } from './layout-text.ts';
import { NBSP } from './typography.ts';

const shaper = fixtureShaper();
const serif = fixtureFontSha('playfair-display-latin-900.ttf');
const mono = fixtureFontSha('ibm-plex-mono-latin-700.ttf');

const block = (over: Partial<TextBlockInput> = {}): TextBlockInput => ({
  runs: [
    { id: 'r1', text: 'Et si la Lune ', break_after: false },
    { id: 'r2', text: `disparaissait${NBSP}?`, break_after: false },
  ],
  font: serif,
  language: 'fr-FR',
  size: 60,
  line_height: 1.05,
  tracking_em: 0,
  policy: 'balance',
  align: 'start',
  width: 420,
  height: null,
  min_scale: 0.7,
  ...over,
});

describe('mesure réelle (HarfBuzz)', () => {
  it('les largeurs sont linéaires en taille et déterministes', () => {
    const a = shaper.shape({ font: serif, text: 'Lune', size: 50, tracking_px: 0, language: 'fr-FR' });
    const b = shaper.shape({ font: serif, text: 'Lune', size: 100, tracking_px: 0, language: 'fr-FR' });
    expect(b.advance).toBeCloseTo(a.advance * 2, 9);
    expect(shaper.shape({ font: serif, text: 'Lune', size: 50, tracking_px: 0, language: 'fr-FR' })).toEqual(a);
  });

  it('une police à chasse fixe donne la même avance à chaque caractère', () => {
    const r = shaper.shape({ font: mono, text: 'iiii', size: 100, tracking_px: 0, language: 'fr-FR' });
    const w = shaper.shape({ font: mono, text: 'WWWW', size: 100, tracking_px: 0, language: 'fr-FR' });
    expect(r.advance).toBeCloseTo(w.advance, 9);
  });

  it('l’espacement de lettres s’ajoute après chaque caractère (comme CSS letter-spacing)', () => {
    const plain = shaper.shape({ font: serif, text: 'Lune', size: 50, tracking_px: 0, language: 'fr-FR' });
    const spaced = shaper.shape({ font: serif, text: 'Lune', size: 50, tracking_px: 3, language: 'fr-FR' });
    expect(spaced.advance - plain.advance).toBeCloseTo(12, 6);
  });

  it('signale les caractères absents de la police', () => {
    expect(shaper.hasCharacter(serif, 'a')).toBe(true);
    expect(shaper.hasCharacter(serif, NBSP)).toBe(true);
    expect(shaper.hasCharacter(serif, ' ')).toBe(false);
    expect(shaper.shape({ font: serif, text: 'a中b', size: 50, tracking_px: 0, language: 'fr-FR' }).missing).toEqual(['中']);
  });
});

describe('coupure et ajustement', () => {
  it('coupe de façon équilibrée, sans jamais couper sur une insécable', () => {
    const layout = layoutTextBlock(block(), shaper);
    expect(layout.ratio).toBe(1);
    expect(layout.lines.length).toBeGreaterThan(1);
    const texts = layout.lines.map((l) => l.runs.map((r) => r.text).join(''));
    expect(texts.join(' ')).toBe(`Et si la Lune disparaissait${NBSP}?`);
    // « ? » reste collé à son mot.
    expect(texts.some((t) => t.startsWith('?'))).toBe(false);
    for (const line of layout.lines) expect(line.measured_width).toBeLessThanOrEqual(420 + 1e-6);
  });

  it('respecte les coupures explicites et réduit la taille (par pas de 1 %) plutôt que de couper', () => {
    const layout = layoutTextBlock(
      block({ policy: 'explicit', width: 600, runs: [{ id: 'r1', text: 'Et si la Lune disparaissait', break_after: true }, { id: 'r2', text: 'demain ?', break_after: false }] }),
      shaper,
    );
    expect(layout.lines.map((l) => l.runs.map((r) => r.text).join(''))).toEqual(['Et si la Lune disparaissait', 'demain ?']);
    expect(layout.ratio).toBeLessThan(1);
    expect(Math.round(layout.ratio * 100)).toBe(layout.ratio * 100);
    expect(Math.max(...layout.lines.map((l) => l.measured_width))).toBeLessThanOrEqual(600 + 1e-6);
    // Le pas au-dessus ne tenait pas.
    const above = layout.lines[0]!.measured_width / layout.ratio * (layout.ratio + 0.01);
    expect(above).toBeGreaterThan(600);
  });

  it('respecte la hauteur disponible', () => {
    const tall = layoutTextBlock(block({ width: 300, min_scale: 0.5 }), shaper);
    const limited = layoutTextBlock(block({ width: 300, min_scale: 0.5, height: tall.height * 0.9 }), shaper);
    expect(limited.height).toBeLessThanOrEqual(tall.height * 0.9 + 1e-6);
    expect(limited.ratio).toBeLessThan(tall.ratio);
  });

  it('refuse, avec une erreur structurée, un texte qui ne tient pas au plancher du style', () => {
    expect(() => layoutTextBlock(block({ width: 60 }), shaper)).toThrowError(TextFitError);
    try {
      layoutTextBlock(block({ width: 60 }), shaper);
    } catch (error) {
      expect((error as TextFitError).code).toBe('layout.text_overflow');
    }
  });

  it('un rapport imposé (cohérence du rôle) est appliqué tel quel', () => {
    expect(layoutTextBlock(block({ ratio: 0.8 }), shaper).size).toBeCloseTo(48, 9);
  });

  it('indépendant de la résolution : même coupure et même rapport à 540 et 1080 px', () => {
    const small = layoutTextBlock(block({ policy: 'explicit', width: 600 }), shaper);
    const large = layoutTextBlock(block({ policy: 'explicit', width: 1200, size: 120 }), shaper);
    expect(large.ratio).toBe(small.ratio);
    expect(large.lines.map((l) => l.runs.map((r) => r.text))).toEqual(small.lines.map((l) => l.runs.map((r) => r.text)));
    expect(large.lines[0]!.measured_width).toBeCloseTo(small.lines[0]!.measured_width * 2, 6);
  });
});

describe('propriétés (fast-check)', () => {
  const word = fc.stringMatching(/^[a-zà-ü’]{1,11}$/);
  const words = fc.array(word, { minLength: 1, maxLength: 9 });

  it('tout texte accepté tient dans sa largeur, encre comprise, au-dessus du plancher ; sinon erreur structurée', () => {
    fc.assert(
      fc.property(words, fc.integer({ min: 180, max: 520 }), fc.constantFrom<'start' | 'center' | 'end'>('start', 'center', 'end'), (ws, width, align) => {
        const input = block({ runs: [{ id: 'r1', text: ws.join(' '), break_after: false }], width, align, min_scale: 0.6 });
        let layout;
        try {
          layout = layoutTextBlock(input, shaper);
        } catch (error) {
          expect(error).toBeInstanceOf(TextFitError);
          return;
        }
        expect(layout.ratio).toBeGreaterThanOrEqual(0.6);
        expect(layout.ratio).toBeLessThanOrEqual(1);
        for (const line of layout.lines) {
          expect(line.measured_width).toBeLessThanOrEqual(width + 1e-6);
          // Le texte n'est jamais perdu ni dupliqué.
        }
        expect(layout.lines.map((l) => l.runs.map((r) => r.text).join('')).join(' ')).toBe(ws.join(' '));
        expect(layout.ink!.x0).toBeGreaterThanOrEqual(-1e-6);
        expect(layout.ink!.x1).toBeLessThanOrEqual(width + 1e-6);
        // Déterministe.
        expect(layoutTextBlock(input, shaper)).toEqual(layout);
      }),
      { seed: 20260928, numRuns: 150 },
    );
  });
});

describe('positions, lignes de base et alignement optique', () => {
  it('runs contigus, glyphes croissants, ligne de base dans la ligne', () => {
    const layout = layoutTextBlock(block(), shaper);
    for (const line of layout.lines) {
      expect(line.baseline).toBeGreaterThan(line.top);
      expect(line.baseline).toBeLessThan(line.top + line.height);
      for (let i = 1; i < line.runs.length; i++) {
        const prev = line.runs[i - 1]!;
        expect(line.runs[i]!.x).toBeCloseTo(prev.x + prev.width, 9);
      }
      for (const run of line.runs) {
        for (let i = 1; i < run.glyphs.length; i++) expect(run.glyphs[i]!.x).toBeGreaterThanOrEqual(run.glyphs[i - 1]!.x);
      }
    }
  });

  it('aligné à gauche : l’ENCRE de chaque ligne touche le bord (pas la boîte d’avance)', () => {
    const layout = layoutTextBlock(block({ align: 'start' }), shaper);
    for (const line of layout.lines) expect(line.ink!.x0).toBeCloseTo(0, 6);
  });

  it('aligné à droite et centré : encre sur le bord droit, encre centrée', () => {
    const end = layoutTextBlock(block({ align: 'end' }), shaper);
    for (const line of end.lines) expect(line.ink!.x1).toBeCloseTo(420, 6);
    const center = layoutTextBlock(block({ align: 'center' }), shaper);
    for (const line of center.lines) expect((line.ink!.x0 + line.ink!.x1) / 2).toBeCloseTo(210, 6);
  });

  it('l’encre du bloc est contenue dans la largeur disponible', () => {
    const layout = layoutTextBlock(block({ width: 300, min_scale: 0.5 }), shaper);
    expect(layout.ink!.x0).toBeGreaterThanOrEqual(-1e-6);
    expect(layout.ink!.x1).toBeLessThanOrEqual(300 + 1e-6);
  });
});

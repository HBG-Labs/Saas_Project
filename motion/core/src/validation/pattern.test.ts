import { describe, expect, it } from 'vitest';

import { clone, codes, readFixture } from '../test-support.ts';
import { validatePattern } from './validate.ts';

const pattern = () => clone(readFixture('patterns/statement.interrupt.json'));

describe('pattern générique', () => {
  it('statement.interrupt est valide', () => {
    const result = validatePattern(pattern());
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  it('refuse une valeur d’axe sans définition', () => {
    const doc = pattern();
    doc.variation_axes.motion_variant.values.push('spin');
    expect(codes(validatePattern(doc))).toEqual(['pattern.axis_uncovered']);
  });

  it('refuse un défaut hors des valeurs de l’axe', () => {
    const doc = pattern();
    doc.variation_axes.layout_variant.default = 'diagonal';
    expect(codes(validatePattern(doc))).toContain('pattern.axis_default');
  });

  it('refuse un placement circulaire ou vers un slot inconnu', () => {
    const cycle = pattern();
    cycle.layouts.stack_start.slots['statement.primary'] = { kind: 'follow', of: 'statement.rule', gap: 'md', align_x: 'start' };
    expect(codes(validatePattern(cycle))).toContain('pattern.slot_cycle');
    const unknown = pattern();
    unknown.layouts.stack_start.slots['statement.rule'].of = 'statement.ghost';
    expect(codes(validatePattern(unknown))).toContain('pattern.slot_unknown');
  });

  it('refuse une valeur visuelle : le pattern ne connaît que des rôles', () => {
    const doc = pattern();
    doc.elements.statement.color = '#FFFFFF';
    expect(validatePattern(doc).ok).toBe(false);
  });

  it('refuse une fraction de grille hors de la zone utile', () => {
    const doc = pattern();
    doc.layouts.stack_start.slots['statement.primary'].y = [0.3, 1.4];
    expect(validatePattern(doc).ok).toBe(false);
  });
});

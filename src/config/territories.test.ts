import { describe, expect, it } from 'vitest';
import {
  TERRITORIES,
  getTerritoryByCode,
  getTerritoryByHolidayId,
  DEFAULT_TERRITORY,
} from './territories';

describe('territories', () => {
  it('contient tous les territoires principaux français', () => {
    const codes = TERRITORIES.map((t) => t.code);
    expect(codes).toContain('FR');
    expect(codes).toContain('971');
    expect(codes).toContain('972');
    expect(codes).toContain('973');
    expect(codes).toContain('974');
    expect(codes).toContain('976');
  });

  it('retourne le territoire correct par code postal / code territoire', () => {
    const martinique = getTerritoryByCode('972');
    expect(martinique.code).toBe('972');
    expect(martinique.id).toBe('martinique');
    expect(martinique.center[0]).toBeCloseTo(14.6415);
    expect(martinique.center[1]).toBeCloseTo(-61.0242);

    const guadeloupe = getTerritoryByCode('971');
    expect(guadeloupe.code).toBe('971');
    expect(guadeloupe.id).toBe('guadeloupe');

    const metropole = getTerritoryByCode('FR');
    expect(metropole.code).toBe('FR');
    expect(metropole.id).toBe('metropole');
  });

  it('retourne le territoire correct par holidayId', () => {
    const guyane = getTerritoryByHolidayId('guyane');
    expect(guyane.code).toBe('973');
    expect(guyane.center[0]).toBeCloseTo(4.9372);
  });

  it('fournit une valeur par défaut sûre en cas de code inconnu', () => {
    const fallback = getTerritoryByCode('UNKNOWN');
    expect(fallback).toEqual(DEFAULT_TERRITORY);
  });
});

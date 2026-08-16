import { lazy } from 'react';
import { describe, expect, it } from 'vitest';

import {
  countOutsideIndustry,
  isTransverseTool,
  servesIndustry,
  sortByIndustryRelevance,
} from './industry-scope';
import type { ToolDefinition } from './types';

function tool(slug: string, industry?: ToolDefinition['industry']): ToolDefinition {
  return {
    slug,
    category: 'general',
    title: slug,
    description: '',
    keywords: [],
    icon: 'calculator',
    Component: lazy(() => Promise.resolve({ default: () => null })),
    ...(industry !== undefined ? { industry } : {}),
  };
}

describe('pertinence métier des outils', () => {
  const calculator = tool('scientific-calculator');
  const subnet = tool('subnet-calculator', ['fiber_telecom', 'it_networks']);
  const ohm = tool('ohm-law', ['electrical', 'hvac', 'heating']);
  const fiberColors = tool('fiber-color-code', 'fiber_telecom');

  it('considère transverse un outil sans métier déclaré', () => {
    expect(isTransverseTool(calculator)).toBe(true);
    expect(isTransverseTool(subnet)).toBe(false);
  });

  it('rend un outil transverse pertinent pour tous les métiers', () => {
    expect(servesIndustry(calculator, 'landscaping')).toBe(true);
    expect(servesIndustry(calculator, 'fiber_telecom')).toBe(true);
  });

  it('accepte aussi bien une valeur unique qu’une liste', () => {
    expect(servesIndustry(fiberColors, 'fiber_telecom')).toBe(true);
    expect(servesIndustry(fiberColors, 'hvac')).toBe(false);
    expect(servesIndustry(subnet, 'it_networks')).toBe(true);
    expect(servesIndustry(subnet, 'hvac')).toBe(false);
  });

  it('place les outils du métier en tête sans en perdre aucun', () => {
    const all = [fiberColors, ohm, calculator, subnet];
    const sorted = sortByIndustryRelevance(all, 'hvac');

    // Rien ne disparaît : c'est la garantie centrale de ce module.
    expect(sorted).toHaveLength(all.length);
    expect(new Set(sorted.map((t) => t.slug))).toEqual(new Set(all.map((t) => t.slug)));

    // La loi d'Ohm et la calculatrice servent un frigoriste ; pas les couleurs
    // de fibre ni le calcul de sous-réseau.
    expect(sorted.slice(0, 2).map((t) => t.slug)).toEqual(['ohm-law', 'scientific-calculator']);
  });

  it('conserve l’ordre reçu à pertinence égale', () => {
    // Tri stable : sans cette garantie, le classement d'origine — qui place la
    // calculatrice en tête — serait défait à chaque changement de métier.
    const sorted = sortByIndustryRelevance([calculator, subnet, fiberColors], 'fiber_telecom');
    expect(sorted.map((t) => t.slug)).toEqual([
      'scientific-calculator',
      'subnet-calculator',
      'fiber-color-code',
    ]);
  });

  it('compte ce qu’une restriction écarterait', () => {
    expect(countOutsideIndustry([calculator, subnet, ohm, fiberColors], 'fiber_telecom')).toBe(1);
    expect(countOutsideIndustry([calculator, subnet, ohm, fiberColors], 'landscaping')).toBe(3);
    expect(countOutsideIndustry([calculator], 'landscaping')).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { ACCENT_COLORS, ACCENTS_RETIRES } from './accent-colors';

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
  const haut = Math.max(la, lb);
  const bas = Math.min(la, lb);
  return (haut + 0.05) / (bas + 0.05);
}

const HISTORIQUES = {
  navy: '#1e3a8a',
  blue: '#2563eb',
  purple: '#8b5cf6',
  green: '#10b981',
  red: '#ef4444',
  amber: '#d97706',
  pink: '#ec4899',
  cyan: '#06b6d4',
};
const NUANCES = ACCENT_COLORS.filter((color) => !color.isAuto);
const VARIABLES_AUTORISEES = [
  '--primary',
  '--primary-hover',
  '--primary-active',
  '--primary-foreground',
  '--primary-subtle',
  '--ring',
  '--action',
  '--action-hover',
  '--action-active',
  '--action-foreground',
  '--action-text',
  '--nav-selected',
  '--nav-foreground',
  '--nav-subtle',
  '--nav-text',
  '--workspace-selected',
  '--workspace-foreground',
  '--settings-selected',
  '--settings-foreground',
];

describe('couleurs historiques', () => {
  it('rétablit les huit pastilles historiques et le choix automatique', () => {
    expect(ACCENT_COLORS).toHaveLength(9);
    expect(new Set(ACCENT_COLORS.map((color) => color.id)).size).toBe(9);
    expect(Object.fromEntries(NUANCES.map((color) => [color.id, color.hex]))).toEqual(HISTORIQUES);
    const auto = ACCENT_COLORS.find((color) => color.id === 'auto');
    expect(auto?.lightVariables).toEqual({});
    expect(auto?.darkVariables).toEqual({});
    expect(auto?.contrastVariables).toEqual({});
  });

  it.each(NUANCES.map((color) => [color.label, color] as const))(
    '%s reste lisible dans les trois modes',
    (_label, color) => {
      for (const [mode, surfaces, minimum] of [
        ['lightVariables', ['#ffffff', '#f7f8fa', '#eef1f5'], 4.5],
        ['darkVariables', ['#0e1b36', '#162040', '#1c2a52', '#0a1228', '#121a34', '#1f2f5e'], 4.5],
        ['contrastVariables', ['#ffffff', '#f2f2f2', '#f7f7f7', '#e8e8e8'], 7],
      ] as const) {
        const v = color[mode];
        // Les statuts de succès, avertissement et erreur restent indépendants du choix.
        expect(Object.keys(v).sort()).toEqual([...VARIABLES_AUTORISEES].sort());
        for (const value of Object.values(v)) expect(value).toMatch(/^#[0-9a-f]{6}$/);
        for (const [background, text] of [
          ['--primary', '--primary-foreground'],
          ['--primary-hover', '--primary-foreground'],
          ['--primary-active', '--primary-foreground'],
          ['--action', '--action-foreground'],
          ['--action-hover', '--action-foreground'],
          ['--action-active', '--action-foreground'],
          ['--nav-selected', '--nav-foreground'],
          ['--workspace-selected', '--workspace-foreground'],
          ['--settings-selected', '--settings-foreground'],
          ['--primary-subtle', '--primary'],
          ['--nav-subtle', '--nav-text'],
        ]) {
          expect(
            contraste(v[background!]!, v[text!]!),
            color.id + '/' + mode + '/' + background,
          ).toBeGreaterThanOrEqual(minimum);
        }
        for (const surface of surfaces)
          for (const key of ['--primary', '--action-text', '--nav-text']) {
            expect(
              contraste(v[key]!, surface),
              color.id + '/' + mode + '/' + key + '/' + surface,
            ).toBeGreaterThanOrEqual(minimum);
          }
      }
    },
  );

  it('reprend les nuances bleues enregistrées sans effacer le choix', () => {
    expect(ACCENTS_RETIRES).toEqual({
      ardoise: 'cyan',
      acier: 'navy',
      azur: 'green',
      cobalt: 'blue',
      outremer: 'amber',
      indigo: 'red',
      saphir: 'pink',
      encre: 'purple',
    });
    expect(new Set(Object.values(ACCENTS_RETIRES)).size).toBe(8);
  });
});

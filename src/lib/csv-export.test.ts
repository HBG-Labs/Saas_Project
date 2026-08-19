import { describe, expect, it } from 'vitest';

import { escapeCsvValue, generateCsvContent } from './csv-export';

describe('csv-export', () => {
  it('échappe correctement les valeurs simples', () => {
    expect(escapeCsvValue('test')).toBe('test');
    expect(escapeCsvValue(123)).toBe('123');
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
  });

  it('échappe les valeurs contenant des points-virgules, guillemets et retours à la ligne', () => {
    expect(escapeCsvValue('A;B')).toBe('"A;B"');
    expect(escapeCsvValue('Dit "Bonjour"')).toBe('"Dit ""Bonjour"""');
    expect(escapeCsvValue('Ligne 1\nLigne 2')).toBe('"Ligne 1\nLigne 2"');
  });

  it('génère un contenu CSV valide avec BOM UTF-8', () => {
    interface TestItem {
      name: string;
      age: number;
      city: string;
    }

    const columns = [
      { header: 'Nom', accessor: (d: TestItem) => d.name },
      { header: 'Âge', accessor: (d: TestItem) => d.age },
      { header: 'Ville', accessor: (d: TestItem) => d.city },
    ];

    const data: TestItem[] = [
      { name: 'Alice; Martin', age: 30, city: 'Paris' },
      { name: 'Bob', age: 25, city: 'Lyon' },
    ];

    const csv = generateCsvContent(columns, data);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Nom;Âge;Ville');
    expect(csv).toContain('"Alice; Martin";30;Paris');
    expect(csv).toContain('Bob;25;Lyon');
  });
});

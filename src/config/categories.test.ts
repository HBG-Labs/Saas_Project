import { describe, expect, it } from 'vitest';

import {
  extractInsertTuples,
  MIGRATION_FILES,
  readMigration,
  stripCast,
} from '@/test/sql-fixtures';

import { CATEGORIES, CATEGORY_SLUGS, getCategory, isCategorySlug } from './categories';

/**
 * Garde-fou de la source unique des catégories.
 *
 * `src/config/categories.ts` et le seed SQL décrivent le même jeu de données.
 * Une divergence est silencieuse : le catalogue afficherait une catégorie que
 * la base ne connaît pas, ou l'inverse. Ce test la rend impossible à ignorer.
 */
describe('CATEGORIES', () => {
  it('déclare huit domaines techniques', () => {
    expect(CATEGORIES).toHaveLength(8);
  });

  it("n'a aucun slug en double", () => {
    expect(new Set(CATEGORY_SLUGS).size).toBe(CATEGORY_SLUGS.length);
  });

  it('utilise des slugs en kebab-case', () => {
    for (const category of CATEGORIES) {
      expect(category.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('conserve les quatre slugs historiques, référencés par les URL et les outils', () => {
    // Les renommer casserait /categories/<slug> et les `defineTool()` livrés.
    for (const slug of ['electrical', 'fiber-optics', 'networking', 'general']) {
      expect(CATEGORY_SLUGS).toContain(slug);
    }
  });

  it('ordonne par sort_order strictement croissant', () => {
    const orders = CATEGORIES.map((category) => category.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('renseigne une description courte plus concise que la longue', () => {
    for (const category of CATEGORIES) {
      expect(category.shortDescription.length).toBeGreaterThan(0);
      expect(category.shortDescription.length).toBeLessThan(category.description.length);
    }
  });
});

describe('getCategory / isCategorySlug', () => {
  it('retrouve une catégorie par son slug', () => {
    expect(getCategory('fiber-optics')?.name).toBe('Fibre optique');
  });

  it('renvoie undefined pour un slug inconnu', () => {
    expect(getCategory('quantique')).toBeUndefined();
  });

  it('discrimine les slugs valides', () => {
    expect(isCategorySlug('telecom')).toBe(true);
    expect(isCategorySlug('telecoms')).toBe(false);
  });
});

describe('synchronisation avec le seed SQL', () => {
  const sql = readMigration(MIGRATION_FILES.catalog);
  const tuples = extractInsertTuples(sql, 'categories');

  // Colonnes du seed : slug, name, short_description, description, icon,
  // sort_order, status.
  const seeded = tuples.map((tuple) => ({
    slug: stripCast(tuple[0] ?? ''),
    name: stripCast(tuple[1] ?? ''),
    shortDescription: stripCast(tuple[2] ?? ''),
    description: stripCast(tuple[3] ?? ''),
    icon: stripCast(tuple[4] ?? ''),
    sortOrder: Number(stripCast(tuple[5] ?? '0')),
  }));

  it('extrait bien les huit lignes du seed', () => {
    expect(seeded).toHaveLength(8);
  });

  it('déclare exactement les mêmes slugs, dans le même ordre', () => {
    expect(seeded.map((row) => row.slug)).toEqual(CATEGORIES.map((c) => c.slug));
  });

  it('déclare les mêmes libellés, descriptions, icônes et ordres', () => {
    for (const category of CATEGORIES) {
      const row = seeded.find((candidate) => candidate.slug === category.slug);

      expect(row, `catégorie « ${category.slug} » absente du seed SQL`).toBeDefined();
      expect(row?.name).toBe(category.name);
      expect(row?.shortDescription).toBe(category.shortDescription);
      expect(row?.description).toBe(category.description);
      expect(row?.icon).toBe(category.icon);
      expect(row?.sortOrder).toBe(category.sortOrder);
    }
  });
});

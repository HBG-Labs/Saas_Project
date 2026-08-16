import { describe, expect, it } from 'vitest';

import {
  extractInsertTuplesAcross,
  MIGRATION_FILES,
  readMigration,
  stripCast,
} from '@/test/sql-fixtures';

import { DEFAULT_INDUSTRY, INDUSTRY_CODES, isIndustryCode } from './industries';

/**
 * Le miroir TypeScript des métiers ne doit pas diverger du semis SQL.
 *
 * Un code de métier absent du miroir rend un outil invisible sans le signaler :
 * `industry: 'hvac'` sur un `defineTool` ne provoque aucune erreur si `'hvac'`
 * n'existe pas côté base, l'outil est simplement filtré partout. Le défaut le
 * plus coûteux est celui qui ne se manifeste pas.
 *
 * Même dispositif que `rbac.test.ts` et `entitlements.test.ts` : on lit la
 * migration et on compare, plutôt que de compter sur la vigilance.
 */
describe('référentiel des métiers', () => {
  const tuples = extractInsertTuplesAcross([MIGRATION_FILES.industries], 'industries');
  const seededCodes = tuples.map((tuple) => stripCast(tuple[0] ?? ''));

  it('sème au moins les onze métiers annoncés', () => {
    expect(seededCodes.length).toBeGreaterThanOrEqual(11);
  });

  it('déclare exactement les codes semés en base', () => {
    expect([...INDUSTRY_CODES].sort()).toEqual([...seededCodes].sort());
  });

  it('respecte le format attendu des codes', () => {
    for (const code of seededCodes) {
      expect(code).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('comprend le métier de repli', () => {
    expect(seededCodes).toContain(DEFAULT_INDUSTRY);
  });

  it('comprend les trois premiers métiers ciblés par le produit', () => {
    expect(seededCodes).toContain('fiber_telecom');
    expect(seededCodes).toContain('hvac');
    expect(seededCodes).toContain('landscaping');
  });

  it('reconnaît un code valide et rejette le reste', () => {
    expect(isIndustryCode('hvac')).toBe(true);
    expect(isIndustryCode('plomberie')).toBe(false);
    expect(isIndustryCode(null)).toBe(false);
    expect(isIndustryCode(42)).toBe(false);
  });
});

/**
 * Garanties structurelles de la migration.
 *
 * Ces trois assertions protègent des décisions, pas de la syntaxe.
 */
describe('migration des métiers', () => {
  const sql = readMigration(MIGRATION_FILES.industries);

  it('laisse `organizations.industry` nullable', () => {
    // Une organisation sans métier déclaré n'est pas une anomalie : elle
    // dispose du cœur sans spécialisation. Rendre la colonne obligatoire
    // casserait la création d'organisation tant que l'interface ne propose pas
    // le choix — une évolution qui devient une panne.
    expect(sql).toMatch(/add column if not exists industry text/);
    expect(sql).not.toMatch(/add column if not exists industry text not null/);
  });

  it('rétro-remplit les organisations existantes en fibre', () => {
    // Le produit ne s'adressait qu'à ce métier : c'est un fait, pas une
    // commodité. La condition `is null` rend l'opération rejouable.
    expect(sql).toMatch(/set industry = 'fiber_telecom'/);
    expect(sql).toMatch(/where industry is null/);
  });

  it('révoque les privilèges par défaut avant d’accorder la lecture', () => {
    // Supabase accorde `all` à `anon` sur toute nouvelle table de `public`.
    // Sans révocation, seule l'absence de policy empêcherait un DELETE.
    const revokeAt = sql.indexOf('revoke all on public.industries');
    const grantAt = sql.indexOf('grant select on public.industries');

    expect(revokeAt).toBeGreaterThan(-1);
    expect(grantAt).toBeGreaterThan(revokeAt);
  });

  it("n'ouvre aucune écriture cliente sur le référentiel", () => {
    // Seule une migration alimente cette table. Comme pour `subscriptions`,
    // l'absence de policy d'écriture vaut interdiction.
    expect(sql).not.toMatch(/create policy[^;]*on public\.industries for (insert|update|delete)/i);
  });
});

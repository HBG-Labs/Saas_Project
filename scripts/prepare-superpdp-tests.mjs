import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const scenario = readFileSync('supabase/tests/06_invoicing_scenario.sql', 'utf8');
const migrations = [
  'supabase/migrations/20260904195516_superpdp_provider_connection.sql',
  'supabase/migrations/20260904202755_superpdp_advisor_hardening.sql',
].map((path) => readFileSync(path, 'utf8'));
const tests = readFileSync('supabase/tests/fixtures/superpdp-connection.sql', 'utf8');
const marker = "select 'TOUS LES TESTS PASSENT' as resultat;";
if (!scenario.includes(marker)) throw new Error('Missing final assertion marker');
mkdirSync('test-results', { recursive: true });
const withTests = scenario.replace(marker, () => `${tests}\n${marker}`);
writeFileSync(
  'test-results/superpdp-before-migration.sql',
  withTests.replace('begin;', () => `begin;\n${migrations.join('\n')}`),
);
writeFileSync(
  'test-results/superpdp-before-hardening.sql',
  withTests.replace('begin;', () => `begin;\n${migrations[1]}`),
);
writeFileSync('test-results/superpdp-after-migration.sql', withTests);
console.log('Prepared transactional SUPER PDP tests; all scripts end with ROLLBACK.');

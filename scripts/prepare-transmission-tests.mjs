import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const scenario = readFileSync('supabase/tests/06_invoicing_scenario.sql', 'utf8');
const migration = readFileSync(
  'supabase/migrations/20260904191003_invoice_transmission_lifecycle.sql',
  'utf8',
);
const tests = readFileSync('supabase/tests/fixtures/transmission-lifecycle.sql', 'utf8');
const marker = "select 'TOUS LES TESTS PASSENT' as resultat;";
if (!scenario.includes(marker)) throw new Error('Missing final assertion marker');
mkdirSync('test-results', { recursive: true });
const withTests = scenario.replace(marker, () => `${tests}\n${marker}`);
writeFileSync(
  'test-results/transmission-lifecycle-before-migration.sql',
  withTests.replace('begin;', () => `begin;\n${migration}`),
);
writeFileSync('test-results/transmission-lifecycle-after-migration.sql', withTests);
console.log('Prepared transactional transmission tests; both scripts end with ROLLBACK.');

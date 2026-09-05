import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const scenario = readFileSync('supabase/tests/06_invoicing_scenario.sql', 'utf8');
const migration = readFileSync(
  'supabase/migrations/20260904165242_invoice_full_credit_notes.sql',
  'utf8',
);
const tests = readFileSync('supabase/tests/fixtures/full-credit-note.sql', 'utf8');
const marker = "select 'TOUS LES TESTS PASSENT' as resultat;";
if (!scenario.includes(marker)) throw new Error('Missing final assertion marker');
mkdirSync('test-results', { recursive: true });
const withTests = scenario.replace(marker, () => `${tests}\n${marker}`);
writeFileSync(
  'test-results/credit-note-before-migration.sql',
  withTests.replace('begin;', () => `begin;\n${migration}`),
);
writeFileSync('test-results/credit-note-after-migration.sql', withTests);
console.log('Prepared transactional credit-note tests; both scripts end with ROLLBACK.');

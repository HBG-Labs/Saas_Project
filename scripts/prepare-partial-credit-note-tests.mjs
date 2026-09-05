import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const scenario = readFileSync('supabase/tests/06_invoicing_scenario.sql', 'utf8');
const migration = readFileSync(
  'supabase/migrations/20260904183000_invoice_partial_credit_notes.sql',
  'utf8',
);
const tests = [
  readFileSync('supabase/tests/fixtures/full-credit-note.sql', 'utf8'),
  readFileSync('supabase/tests/fixtures/partial-credit-note.sql', 'utf8'),
].join('\n');
const marker = "select 'TOUS LES TESTS PASSENT' as resultat;";
if (!scenario.includes(marker)) throw new Error('Missing final assertion marker');
mkdirSync('test-results', { recursive: true });
const withTests = scenario.replace(marker, () => `${tests}\n${marker}`);
writeFileSync(
  'test-results/partial-credit-note-before-migration.sql',
  withTests.replace('begin;', () => `begin;\n${migration}`),
);
writeFileSync('test-results/partial-credit-note-after-migration.sql', withTests);
console.log('Prepared transactional partial-credit tests; both scripts end with ROLLBACK.');

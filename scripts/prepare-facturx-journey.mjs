// Reuses the transactional SQL scenario; only its synthetic invoice leaves the transaction.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const folder = 'test-results/facturx-journey';
mkdirSync(folder, { recursive: true });
const base = readFileSync('supabase/tests/06_invoicing_scenario.sql', 'utf8');
const marker = "select 'TOUS LES TESTS PASSENT' as resultat;";
assert.equal(
  base.split(marker).length,
  2,
  'The SQL scenario must contain exactly one result marker',
);
assert.match(base, /rollback;\s*$/i, 'The scenario must end with ROLLBACK');
writeFileSync(
  `${folder}/scenario.sql`,
  base.replace(marker, () => readFileSync('supabase/tests/fixtures/facturx-journey.sql', 'utf8')),
);
const output = execSync(
  'npx supabase db query --linked --file test-results/facturx-journey/scenario.sql',
  {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  },
);
const result = JSON.parse(output);
assert.equal(result.rows.length, 1);
assert.equal(result.rows[0].resultat, 'TOUS LES TESTS PASSENT');
const invoice = result.rows[0].fixture;
assert.equal(invoice.id, '00000000-0000-4000-8000-00000000f101');
assert.match(invoice.notes, /DOCUMENT DE TEST/);
assert.equal(invoice.status, 'issued');
writeFileSync(`${folder}/issued-invoice.json`, JSON.stringify(invoice, null, 2));
console.log(
  'Brouillon enregistré et émis dans une transaction annulée. Instantané fictif exporté pour le test local.',
);

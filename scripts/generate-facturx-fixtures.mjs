// Synthetic documents only; no connection to the application database.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import { completeCreditNote, completeInvoice } from '../src/test/fixtures/invoice.ts';
import { preparerExportCii } from '../src/features/einvoicing/canonical/mapper.ts';
import { serializeUbl } from '../src/features/einvoicing/serializers/ubl.ts';
import { renderFacturX } from '../supabase/functions/_shared/facturx-render.ts';

const assets = new URL('../supabase/functions/generate-facturx/assets/', import.meta.url);
const fonts = {
  regular: readFileSync(new URL('NotoSans-Regular.ttf', assets)),
  bold: readFileSync(new URL('NotoSans-Bold.ttf', assets)),
};
const partialCreditNotes = process.argv.includes('--partial-credit-notes');
const creditNotes = process.argv.includes('--credit-notes') || partialCreditNotes;
const fixtureName = partialCreditNotes
  ? 'partial-credit-note'
  : creditNotes
    ? 'credit-note'
    : 'facturx';
const folder = new URL(`../test-results/${fixtureName}-fixtures/`, import.meta.url);
const xmlFolder = new URL(
  `../test-results/${partialCreditNotes ? 'partial-credit-note-cii' : creditNotes ? 'credit-note-cii' : 'cii'}-fixtures/`,
  import.meta.url,
);
const ublFolder = new URL(
  `../test-results/${partialCreditNotes ? 'partial-credit-note-ubl' : creditNotes ? 'credit-note-ubl' : 'ubl'}-fixtures/`,
  import.meta.url,
);
mkdirSync(folder, { recursive: true });
mkdirSync(xmlFolder, { recursive: true });
mkdirSync(ublFolder, { recursive: true });
const sources = [];
for (const name of ['standard', 'franchise', 'zero', 'reverse-charge', 'long']) {
  const source = creditNotes ? completeCreditNote() : completeInvoice();
  source.seller_iban = 'FR7612345987650123456789014';
  source.seller_bic = 'AGRIFRPP';
  source.delivery_address_line1 = '5 rue du Chantier';
  source.delivery_city = 'Le Marin';
  source.delivery_postal_code = '97290';
  source.delivery_country = 'FR';
  if (name === 'franchise' || name === 'zero' || name === 'reverse-charge') {
    const category = { franchise: 'E', zero: 'Z', 'reverse-charge': 'AE' }[name];
    source.items[0].vat_rate = 0;
    source.items[0].vat_category = category;
    source.items[0].vat_exemption_reason =
      category === 'E'
        ? 'TVA non applicable, art. 293 B du CGI.'
        : category === 'AE'
          ? 'Autoliquidation'
          : null;
    source.totals.vat_cents = 0;
    source.totals.total_cents = 2468;
    if (category === 'E') {
      source.seller_vat_regime = 'franchise';
      source.seller_vat_number = null;
    }
    source.payment_method = 'CB';
  }
  if (name === 'long') {
    source.items = Array.from({ length: 60 }, (_, i) => ({
      ...source.items[0],
      id: `line-${i}`,
      position: i,
      description: `Prestation ${i + 1} : pose, raccordement et vérification du circuit électrique, avec contrôle de fonctionnement et compte rendu d’intervention.`,
      vat_rate: i % 2 ? 10 : 20,
    }));
    source.totals = {
      ...source.totals,
      subtotal_cents: 148080,
      vat_cents: 22212,
      total_cents: 170292,
    };
    source.notes =
      'Informations de test : accès au chantier, références des équipements et observations détaillées.\n'.repeat(
        45,
      );
  }
  if (partialCreditNotes) {
    source.credit_note_scope = 'partial';
    source.items = source.items.map((line) => ({ ...line, quantity: line.quantity / 2 }));
    const groups = new Map();
    for (const line of source.items) {
      const base = Math.round(line.quantity * line.unit_price_cents);
      const key = `${line.vat_category}:${line.vat_rate}`;
      const group = groups.get(key) ?? { base: 0, rate: line.vat_rate };
      group.base += base;
      groups.set(key, group);
    }
    const subtotal = [...groups.values()].reduce((sum, group) => sum + group.base, 0);
    const vat = [...groups.values()].reduce(
      (sum, group) => sum + Math.round((group.base * group.rate) / 100),
      0,
    );
    source.totals = {
      ...source.totals,
      subtotal_cents: subtotal,
      vat_cents: vat,
      total_cents: subtotal + vat,
    };
  }
  const prepared = preparerExportCii(source);
  if (!prepared.invoice) throw new Error(name + ': ' + prepared.issues.join('; '));
  sources.push([name, prepared.invoice]);
}
for (const [name, invoice] of sources) {
  writeFileSync(new URL(`${name}.json`, folder), JSON.stringify(invoice));
  const result = await renderFacturX(PDFDocument, invoice, fonts, new Date('2026-09-03T14:00:00Z'));
  writeFileSync(new URL(`${name}.pdf`, folder), result.pdf);
  writeFileSync(new URL(`${name}.xml`, folder), result.xml);
  writeFileSync(new URL(`${name}.xml`, xmlFolder), result.xml);
  writeFileSync(new URL(`${name}.xml`, ublFolder), serializeUbl(invoice));
  console.log(`${name}: ${result.pdf.length} bytes`);
}

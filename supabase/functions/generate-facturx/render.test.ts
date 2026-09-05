import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// @ts-types="npm:@types/pdfkit@0.17.3"
import PDFDocument from 'npm:pdfkit@0.17.2';
import { renderFacturX } from '../_shared/facturx-render.ts';
import type { CanonicalInvoice } from '../../../src/features/einvoicing/canonical/types.ts';

Deno.test('Deno produit un PDF reproductible et refuse les caractères manquants', async () => {
  const fonts = {
    regular: await Deno.readFile(new URL('./assets/NotoSans-Regular.ttf', import.meta.url)),
    bold: await Deno.readFile(new URL('./assets/NotoSans-Bold.ttf', import.meta.url)),
  };
  for (const kind of ['facturx', 'credit-note', 'partial-credit-note']) {
    await Deno.mkdir(`test-results/${kind}-deno-fixtures`, { recursive: true });
    for (const name of ['standard', 'franchise', 'zero', 'reverse-charge', 'long']) {
      const invoice = JSON.parse(
        await Deno.readTextFile(`test-results/${kind}-fixtures/${name}.json`),
      ) as CanonicalInvoice;
      const result = await renderFacturX(
        PDFDocument,
        invoice,
        fonts,
        new Date('2026-09-03T14:00:00Z'),
      );
      await Deno.writeFile(`test-results/${kind}-deno-fixtures/${name}.pdf`, result.pdf);
      await Deno.writeTextFile(`test-results/${kind}-deno-fixtures/${name}.xml`, result.xml);
      assert.equal(
        result.xml,
        await Deno.readTextFile(`test-results/${kind}-fixtures/${name}.xml`),
      );
      if (name === 'standard') {
        const repeated = await renderFacturX(
          PDFDocument,
          invoice,
          fonts,
          new Date('2026-09-03T14:00:00Z'),
        );
        assert.equal(
          createHash('sha256').update(result.pdf).digest('hex'),
          createHash('sha256').update(repeated.pdf).digest('hex'),
          'Deux générations sur le serveur doivent être identiques',
        );
        invoice.note += ' 🛠';
        await assert.rejects(
          () => renderFacturX(PDFDocument, invoice, fonts, new Date()),
          /caractère/,
        );
      }
    }
  }
});

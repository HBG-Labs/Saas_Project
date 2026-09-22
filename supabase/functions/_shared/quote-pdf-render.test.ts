import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
// @ts-types="npm:@types/pdfkit@0.17.3"
import PDFDocument from 'npm:pdfkit@0.17.2';

import {
  renderQuotePdf,
  type QuotePdfInput,
  type QuotePdfOrganization,
} from './quote-pdf-render.ts';

/*
  Hors CI, comme `generate-facturx/render.test.ts` : `npm:pdfkit` a besoin de
  `--node-modules-dir`, que la CI n'installe pas pour ce module. À exécuter
  localement : `deno test --node-modules-dir=auto supabase/functions/_shared/quote-pdf-render.test.ts`.
*/

const ORG: QuotePdfOrganization = {
  name: 'HBG Labs',
  legal_name: 'HBG Labs SARL',
  address_line1: '1 rue du Bac à Sable',
  address_line2: null,
  postal_code: '75001',
  city: 'Paris',
  country: 'FR',
  registration_number: '123 456 789 00012',
  vat_number: 'FR12345678900',
  email: 'contact@hbglabs.fr',
  phone: '01 23 45 67 89',
  iban: 'FR76 1234 5678 9012 3456 7890 123',
  bic: 'BNPAFRPPXXX',
};

function quote(overrides: Partial<QuotePdfInput> = {}): QuotePdfInput {
  return {
    reference: 'DEV-0007',
    title: 'Installation électrique du cabinet',
    customer_name: 'Cabinet dentaire Dr Morel',
    site_name: 'Cabinet — RDC',
    notes: null,
    valid_until: '2026-10-20',
    issue_date: '2026-09-01',
    vat_rate: 20,
    gross_subtotal_cents: 118_400,
    discount_cents: 0,
    subtotal_cents: 118_400,
    vat_cents: 23_680,
    total_cents: 142_080,
    payment_terms: 'Paiement à 30 jours à compter de la réception.',
    payment_method: 'Virement bancaire / Carte bancaire Pro.',
    items: [
      {
        description: 'Tableau divisionnaire',
        unit: 'Forfait',
        quantity: 1,
        unit_price_cents: 142_000,
        line_total_cents: 142_000,
      },
    ],
    ...overrides,
  };
}

Deno.test('produit un PDF valide contenant les informations du devis', async () => {
  const pdf = await renderQuotePdf(PDFDocument, quote(), ORG, new Date('2026-09-16T10:00:00.000Z'));

  assert(pdf.length > 200);
  assertEquals(new TextDecoder().decode(pdf.slice(0, 5)), '%PDF-');
  // PDFKit compresse les flux par défaut ; le contenu textuel n'est donc pas
  // cherchable tel quel dans les octets. On vérifie plutôt le nombre de pages
  // et la taille — l'exactitude du texte est couverte par `handler.test.ts`,
  // qui contrôle les données transmises au moteur de rendu.
  const text = new TextDecoder('latin1').decode(pdf);
  assert(/\/Type\s*\/Page[^s]/.test(text), 'le document doit contenir au moins une page');
});

Deno.test('refuse un devis sans ligne', async () => {
  await assertRejects(
    () => renderQuotePdf(PDFDocument, quote({ items: [] }), ORG, new Date()),
    Error,
    'entre 1 et 500',
  );
});

Deno.test('refuse plus de 500 lignes', async () => {
  const items = Array.from({ length: 501 }, (_, i) => ({
    description: `Ligne ${i}`,
    unit: 'Unité',
    quantity: 1,
    unit_price_cents: 100,
    line_total_cents: 100,
  }));
  await assertRejects(
    () => renderQuotePdf(PDFDocument, quote({ items }), ORG, new Date()),
    Error,
    'entre 1 et 500',
  );
});

Deno.test('un devis à beaucoup de lignes déborde sur une deuxième page', async () => {
  const items = Array.from({ length: 60 }, (_, i) => ({
    description: `Prestation numéro ${i} — description suffisamment longue pour occuper de la place`,
    unit: 'Unité',
    quantity: 1,
    unit_price_cents: 5_000,
    line_total_cents: 5_000,
  }));
  const pdf = await renderQuotePdf(PDFDocument, quote({ items }), ORG, new Date());
  // Chaque page ajoute un objet `/Type /Page` : au moins deux pages signifie
  // au moins deux occurrences de ce motif dans le flux (non compressé ici).
  const text = new TextDecoder('latin1').decode(pdf);
  const pageCount = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  assert(pageCount >= 2, `attendu au moins 2 pages, trouvé ${pageCount}`);
});

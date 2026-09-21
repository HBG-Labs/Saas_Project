import { Buffer } from 'node:buffer';
import type PDFDocument from 'pdfkit';

/**
 * Le PDF d'un devis — sans les contraintes de Factur-X (pas de PDF/A-3, pas de
 * XML embarqué, pas de police intégrée à charger) : un devis n'est pas une
 * facture, aucun texte réglementaire ne l'exige. Polices standard de pdfkit
 * (Helvetica), aucun fichier d'actif à empaqueter avec la fonction.
 */

export const QUOTE_PDF_GENERATOR_VERSION = 'rezo360-quote-1';

export interface QuotePdfOrganization {
  name: string;
  legal_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  registration_number: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  bic: string | null;
}

export interface QuotePdfItem {
  description: string;
  unit: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

export interface QuotePdfInput {
  reference: string;
  title: string | null;
  customer_name: string | null;
  site_name: string | null;
  notes: string | null;
  valid_until: string | null;
  created_at: string;
  vat_rate: number;
  gross_subtotal_cents: number;
  discount_cents: number;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  payment_terms: string;
  payment_method: string;
  items: QuotePdfItem[];
}

function euros(cents: number): string {
  const value = (cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value} €`;
}

function dateFr(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Même patron que `renderFacturX` : PDFKit injecté, octets collectés via `data`/`end`. */
export async function renderQuotePdf(
  PDF: typeof PDFDocument,
  quote: QuotePdfInput,
  organization: QuotePdfOrganization,
  generatedAt: Date,
  logoBytes?: Uint8Array | null,
): Promise<Uint8Array> {
  if (quote.items.length === 0 || quote.items.length > 500) {
    throw new Error('Le devis doit comporter entre 1 et 500 lignes.');
  }

  const doc = new PDF({
    size: 'A4',
    margin: 50,
    bufferPages: true,
    lang: 'fr-FR',
    info: {
      Title: `Devis ${quote.reference}`,
      Author: organization.legal_name ?? organization.name,
    },
  });

  const chunks: Buffer[] = [];
  const completed = new Promise<Uint8Array>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on('error', reject);
  });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  // ---------------------------------------------------------------- en-tête
  let organizationLeft = left;
  if (logoBytes?.length) {
    try {
      doc.image(Buffer.from(logoBytes), left, 48, {
        fit: [92, 52],
        align: 'left',
        valign: 'center',
      });
      organizationLeft += 105;
    } catch {
      // Un logo corrompu ne doit jamais empêcher la production du devis.
    }
  }
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#111827')
    .text(organization.legal_name ?? organization.name, organizationLeft, 50, { width: 250 });
  doc.font('Helvetica').fontSize(9).fillColor('#4b5563');
  const orgLines = [
    [organization.address_line1, organization.address_line2].filter(Boolean).join(' '),
    [organization.postal_code, organization.city].filter(Boolean).join(' '),
    organization.registration_number ? `SIRET ${organization.registration_number}` : null,
    organization.vat_number ? `TVA ${organization.vat_number}` : null,
    organization.email,
    organization.phone,
  ].filter((line): line is string => Boolean(line && line.trim() !== ''));
  doc.moveDown(0.3);
  for (const line of orgLines) doc.text(line, organizationLeft);

  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#111827')
    .text('DEVIS', left, 50, { width, align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor('#374151');
  doc.text(quote.reference, left, 78, { width, align: 'right' });
  doc.fontSize(9).fillColor('#6b7280');
  doc.text(`Émis le ${dateFr(quote.created_at)}`, { width, align: 'right' });
  if (quote.valid_until)
    doc.text(`Valable jusqu'au ${dateFr(quote.valid_until)}`, { width, align: 'right' });

  doc.moveDown(1.5);
  const clientY = doc.y + 10;
  doc.moveTo(left, clientY).lineTo(right, clientY).strokeColor('#e5e7eb').lineWidth(1).stroke();

  // -------------------------------------------------------------- client
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#6b7280')
    .text('CLIENT', left, clientY + 14);
  doc.font('Helvetica').fontSize(11).fillColor('#111827');
  doc.text(quote.customer_name ?? '—', left, clientY + 28);
  if (quote.site_name) doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(quote.site_name);
  if (quote.title) {
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#6b7280')
      .text('OBJET', left, clientY + 14, { width, align: 'right' });
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#111827')
      .text(quote.title, left, clientY + 28, { width, align: 'right' });
  }

  // -------------------------------------------------------------- tableau
  let y = clientY + 70;
  const cols = {
    description: left,
    unit: left + 260,
    qty: left + 330,
    price: left + 390,
    total: left + 470,
  };
  const colWidth = { description: 205, unit: 65, qty: 55, price: 75, total: right - cols.total };

  function header() {
    doc.rect(left, y, width, 20).fill('#f3f4f6');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151');
    doc.text('Désignation', cols.description + 4, y + 6, { width: colWidth.description });
    doc.text('Unité', cols.unit, y + 6, { width: colWidth.unit, align: 'right' });
    doc.text('Qté', cols.qty, y + 6, { width: colWidth.qty, align: 'right' });
    doc.text('P.U. HT', cols.price, y + 6, { width: colWidth.price, align: 'right' });
    doc.text('Total HT', cols.total, y + 6, { width: colWidth.total, align: 'right' });
    y += 24;
  }
  header();

  const bottomLimit = doc.page.height - doc.page.margins.bottom - 140;
  for (const item of quote.items) {
    doc.font('Helvetica').fontSize(9).fillColor('#111827');
    const lineHeight = doc.heightOfString(item.description, { width: colWidth.description });
    const rowHeight = Math.max(16, lineHeight + 4);
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = doc.page.margins.top;
      header();
    }
    doc.text(item.description, cols.description + 4, y, { width: colWidth.description });
    doc.fillColor('#4b5563');
    doc.text(item.unit, cols.unit, y, { width: colWidth.unit, align: 'right' });
    doc.text(String(item.quantity), cols.qty, y, { width: colWidth.qty, align: 'right' });
    doc.text(euros(item.unit_price_cents), cols.price, y, {
      width: colWidth.price,
      align: 'right',
    });
    doc.fillColor('#111827').font('Helvetica-Bold');
    doc.text(euros(item.line_total_cents), cols.total, y, {
      width: colWidth.total,
      align: 'right',
    });
    y += rowHeight;
    doc.moveTo(left, y).lineTo(right, y).strokeColor('#f3f4f6').lineWidth(0.5).stroke();
    y += 4;
  }

  // -------------------------------------------------------------- totaux
  if (y + 90 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  y += 10;
  const totalsX = right - 200;
  function totalRow(label: string, value: string, bold = false) {
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(bold ? 11 : 9)
      .fillColor(bold ? '#111827' : '#4b5563');
    doc.text(label, totalsX, y, { width: 110 });
    doc.text(value, totalsX + 110, y, { width: 90, align: 'right' });
    y += bold ? 18 : 14;
  }
  if (quote.discount_cents > 0) {
    totalRow('Sous-total HT', euros(quote.gross_subtotal_cents));
    totalRow('Remise globale', `− ${euros(quote.discount_cents)}`);
  }
  totalRow('Total HT', euros(quote.subtotal_cents));
  totalRow(`TVA (${quote.vat_rate} %)`, euros(quote.vat_cents));
  doc.moveTo(totalsX, y).lineTo(right, y).strokeColor('#d1d5db').lineWidth(1).stroke();
  y += 6;
  totalRow('Total TTC', euros(quote.total_cents), true);

  // -------------------------------------------------------------- pied
  y += 20;
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#374151')
    .text('Conditions de règlement', left, y);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#4b5563')
    .text(quote.payment_terms, left, y + 13, { width });
  y = doc.y + 8;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151').text('Mode de règlement', left, y);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#4b5563')
    .text(quote.payment_method, left, y + 13, { width });
  y = doc.y;

  if (organization.iban) {
    y += 8;
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
    doc.text(
      `IBAN : ${organization.iban}${organization.bic ? `  ·  BIC : ${organization.bic}` : ''}`,
      left,
      y,
    );
  }

  if (quote.notes) {
    y = doc.y + 12;
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text(quote.notes, left, y, { width });
  }

  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i += 1) {
    doc.switchToPage(pageRange.start + i);
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#9ca3af')
      .text(
        `Document généré le ${generatedAt.toLocaleDateString('fr-FR', { timeZone: 'UTC' })} — page ${i + 1}/${pageRange.count}`,
        left,
        doc.page.height - doc.page.margins.bottom + 10,
        { width, align: 'center' },
      );
  }

  doc.end();
  return completed;
}

import { Buffer } from 'node:buffer';
import type PDFDocument from 'pdfkit';

/**
 * Le PDF d'un devis — sans les contraintes de Factur-X (pas de PDF/A-3, pas de
 * XML embarqué, pas de police intégrée à charger) : un devis n'est pas une
 * facture, aucun texte réglementaire ne l'exige. Polices standard de pdfkit
 * (Helvetica), aucun fichier d'actif à empaqueter avec la fonction.
 */

export const QUOTE_PDF_GENERATOR_VERSION = 'rezo360-quote-2';

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
  issue_date: string;
  customer_address?: string[];
  customer_registration_number?: string | null;
  customer_vat_number?: string | null;
  document_options?: {
    mode?: 'quick' | 'complete' | 'electronic';
    sellerName?: string | null;
    logoWidth?: number;
    logoHeight?: number;
    showDeliveryAddress?: boolean;
    showRegistrationNumber?: boolean;
    showVatNumber?: boolean;
    showBankDetails?: boolean;
    showTitle?: boolean;
    showFreeField?: boolean;
    showSignature?: boolean;
    showAcceptanceTerms?: boolean;
  } | null;
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
  const value = (cents / 100)
    .toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/[\u00a0\u202f]/g, ' ');
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

/**
 * Rend le devis dans la même grammaire visuelle que la facture lisible de
 * l'application : vert sauge, panneaux très pâles, tableau aéré et synthèse
 * latérale. Les mentions propres au devis (validité, accord et signature)
 * restent présentes sans créer un second langage graphique.
 */
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
  const sellerName =
    quote.document_options?.sellerName?.trim() || organization.legal_name || organization.name;

  const doc = new PDF({
    size: 'A4',
    margin: 50,
    bufferPages: true,
    lang: 'fr-FR',
    info: {
      Title: `Devis ${quote.reference}`,
      Author: sellerName,
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
  const colors = {
    ink: '#1e293b',
    text: '#475569',
    muted: '#64748b',
    brand: '#3f6259',
    accent: '#52796f',
    soft: '#e9f1ed',
    panel: '#f8fafc',
    panelBorder: '#e2e8f0',
    table: '#edf3f0',
    tableBorder: '#c4d3cc',
    signature: '#abc3b8',
  } as const;

  const option = (key: keyof NonNullable<QuotePdfInput['document_options']>, fallback = false) =>
    quote.document_options ? quote.document_options[key] === true : fallback;
  const addressLine = [
    organization.address_line1,
    organization.address_line2,
    organization.postal_code,
    organization.city,
    organization.country,
  ]
    .filter(Boolean)
    .join(' · ');
  const contactLine = [organization.email, organization.phone].filter(Boolean).join(' · ');
  const identityLine = [
    organization.registration_number ? `SIRET : ${organization.registration_number}` : null,
    organization.vat_number ? `TVA : ${organization.vat_number}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  let y = 0;

  function drawContinuationHeader() {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.brand);
    doc.text(sellerName, left, 48, { width: 270, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.brand);
    doc.text(`DEVIS ${quote.reference} - SUITE`, left + 285, 49, {
      width: width - 285,
      align: 'right',
      lineBreak: false,
    });
    doc.moveTo(left, 68).lineTo(right, 68).strokeColor(colors.panelBorder).lineWidth(0.7).stroke();
    y = 82;
  }

  function addPage() {
    doc.addPage();
    drawContinuationHeader();
  }

  // ---------------------------------------------------------------- en-tête
  const configuredLogoWidth = Math.min(
    320,
    Math.max(120, quote.document_options?.logoWidth ?? 176),
  );
  const configuredLogoHeight = Math.min(
    180,
    Math.max(64, quote.document_options?.logoHeight ?? 80),
  );
  const logoWidth = configuredLogoWidth * 0.32;
  const logoHeight = configuredLogoHeight * 0.32;
  let brandX = left;
  let brandWidth = 285;
  let logoRendered = false;
  if (logoBytes?.length) {
    try {
      doc.image(Buffer.from(logoBytes), left, 48, {
        fit: [logoWidth, logoHeight],
        valign: 'center',
      });
      brandX = left + logoWidth + 12;
      brandWidth = Math.max(130, 285 - logoWidth - 12);
      logoRendered = true;
    } catch {
      // Un logo corrompu ne doit jamais empêcher la production du devis.
    }
  }

  doc.font('Helvetica-Bold').fontSize(14).fillColor(colors.brand);
  doc.text(sellerName, brandX, 51, { width: brandWidth, lineBreak: false, ellipsis: true });
  let sellerY = 70;
  if (organization.legal_name && organization.legal_name !== sellerName) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.text);
    doc.text(organization.legal_name, brandX, sellerY, {
      width: brandWidth,
      lineBreak: false,
      ellipsis: true,
    });
    sellerY += 11;
  }
  if (identityLine) {
    doc.font('Helvetica').fontSize(7.5).fillColor(colors.muted);
    doc.text(identityLine, brandX, sellerY, {
      width: brandWidth,
      lineBreak: false,
      ellipsis: true,
    });
  }

  const labelX = left + 325;
  doc.roundedRect(labelX, 48, width - 325, 22, 5).fill(colors.soft);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(colors.brand);
  doc.text(`DEVIS N° ${quote.reference}`, labelX + 8, 55, {
    width: width - 341,
    align: 'center',
    lineBreak: false,
    ellipsis: true,
  });
  doc.font('Helvetica').fontSize(7.5).fillColor(colors.muted);
  doc.text(`Émis le : ${dateFr(quote.issue_date)}`, labelX, 77, {
    width: width - 325,
    align: 'right',
  });
  if (quote.valid_until) {
    doc.text(`Valide jusqu'au : ${dateFr(quote.valid_until)}`, labelX, 89, {
      width: width - 325,
      align: 'right',
    });
  }

  const headerBottom = Math.max(112, logoRendered ? 48 + logoHeight + 10 : 0);
  doc
    .moveTo(left, headerBottom)
    .lineTo(right, headerBottom)
    .strokeColor(colors.panelBorder)
    .lineWidth(0.7)
    .stroke();
  y = headerBottom + 12;
  if (addressLine || contactLine) {
    doc.font('Helvetica').fontSize(7.5).fillColor(colors.text);
    if (addressLine) {
      doc.text(addressLine, left, y, { width, lineBreak: false, ellipsis: true });
      y += 11;
    }
    if (contactLine) {
      doc.text(contactLine, left, y, { width, lineBreak: false, ellipsis: true });
      y += 11;
    }
    y += 5;
  }

  if (quote.title && option('showTitle', true)) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.ink);
    doc.text(quote.title, left, y, { width });
    y = doc.y + 10;
  }

  // -------------------------------------------------------------- client
  const customerDetails = [
    ...(option('showDeliveryAddress') ? (quote.customer_address ?? []) : []),
    option('showRegistrationNumber') && quote.customer_registration_number
      ? `SIRET : ${quote.customer_registration_number}`
      : null,
    option('showVatNumber') && quote.customer_vat_number
      ? `TVA : ${quote.customer_vat_number}`
      : null,
  ].filter((line): line is string => Boolean(line));
  const panelHeight = Math.max(70, 52 + customerDetails.length * 10);
  doc.roundedRect(left, y, width, panelHeight, 7).fillAndStroke(colors.panel, colors.panelBorder);
  const panelMiddle = left + width / 2;
  doc.font('Helvetica-Bold').fontSize(7).fillColor(colors.muted);
  doc.text('DESTINATAIRE', left + 12, y + 12, { width: width / 2 - 24 });
  doc.text("SITE D'INTERVENTION", panelMiddle + 8, y + 12, { width: width / 2 - 20 });
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(colors.ink);
  doc.text(quote.customer_name ?? 'Client non spécifié', left + 12, y + 28, {
    width: width / 2 - 24,
    lineBreak: false,
    ellipsis: true,
  });
  doc.text(quote.site_name ?? 'Site principal', panelMiddle + 8, y + 28, {
    width: width / 2 - 20,
    lineBreak: false,
    ellipsis: true,
  });
  let customerY = y + 43;
  doc.font('Helvetica').fontSize(7).fillColor(colors.muted);
  for (const line of customerDetails) {
    doc.text(line, left + 12, customerY, {
      width: width / 2 - 24,
      lineBreak: false,
      ellipsis: true,
    });
    customerY += 10;
  }
  y += panelHeight + 14;

  // -------------------------------------------------------------- tableau
  const columnWidths = {
    description: 216,
    quantity: 38,
    unit: 52,
    price: 69,
    vat: 44,
    total: width - 419,
  };
  const columns = {
    description: left,
    quantity: left + columnWidths.description,
    unit: left + columnWidths.description + columnWidths.quantity,
    price: left + columnWidths.description + columnWidths.quantity + columnWidths.unit,
    vat:
      left +
      columnWidths.description +
      columnWidths.quantity +
      columnWidths.unit +
      columnWidths.price,
    total: left + 419,
  };

  function drawTableHeader() {
    doc.rect(left, y, width, 22).fill(colors.table);
    doc
      .moveTo(left, y + 22)
      .lineTo(right, y + 22)
      .strokeColor(colors.tableBorder)
      .lineWidth(0.7)
      .stroke();
    doc.font('Helvetica-Bold').fontSize(7).fillColor(colors.brand);
    doc.text('Désignation', columns.description + 7, y + 7, {
      width: columnWidths.description - 14,
    });
    doc.text('Qté', columns.quantity, y + 7, {
      width: columnWidths.quantity,
      align: 'center',
    });
    doc.text('Unité', columns.unit, y + 7, { width: columnWidths.unit, align: 'center' });
    doc.text('P.U HT', columns.price, y + 7, { width: columnWidths.price, align: 'right' });
    doc.text('TVA', columns.vat, y + 7, { width: columnWidths.vat, align: 'center' });
    doc.text('Total HT', columns.total, y + 7, {
      width: columnWidths.total,
      align: 'right',
    });
    y += 28;
  }
  drawTableHeader();

  const bottomLimit = doc.page.height - doc.page.margins.bottom - 155;
  for (const item of quote.items) {
    doc.font('Helvetica').fontSize(8).fillColor(colors.ink);
    const lineHeight = doc.heightOfString(item.description, {
      width: columnWidths.description - 14,
    });
    const rowHeight = Math.max(23, lineHeight + 10);
    if (y + rowHeight > bottomLimit) {
      addPage();
      drawTableHeader();
    }
    const textY = y + 5;
    doc.text(item.description, columns.description + 7, textY, {
      width: columnWidths.description - 14,
    });
    doc.font('Helvetica').fillColor(colors.ink);
    doc.text(String(item.quantity), columns.quantity, textY, {
      width: columnWidths.quantity,
      align: 'center',
    });
    doc.fillColor(colors.muted);
    doc.text(item.unit, columns.unit, textY, { width: columnWidths.unit, align: 'center' });
    doc.fillColor(colors.ink);
    doc.text(euros(item.unit_price_cents), columns.price, textY, {
      width: columnWidths.price,
      align: 'right',
    });
    doc.fillColor(colors.muted);
    doc.text(`${quote.vat_rate.toLocaleString('fr-FR')} %`, columns.vat, textY, {
      width: columnWidths.vat,
      align: 'center',
    });
    doc.fillColor(colors.ink).font('Helvetica-Bold');
    doc.text(euros(item.line_total_cents), columns.total, textY, {
      width: columnWidths.total,
      align: 'right',
    });
    y += rowHeight;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(colors.panelBorder).lineWidth(0.5).stroke();
  }

  // ---------------------------------------------------- notes et synthèse
  y += 12;
  if (quote.notes && option('showFreeField', true)) {
    doc.font('Helvetica').fontSize(7.5).fillColor(colors.text);
    const notesHeight = Math.max(36, doc.heightOfString(quote.notes, { width: width - 20 }) + 18);
    if (y + notesHeight > bottomLimit) addPage();
    doc
      .roundedRect(left, y, width, notesHeight, 6)
      .dash(3, { space: 3 })
      .strokeColor(colors.signature)
      .lineWidth(0.7)
      .stroke();
    doc.undash();
    doc.text(quote.notes, left + 10, y + 9, { width: width - 20 });
    y += notesHeight + 14;
  }

  const totalRows = 3 + (quote.discount_cents > 0 ? 2 : 0);
  const summaryHeight = Math.max(74, 22 + totalRows * 14);
  if (y + summaryHeight + (option('showSignature') ? 86 : 20) > doc.page.height - 65) {
    addPage();
  }
  doc.moveTo(left, y).lineTo(right, y).strokeColor(colors.panelBorder).lineWidth(0.8).stroke();
  const summaryTop = y + 13;
  const totalsX = right - 195;
  doc
    .moveTo(totalsX - 14, summaryTop)
    .lineTo(totalsX - 14, summaryTop + summaryHeight - 15)
    .strokeColor(colors.panelBorder)
    .lineWidth(0.7)
    .stroke();

  let conditionsY = summaryTop;
  if (option('showAcceptanceTerms', true)) {
    doc.font('Helvetica').fontSize(7.2).fillColor(colors.muted);
    doc.text(`Conditions de règlement : ${quote.payment_terms}`, left, conditionsY, {
      width: totalsX - left - 28,
    });
    conditionsY = doc.y + 5;
    doc.text(`Mode de paiement : ${quote.payment_method}`, left, conditionsY, {
      width: totalsX - left - 28,
    });
  }

  let totalsY = summaryTop;
  function totalRow(label: string, value: string, bold = false) {
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(bold ? 10 : 7.5)
      .fillColor(bold ? colors.brand : colors.text);
    doc.text(label, totalsX, totalsY, { width: 91 });
    doc.text(value, totalsX + 91, totalsY, { width: 104, align: 'right' });
    totalsY += bold ? 19 : 14;
  }
  if (quote.discount_cents > 0) {
    totalRow('Sous-total HT', euros(quote.gross_subtotal_cents));
    totalRow('Remise globale', `- ${euros(quote.discount_cents)}`);
  }
  totalRow('Total HT', euros(quote.subtotal_cents));
  totalRow(`TVA (${quote.vat_rate} %)`, euros(quote.vat_cents));
  doc
    .moveTo(totalsX, totalsY)
    .lineTo(right, totalsY)
    .strokeColor(colors.tableBorder)
    .lineWidth(0.8)
    .stroke();
  totalsY += 7;
  totalRow('Total TTC', euros(quote.total_cents), true);
  y = summaryTop + summaryHeight;

  // -------------------------------------------------------------- pied
  if (organization.iban && option('showBankDetails', true)) {
    doc.font('Helvetica').fontSize(7.2).fillColor(colors.muted);
    doc.text(
      `IBAN : ${organization.iban}${organization.bic ? `  ·  BIC : ${organization.bic}` : ''}`,
      left,
      y,
      { width },
    );
    y = doc.y + 12;
  } else {
    y += 12;
  }

  if (option('showSignature')) {
    if (y + 70 > doc.page.height - 65) addPage();
    doc.roundedRect(left, y, width, 58, 7).fillAndStroke(colors.panel, colors.panelBorder);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(colors.ink)
      .text('Bon pour accord', left + 12, y + 12);
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(colors.muted)
      .text('Mention manuscrite, date et signature du client', left + 12, y + 27);
    doc
      .roundedRect(right - 145, y + 9, 133, 40, 5)
      .dash(3, { space: 3 })
      .strokeColor(colors.signature)
      .lineWidth(0.7)
      .stroke();
    doc.undash();
    doc
      .font('Helvetica-Oblique')
      .fontSize(7)
      .fillColor(colors.muted)
      .text('Emplacement signature', right - 139, y + 25, { width: 121, align: 'center' });
  }

  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i += 1) {
    doc.switchToPage(pageRange.start + i);
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(colors.muted)
      .text(
        `Document généré le ${generatedAt.toLocaleDateString('fr-FR', { timeZone: 'UTC' })} - page ${i + 1}/${pageRange.count}`,
        left,
        doc.page.height - doc.page.margins.bottom - 12,
        { width, align: 'center' },
      );
  }

  doc.end();
  return completed;
}

import { Buffer } from 'node:buffer';
import type PDFDocument from 'pdfkit';
import type {
  CanonicalInvoice,
  PostalAddress,
} from '../../../src/features/einvoicing/canonical/types.ts';
import { serializeCii } from '../../../src/features/einvoicing/serializers/cii.ts';

export const FACTURX_GENERATOR_VERSION = 'rezo360-fx-4';
export const FACTURX_PROFILE = 'EN 16931';
const FX_NS = 'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#';
const properties = {
  DocumentFileName: 'Name of the embedded XML invoice file',
  DocumentType: 'Type of the hybrid document',
  Version: 'Version of the Factur-X XML schema',
  ConformanceLevel: 'Conformance level of the embedded XML invoice',
};
const extensionMetadata = `<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">
<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
<pdfaSchema:namespaceURI>${FX_NS}</pdfaSchema:namespaceURI><pdfaSchema:prefix>fx</pdfaSchema:prefix>
<pdfaSchema:property><rdf:Seq>${Object.entries(properties)
  .map(
    ([name, description]) =>
      `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${name}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${description}</pdfaProperty:description></rdf:li>`,
  )
  .join('')}</rdf:Seq></pdfaSchema:property>
</rdf:li></rdf:Bag></pdfaExtension:schemas></rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="${FX_NS}"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>EN 16931</fx:ConformanceLevel></rdf:Description>`;

/** Same renderer in Node validation and Deno production; PDFKit is injected. */
export async function renderFacturX(
  PDF: typeof PDFDocument,
  invoice: CanonicalInvoice,
  fonts: { regular: Uint8Array; bold: Uint8Array },
  generatedAt: Date,
): Promise<{ pdf: Uint8Array; xml: string }> {
  const isCreditNote = invoice.documentType === 'credit_note';
  const documentLabel = isCreditNote ? 'AVOIR' : 'FACTURE';
  const heading = invoice.isTest ? `${documentLabel} - TEST` : documentLabel;
  if (!invoice.lines.length || invoice.lines.length > 500)
    throw new Error('Le document doit comporter entre 1 et 500 lignes.');
  const xml = serializeCii(invoice);
  if (Buffer.byteLength(xml) > 1_000_000)
    throw new Error('Le contenu de la facture est trop volumineux.');
  const doc = new PDF({
    subset: 'PDF/A-3b',
    pdfVersion: '1.7',
    size: 'A4',
    margin: 44,
    bufferPages: true,
    // PDFKit 0.17.2 accepts an embedded font buffer here; @types still says string.
    font: Buffer.from(fonts.regular) as unknown as string,
    lang: 'fr-FR',
    // PDFKit interpolates these fields into XMP: no unescaped customer text.
    info: {
      Title: isCreditNote
        ? invoice.isTest
          ? 'TEST - Simulation d’avoir'
          : 'Avoir'
        : invoice.isTest
          ? 'TEST - Simulation de facture'
          : 'Facture',
      Author: 'REZO360',
      Creator: FACTURX_GENERATOR_VERSION,
      CreationDate: generatedAt,
      ModDate: generatedAt,
    },
  });
  doc.registerFont('regular', Buffer.from(fonts.regular));
  doc.registerFont('bold', Buffer.from(fonts.bold));
  const chunks: Buffer[] = [];
  const completed = new Promise<Uint8Array>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on('error', reject);
  });
  const ink = '#172B45',
    blue = '#234EA0',
    muted = '#54647A';
  const left = 44,
    width = doc.page.width - 88,
    bottom = 756;
  let y = 44;
  const font = (bold = false, size = 9.5) => doc.font(bold ? 'bold' : 'regular').fontSize(size);
  function write(value: string, x: number, top: number, options: PDFKit.Mixins.TextOptions = {}) {
    // A missing glyph would silently discard part of an invoice. Reject it.
    const embedded = (
      doc as unknown as { _font: { font: { hasGlyphForCodePoint: (code: number) => boolean } } }
    )._font.font;
    for (const char of value) {
      if (!/\s/.test(char) && !embedded.hasGlyphForCodePoint(char.codePointAt(0)!))
        throw new Error('Un caractère de la facture ne peut pas être reproduit dans le PDF.');
    }
    doc.text(value, x, top, options);
  }
  function rule(top: number) {
    doc
      .strokeColor('#DCE3ED')
      .lineWidth(0.6)
      .moveTo(left, top)
      .lineTo(left + width, top)
      .stroke();
  }
  function page() {
    doc.addPage();
    y = 44;
    font(true, 10).fillColor(blue);
    write(heading, left, y);
    font(false, 9).fillColor(muted);
    write(invoice.id, left + 110, y, { width: width - 110, align: 'right' });
    y += 30;
    rule(y);
    y += 16;
  }
  function ensure(height: number) {
    if (y + height > bottom) page();
  }
  function wrap(value: string, maxWidth: number) {
    const result: string[] = [];
    for (const paragraph of value.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (doc.widthOfString(next) <= maxWidth) {
          line = next;
          continue;
        }
        if (line) {
          result.push(line);
          line = '';
        }
        for (const char of word) {
          if (line && doc.widthOfString(line + char) > maxWidth) {
            result.push(line);
            line = '';
          }
          line += char;
        }
      }
      result.push(line);
    }
    return result;
  }
  function section(label: string, value: string) {
    if (!value) return;
    ensure(42);
    y += 8;
    font(true, 9).fillColor(blue);
    write(label.toUpperCase(), left, y);
    y += 16;
    font(false, 9).fillColor(ink);
    const lines = wrap(value, width);
    for (const line of lines) {
      ensure(13);
      font(false, 9).fillColor(ink);
      write(line, left, y, { lineBreak: false });
      y += 13;
    }
  }
  const dateFr = (value: string) => value.split('-').reverse().join('/');
  const money = (cents: number) =>
    (cents / 100)
      .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .replaceAll('\u202f', ' ');
  const address = (value: PostalAddress) =>
    [value.line1, value.line2, `${value.postalCode} ${value.city}`, value.country]
      .filter(Boolean)
      .join('\n');
  try {
    font(true, 23).fillColor(blue);
    write(heading, left, y);
    font(false, 9).fillColor(muted);
    write('FACTUR-X · EN 16931', left + 275, y + 9, { width: width - 275, align: 'right' });
    y += 30;
    font(true, 13).fillColor(ink);
    const refHeight = doc.heightOfString(invoice.id, { width });
    if (refHeight > 40) throw new Error('La référence de facture est trop longue pour le PDF.');
    write(invoice.id, left, y, { width });
    y += refHeight + 8;
    font(false, 9).fillColor(muted);
    write(
      `${invoice.isTest ? 'Simulation du' : isCreditNote ? 'Émis le' : 'Émise le'} ${dateFr(invoice.issueDate)}  ·  Prestation / livraison le ${dateFr(invoice.deliveryDate)}`,
      left,
      y,
      { width },
    );
    y += 22;
    rule(y);
    y += 14;
    const partyWidth = (width - 32) / 2;
    const partyTop = y;
    let partyBottom = y;
    for (const [index, label, value] of [
      [0, 'ÉMETTEUR', invoice.seller],
      [1, 'DESTINATAIRE', invoice.buyer],
    ] as const) {
      const x = left + index * (partyWidth + 32);
      font(true, 8).fillColor(blue);
      write(label, x, partyTop);
      let top = partyTop + 18;
      const fields = [
        value.name,
        address(value.address),
        `SIREN : ${value.siren}`,
        value.vatNumber ? `TVA : ${value.vatNumber}` : '',
        value.legalInformation ?? '',
      ].filter(Boolean);
      fields.forEach((field, fieldIndex) => {
        font(fieldIndex === 0, fieldIndex === 0 ? 10 : 8.5).fillColor(ink);
        const h = doc.heightOfString(field, { width: partyWidth, lineGap: 2 });
        if (top + h > partyTop + 205)
          throw new Error('Les coordonnées sont trop longues pour le PDF.');
        write(field, x, top, { width: partyWidth, lineGap: 2 });
        top += h + 2;
      });
      partyBottom = Math.max(partyBottom, top);
    }
    y = partyBottom + 4;
    if (isCreditNote)
      section(
        'Facture corrigée',
        `${invoice.precedingInvoice.id} · Émise le ${dateFr(invoice.precedingInvoice.issueDate)} · Avoir ${invoice.creditNoteScope === 'partial' ? 'partiel' : 'total'}`,
      );
    if (invoice.buyerReference || invoice.purchaseOrderReference)
      section(
        'Références client',
        [
          invoice.buyerReference ? `Service : ${invoice.buyerReference}` : '',
          invoice.purchaseOrderReference ? `Commande : ${invoice.purchaseOrderReference}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      );
    y += 10;
    const columns = [left, left + 247, left + 289, left + 366, left + 422];
    const widths = [237, 37, 70, 49, width - 422];
    function tableHeader() {
      ensure(60);
      doc.rect(left, y, width, 27).fill('#EEF3FC');
      font(true, 8).fillColor(ink);
      ['DÉSIGNATION', 'QTÉ', 'P.U. HT', 'TVA', 'TOTAL HT'].forEach((label, i) =>
        write(label, columns[i]! + (i === 0 ? 8 : 0), y + 8, {
          width: widths[i]! - (i === 0 ? 8 : 0),
          align: i === 0 ? 'left' : 'right',
          lineBreak: false,
        }),
      );
      y += 32;
    }
    tableHeader();
    for (const line of invoice.lines) {
      font(false, 9).fillColor(ink);
      const wrapped = wrap(line.description, widths[0]! - 8);
      const values = [
        `${line.quantity.replace('.', ',')}`,
        money(line.unitPriceCents),
        `${line.vatRate.toLocaleString('fr-FR')} %`,
        money(line.netCents),
      ];
      let first = true;
      for (const textLine of wrapped) {
        if (y + 28 > bottom) {
          page();
          tableHeader();
        }
        font(false, 9).fillColor(ink);
        write(textLine, left + 8, y, { lineBreak: false });
        if (first) {
          values.forEach((value, i) => {
            font(false, 9);
            if (doc.widthOfString(value) > widths[i + 1]!) font(false, 7);
            if (doc.widthOfString(value) > widths[i + 1]!)
              throw new Error('Un montant ou une quantité est trop long pour le PDF.');
            write(value, columns[i + 1]!, y, {
              width: widths[i + 1]!,
              align: 'right',
              lineBreak: false,
            });
          });
          first = false;
        }
        y += 14;
      }
      font(false, 7).fillColor(muted);
      write(`Unité : ${line.unitCode}`, left + 8, y, { lineBreak: false });
      y += 17;
      rule(y);
      y += 6;
    }
    ensure(112);
    y += 4;
    font(false, 9).fillColor(muted);
    write('Montants en euros', left, y);
    for (const [label, cents] of [
      ['Total HT', invoice.netCents],
      ['TVA', invoice.taxCents],
    ] as const) {
      font(false, 10).fillColor(ink);
      write(label, left + 290, y);
      write(money(cents), left + 407, y, { width: width - 407, align: 'right' });
      y += 23;
    }
    const totalLeft = isCreditNote ? 200 : 279;
    doc.rect(left + totalLeft, y - 3, width - totalLeft, 34).fill(blue);
    font(true, 11).fillColor('#FFFFFF');
    write(isCreditNote ? 'Total à créditer' : 'Total TTC', left + totalLeft + 11, y + 5);
    write(`${money(invoice.totalCents)} €`, left + 386, y + 5, {
      width: width - 397,
      align: 'right',
      lineBreak: false,
    });
    y += 40;
    section(
      'Détail de TVA',
      invoice.vatBreakdown
        .map(
          (group) =>
            `${group.rate.toLocaleString('fr-FR')} % (${group.category}) · Base HT : ${money(group.baseCents)} € · TVA : ${money(group.taxCents)} €${group.exemptionReason ? '\n' + group.exemptionReason : ''}`,
        )
        .join('\n'),
    );
    if (invoice.deliveryAddress) section('Adresse de livraison', address(invoice.deliveryAddress));
    section('Informations', invoice.note);
    section(
      isCreditNote ? 'Remboursement ou imputation' : 'Règlement',
      `Échéance : ${dateFr(invoice.dueDate)}\n${invoice.paymentTerms}`,
    );
    const pages = doc.bufferedPageRange();
    for (let index = 0; index < pages.count; index++) {
      doc.switchToPage(index);
      rule(772);
      font(false, 7).fillColor(muted);
      write(
        invoice.isTest
          ? isCreditNote
            ? 'TEST - NON EMIS - NE PAS COMPTABILISER'
            : 'TEST - NON EMISE - NE PAS COMPTABILISER'
          : isCreditNote
            ? 'Avoir électronique · Factur-X'
            : 'Facture électronique · Factur-X',
        left,
        782,
        { lineBreak: false },
      );
      write(`Page ${index + 1} / ${pages.count}`, left + width - 100, 782, {
        width: 100,
        align: 'right',
        lineBreak: false,
      });
    }
    // AFRelationship is implemented by PDFKit but omitted from @types/pdfkit.
    const attachmentOptions = {
      name: 'factur-x.xml',
      type: 'text/xml',
      relationship: 'Alternative',
      description: isCreditNote ? 'Avoir structuré EN 16931' : 'Facture structurée EN 16931',
      creationDate: generatedAt,
      modifiedDate: generatedAt,
    };
    doc.file(new TextEncoder().encode(xml).buffer, attachmentOptions);
    doc.appendXML(extensionMetadata);
    doc.end();
    return { pdf: await completed, xml };
  } catch (error) {
    (doc as unknown as { destroy: () => void }).destroy();
    throw error;
  }
}

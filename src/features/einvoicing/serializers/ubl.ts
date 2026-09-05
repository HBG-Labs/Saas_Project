import { formatMoney } from '../canonical/decimal.ts';
import type { CanonicalInvoice, InvoiceParty, PostalAddress } from '../canonical/types.ts';

/** XML 1.0 : refuser un caractère interdit évite de produire un fichier illisible. */
export function xmlText(value: string): string {
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (!(
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      (code >= 0x10000 && code <= 0x10ffff)
    ))
      throw new Error('Une information contient un caractère incompatible avec le format XML.');
  }
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
const text = (name: string, value: string | number, attributes = '') =>
  `<${name}${attributes}>${xmlText(String(value))}</${name}>`;
const optional = (name: string, value: string | null | undefined) =>
  value ? text(name, value) : '';
const amount = (name: string, cents: number) => text(name, formatMoney(cents), ' currencyID="EUR"');
const address = (value: PostalAddress) =>
  text('cbc:StreetName', value.line1) +
  optional('cbc:AdditionalStreetName', value.line2) +
  text('cbc:CityName', value.city) +
  text('cbc:PostalZone', value.postalCode) +
  `<cac:Country>${text('cbc:IdentificationCode', value.country)}</cac:Country>`;
// FR : sans numéro de TVA, le SIREN est répété en BT-32 (spécifications AFNOR/DGFiP).
const party = (value: InvoiceParty) =>
  `<cac:Party>${text('cbc:EndpointID', value.electronicAddress.value, ` schemeID="${value.electronicAddress.scheme}"`)}<cac:PostalAddress>${address(value.address)}</cac:PostalAddress>${value.vatNumber ? `<cac:PartyTaxScheme>${text('cbc:CompanyID', value.vatNumber)}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}${value.taxRegistrationId ? `<cac:PartyTaxScheme>${text('cbc:CompanyID', value.taxRegistrationId)}<cac:TaxScheme><cbc:ID>TAX</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}<cac:PartyLegalEntity>${text('cbc:RegistrationName', value.name)}${text('cbc:CompanyID', value.siren, ' schemeID="0002"')}${optional('cbc:CompanyLegalForm', value.legalInformation)}</cac:PartyLegalEntity></cac:Party>`;

const EN16931_CUSTOMIZATION_ID = 'urn:cen.eu:en16931:2017';

/** UBL 2.1 / EN 16931. Le profil de transport reste explicite et optionnel. */
export function serializeUbl(invoice: CanonicalInvoice, options: { profileId?: string } = {}): string {
  const isCreditNote = invoice.documentType === 'credit_note';
  const root = isCreditNote ? 'CreditNote' : 'Invoice';
  const lineTag = isCreditNote ? 'CreditNoteLine' : 'InvoiceLine';
  const quantityTag = isCreditNote ? 'CreditedQuantity' : 'InvoicedQuantity';
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<${root} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${root}-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">`,
    text('cbc:CustomizationID', EN16931_CUSTOMIZATION_ID),
    options.profileId ? text('cbc:ProfileID', options.profileId) : '',
    text('cbc:ID', invoice.id),
    text('cbc:IssueDate', invoice.issueDate),
    isCreditNote ? '' : text('cbc:DueDate', invoice.dueDate),
    text(
      isCreditNote ? 'cbc:CreditNoteTypeCode' : 'cbc:InvoiceTypeCode',
      isCreditNote ? '381' : '380',
    ),
    ...invoice.documentNotes.map((note) =>
      text('cbc:Note', `#${note.subjectCode}#${note.content}`),
    ),
    text('cbc:DocumentCurrencyCode', invoice.currency),
    optional('cbc:BuyerReference', invoice.buyerReference),
    invoice.purchaseOrderReference
      ? `<cac:OrderReference>${text('cbc:ID', invoice.purchaseOrderReference)}</cac:OrderReference>`
      : '',
    isCreditNote
      ? `<cac:BillingReference><cac:InvoiceDocumentReference>${text('cbc:ID', invoice.precedingInvoice.id)}${text('cbc:IssueDate', invoice.precedingInvoice.issueDate)}</cac:InvoiceDocumentReference></cac:BillingReference>`
      : '',
    `<cac:AccountingSupplierParty>${party(invoice.seller)}</cac:AccountingSupplierParty>`,
    `<cac:AccountingCustomerParty>${party(invoice.buyer)}</cac:AccountingCustomerParty>`,
    `<cac:Delivery>${text('cbc:ActualDeliveryDate', invoice.deliveryDate)}${invoice.deliveryAddress ? `<cac:DeliveryLocation><cac:Address>${address(invoice.deliveryAddress)}</cac:Address></cac:DeliveryLocation>` : ''}</cac:Delivery>`,
    // UBL CreditNote n’a pas de DueDate à la racine (BT-9 se trouve dans PaymentMeans).
    isCreditNote
      ? `<cac:PaymentMeans>${text('cbc:PaymentMeansCode', invoice.paymentMeansCode ?? '1')}${text('cbc:PaymentDueDate', invoice.dueDate)}</cac:PaymentMeans>`
      : '',
    `<cac:PaymentTerms>${text('cbc:Note', invoice.paymentTerms)}</cac:PaymentTerms>`,
    `<cac:TaxTotal>${amount('cbc:TaxAmount', invoice.taxCents)}${invoice.vatBreakdown.map((group) => `<cac:TaxSubtotal>${amount('cbc:TaxableAmount', group.baseCents)}${amount('cbc:TaxAmount', group.taxCents)}<cac:TaxCategory>${text('cbc:ID', group.category)}${text('cbc:Percent', group.rate)}${optional('cbc:TaxExemptionReason', group.exemptionReason)}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`).join('')}</cac:TaxTotal>`,
    `<cac:LegalMonetaryTotal>${amount('cbc:LineExtensionAmount', invoice.netCents)}${amount('cbc:TaxExclusiveAmount', invoice.netCents)}${amount('cbc:TaxInclusiveAmount', invoice.totalCents)}${amount('cbc:PayableAmount', invoice.totalCents)}</cac:LegalMonetaryTotal>`,
    ...invoice.lines.map(
      (line) =>
        `<cac:${lineTag}>${text('cbc:ID', line.id)}${text(`cbc:${quantityTag}`, line.quantity, ` unitCode="${xmlText(line.unitCode)}"`)}${amount('cbc:LineExtensionAmount', line.netCents)}<cac:Item>${text('cbc:Name', line.description)}<cac:ClassifiedTaxCategory>${text('cbc:ID', line.vatCategory)}${text('cbc:Percent', line.vatRate)}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price>${amount('cbc:PriceAmount', line.unitPriceCents)}</cac:Price></cac:${lineTag}>`,
    ),
    `</${root}>`,
  ];
  return parts.filter(Boolean).join('\n') + '\n';
}

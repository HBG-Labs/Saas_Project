import { formatMoney } from '../canonical/decimal.ts';
import type { CanonicalInvoice, InvoiceParty, PostalAddress } from '../canonical/types.ts';
import { xmlText } from './ubl.ts';

const element = (name: string, content: string) => `<ram:${name}>${content}</ram:${name}>`;
const text = (name: string, value: string | number, attributes = '') =>
  `<ram:${name}${attributes}>${xmlText(String(value))}</ram:${name}>`;
const optional = (name: string, value: string | null | undefined) =>
  value ? text(name, value) : '';
const amount = (name: string, cents: number, attributes = '') =>
  text(name, formatMoney(cents), attributes);
const date = (name: string, value: string) =>
  element(
    name,
    `<udt:DateTimeString format="102">${xmlText(value.replaceAll('-', ''))}</udt:DateTimeString>`,
  );

const address = (value: PostalAddress) =>
  element(
    'PostalTradeAddress',
    [
      text('PostcodeCode', value.postalCode),
      text('LineOne', value.line1),
      optional('LineTwo', value.line2),
      text('CityName', value.city),
      text('CountryID', value.country),
    ].join(''),
  );

const party = (value: InvoiceParty) =>
  [
    text('Name', value.name),
    optional('Description', value.legalInformation),
    element('SpecifiedLegalOrganization', text('ID', value.siren, ' schemeID="0002"')),
    address(value.address),
    element(
      'URIUniversalCommunication',
      text('URIID', value.electronicAddress.value, ` schemeID="${value.electronicAddress.scheme}"`),
    ),
    value.vatNumber
      ? element('SpecifiedTaxRegistration', text('ID', value.vatNumber, ' schemeID="VA"'))
      : '',
    value.taxRegistrationId
      ? element('SpecifiedTaxRegistration', text('ID', value.taxRegistrationId, ' schemeID="FC"'))
      : '',
  ].join('');

function paymentMeans(invoice: CanonicalInvoice) {
  if (!invoice.paymentMeansCode) return '';
  if (invoice.paymentMeansCode === '30' && !invoice.paymentIban)
    throw new Error('Un règlement par virement exige un IBAN pour le fichier CII.');
  return element(
    'SpecifiedTradeSettlementPaymentMeans',
    [
      text('TypeCode', invoice.paymentMeansCode),
      invoice.paymentMeansCode === '30' && invoice.paymentIban
        ? element('PayeePartyCreditorFinancialAccount', text('IBANID', invoice.paymentIban))
        : '',
      invoice.paymentMeansCode === '30' && invoice.paymentBic
        ? element('PayeeSpecifiedCreditorFinancialInstitution', text('BICID', invoice.paymentBic))
        : '',
    ].join(''),
  );
}

/** CII : cœur EN 16931, validé avec le XSD et le Schematron Factur-X 1.09.2. */
export function serializeCii(invoice: CanonicalInvoice): string {
  const lines = invoice.lines
    .map((line) =>
      element(
        'IncludedSupplyChainTradeLineItem',
        [
          element('AssociatedDocumentLineDocument', text('LineID', line.id)),
          element('SpecifiedTradeProduct', text('Name', line.description)),
          element(
            'SpecifiedLineTradeAgreement',
            element('NetPriceProductTradePrice', amount('ChargeAmount', line.unitPriceCents)),
          ),
          element(
            'SpecifiedLineTradeDelivery',
            text('BilledQuantity', line.quantity, ` unitCode="${xmlText(line.unitCode)}"`),
          ),
          element(
            'SpecifiedLineTradeSettlement',
            [
              element(
                'ApplicableTradeTax',
                text('TypeCode', 'VAT') +
                  text('CategoryCode', line.vatCategory) +
                  text('RateApplicablePercent', line.vatRate),
              ),
              element(
                'SpecifiedTradeSettlementLineMonetarySummation',
                amount('LineTotalAmount', line.netCents),
              ),
            ].join(''),
          ),
        ].join(''),
      ),
    )
    .join('\n');
  const agreement = element(
    'ApplicableHeaderTradeAgreement',
    [
      optional('BuyerReference', invoice.buyerReference),
      element('SellerTradeParty', party(invoice.seller)),
      element('BuyerTradeParty', party(invoice.buyer)),
      invoice.purchaseOrderReference
        ? element(
            'BuyerOrderReferencedDocument',
            text('IssuerAssignedID', invoice.purchaseOrderReference),
          )
        : '',
    ].join(''),
  );
  const delivery = element(
    'ApplicableHeaderTradeDelivery',
    [
      invoice.deliveryAddress ? element('ShipToTradeParty', address(invoice.deliveryAddress)) : '',
      element('ActualDeliverySupplyChainEvent', date('OccurrenceDateTime', invoice.deliveryDate)),
    ].join(''),
  );
  const settlement = element(
    'ApplicableHeaderTradeSettlement',
    [
      text('PaymentReference', invoice.id),
      text('InvoiceCurrencyCode', invoice.currency),
      paymentMeans(invoice),
      ...invoice.vatBreakdown.map((group) =>
        element(
          'ApplicableTradeTax',
          [
            amount('CalculatedAmount', group.taxCents),
            text('TypeCode', 'VAT'),
            optional('ExemptionReason', group.exemptionReason),
            amount('BasisAmount', group.baseCents),
            text('CategoryCode', group.category),
            text('RateApplicablePercent', group.rate),
          ].join(''),
        ),
      ),
      element(
        'SpecifiedTradePaymentTerms',
        text('Description', invoice.paymentTerms) + date('DueDateDateTime', invoice.dueDate),
      ),
      element(
        'SpecifiedTradeSettlementHeaderMonetarySummation',
        [
          amount('LineTotalAmount', invoice.netCents),
          amount('TaxBasisTotalAmount', invoice.netCents),
          amount('TaxTotalAmount', invoice.taxCents, ' currencyID="EUR"'),
          amount('GrandTotalAmount', invoice.totalCents),
          amount('DuePayableAmount', invoice.totalCents),
        ].join(''),
      ),
      invoice.documentType === 'credit_note'
        ? element(
            'InvoiceReferencedDocument',
            text('IssuerAssignedID', invoice.precedingInvoice.id) +
              element(
                'FormattedIssueDateTime',
                `<qdt:DateTimeString xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" format="102">${xmlText(invoice.precedingInvoice.issueDate.replaceAll('-', ''))}</qdt:DateTimeString>`,
              ),
          )
        : '',
    ].join(''),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">',
    '<rsm:ExchangedDocumentContext>' +
      element('GuidelineSpecifiedDocumentContextParameter', text('ID', 'urn:cen.eu:en16931:2017')) +
      '</rsm:ExchangedDocumentContext>',
    '<rsm:ExchangedDocument>' +
      text('ID', invoice.id) +
      text('TypeCode', invoice.documentType === 'credit_note' ? '381' : '380') +
      date('IssueDateTime', invoice.issueDate) +
      invoice.documentNotes
        .map((note) =>
          element(
            'IncludedNote',
            text('Content', note.content) + text('SubjectCode', note.subjectCode),
          ),
        )
        .join('') +
      '</rsm:ExchangedDocument>',
    '<rsm:SupplyChainTradeTransaction>',
    lines,
    agreement,
    delivery,
    settlement,
    '</rsm:SupplyChainTradeTransaction>',
    '</rsm:CrossIndustryInvoice>',
    '',
  ].join('\n');
}

/// <reference types="node" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { preparerExportUbl } from '../canonical/mapper';
import { completeInvoice } from '@/test/fixtures/invoice';
import { serializeCii } from './cii';

function completeCii() {
  const prepared = preparerExportUbl({
    ...completeInvoice(),
    seller_iban: 'FR7612345987650123456789014',
    seller_bic: 'AGRIFRPP',
  });
  expect(prepared.issues).toEqual([]);
  expect(prepared.invoice).not.toBeNull();
  return serializeCii(prepared.invoice!);
}

describe('CII pour Factur-X', () => {
  it('produit un XML EN 16931 bien formé, sans transformer la facture', () => {
    const xml = completeCii();
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    expect(document.querySelector('parsererror')).toBeNull();
    expect(xml).toContain('CrossIndustryInvoice');
    expect(xml).toContain('urn:cen.eu:en16931:2017');
    expect(xml).toContain('<ram:ID>FAC-2026-00001</ram:ID>');
    expect(xml).toContain('format="102">20260903');
    expect(xml).toContain('unitCode="HUR">2');
    expect(xml).toContain('currencyID="EUR">4.94</ram:TaxTotalAmount>');
    expect(xml).toContain('<ram:DuePayableAmount>29.62</ram:DuePayableAmount>');
    expect(xml).toContain('<ram:TypeCode>30</ram:TypeCode>');
    expect(xml).toContain('<ram:IBANID>FR7612345987650123456789014</ram:IBANID>');
    expect(xml).toContain('<ram:URIID schemeID="0225">123456789</ram:URIID>');
    expect(xml).toContain('<ram:URIID schemeID="0225">987654321</ram:URIID>');
    expect(xml).toContain('Client &amp; Associés');
    expect(xml).toContain('<ram:SubjectCode>PMT</ram:SubjectCode>');
    expect(xml).toContain('<ram:SubjectCode>PMD</ram:SubjectCode>');
    expect(xml).toContain('<ram:SubjectCode>AAB</ram:SubjectCode>');
    expect(xml).toContain('<ram:SubjectCode>REG</ram:SubjectCode>');
  });

  it('conserve une adresse de livraison distincte et le motif de TVA', () => {
    const invoice = completeInvoice();
    invoice.payment_method = 'CB';
    invoice.delivery_address_line1 = '5 rue du Chantier';
    invoice.delivery_city = 'Le Marin';
    invoice.delivery_postal_code = '97290';
    invoice.delivery_country = 'FR';
    invoice.items[0] = {
      ...invoice.items[0]!,
      vat_rate: 0,
      vat_category: 'E',
      vat_exemption_reason: 'TVA non applicable, art. 293 B du CGI.',
    };
    invoice.seller_vat_regime = 'franchise';
    invoice.seller_vat_number = null;
    invoice.totals = { ...invoice.totals!, vat_cents: 0, total_cents: 2468 };
    const prepared = preparerExportUbl(invoice);
    expect(prepared.issues).toEqual([]);
    const xml = serializeCii(prepared.invoice!);
    expect(xml).toContain('5 rue du Chantier');
    expect(xml).toContain('TVA non applicable, art. 293 B du CGI.');
  });

  it('produit le jeu de contrôle indépendant sans aucune donnée externe', () => {
    if (process.env.EXPORT_CII_FIXTURES !== '1') return;
    mkdirSync('test-results/cii-fixtures', { recursive: true });
    writeFileSync('test-results/cii-fixtures/standard.xml', completeCii());
  });
});

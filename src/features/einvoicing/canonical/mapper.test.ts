/// <reference types="node" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { InvoiceWithItems } from '@/types/domain';
import { preparerExportUbl, verifierExportBrouillon } from './mapper';
import { serializeUbl, xmlText } from '../serializers/ubl';
import { formatMoney } from './decimal';

import { completeInvoice } from '@/test/fixtures/invoice';

const exportXml = (invoice: InvoiceWithItems) => {
  const result = preparerExportUbl(invoice);
  expect(result.issues).toEqual([]);
  expect(result.invoice).not.toBeNull();
  return serializeUbl(result.invoice!);
};

describe('export UBL', () => {
  it('signale les obstacles sur le brouillon sans inventer de document émis', () => {
    const draft = { ...completeInvoice(), status: 'draft' as const, issued_at: null };
    const result = verifierExportBrouillon(draft, null);
    expect(result.invoice).toBeNull();
    expect(result.issues.join(' ')).toMatch(/entreprise/);
    expect(result.issues.join(' ')).not.toMatch(/date d’émission est absente/);
    expect(draft.issued_at).toBeNull();
  });

  it('conserve les instantanés, les références et les caractères spéciaux', () => {
    const invoice = completeInvoice();
    const result = preparerExportUbl(invoice);
    expect(result.issues).toEqual([]);
    const xml = serializeUbl(result.invoice!);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.getElementsByTagName('cbc:RegistrationName')[1]?.textContent).toBe(
      'Client & Associés',
    );
    expect(doc.getElementsByTagName('cbc:Name')[0]?.textContent).toBe(
      'Pose & contrôle <électrique>',
    );
    expect(xml).toContain('schemeID="0002">123456789</cbc:CompanyID>');
    expect(xml).toContain('schemeID="0225">123456789</cbc:EndpointID>');
    expect(xml).toContain('schemeID="0225">987654321</cbc:EndpointID>');
    expect(xml).toContain('<cbc:ActualDeliveryDate>2026-09-02</cbc:ActualDeliveryDate>');
    expect(xml).toContain('currencyID="EUR">29.62</cbc:PayableAmount>');
    expect(xml).toContain(
      '<cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>',
    );
    expect(xml).not.toContain('<cbc:ProfileID>');
    expect(serializeUbl(result.invoice!, { profileId: 'M1' })).toContain(
      '<cbc:ProfileID>M1</cbc:ProfileID>',
    );
    expect(result.invoice?.paymentMeansCode).toBe('30');
  });
  it('arrondit chaque base puis la TVA par taux avec une arithmétique exacte', () => {
    const invoice = completeInvoice();
    invoice.items = [1, 2].map((n) => ({
      ...invoice.items[0]!,
      id: String(n),
      quantity: 1.5,
      unit_price_cents: 1,
      vat_rate: 20,
    }));
    invoice.totals = { ...invoice.totals!, subtotal_cents: 4, vat_cents: 1, total_cents: 5 };
    const result = preparerExportUbl(invoice);
    expect(result.issues).toEqual([]);
    expect(result.invoice?.lines.map((l) => l.netCents)).toEqual([2, 2]);
    expect(result.invoice?.taxCents).toBe(1);
  });
  it.each(['draft', 'cancelled'] as const)(
    'refuse le statut %s sans créer de fichier',
    (status) => {
      const result = preparerExportUbl({ ...completeInvoice(), status });
      expect(result.invoice).toBeNull();
      expect(result.issues.length).toBeGreaterThan(0);
    },
  );
  it('refuse les totaux périmés, unités inconnues et catégories de TVA incohérentes', () => {
    const invoice = completeInvoice();
    invoice.items[0] = { ...invoice.items[0]!, unit: 'mystère', vat_rate: 0 };
    const result = preparerExportUbl(invoice);
    expect(result.invoice).toBeNull();
    expect(result.issues.join(' ')).toMatch(/unité non reconnue/);
    expect(result.issues.join(' ')).toMatch(/catégorie de TVA/);
    expect(result.issues.join(' ')).toMatch(/totaux/);
  });
  it('refuse les montants dont la représentation entière n’est pas sûre', () => {
    const invoice = completeInvoice();
    invoice.items[0] = { ...invoice.items[0]!, quantity: 999999999, unit_price_cents: 2147483647 };
    expect(preparerExportUbl(invoice).invoice).toBeNull();
    expect(() => formatMoney(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
  it('refuse un caractère XML interdit au lieu de le supprimer silencieusement', () => {
    expect(() => xmlText('A\u0001B')).toThrow(/caractère/);
    expect(xmlText('Été 🛠 & <test>')).toBe('Été 🛠 &amp; &lt;test&gt;');
  });
  it('exporte la livraison distincte sans substituer l’adresse de facturation', () => {
    const xml = exportXml({
      ...completeInvoice(),
      delivery_address_line1: '5 rue du Chantier',
      delivery_city: 'Le Marin',
      delivery_postal_code: '97290',
      delivery_country: 'FR',
    });
    expect(xml).toContain('5 rue du Chantier');
    expect(xml).toContain('2 rue des Essais');
  });
  it('valide les taux multiples avec une quantité décimale et une livraison distincte', () => {
    const invoice = completeInvoice();
    invoice.delivery_address_line1 = '5 rue du Chantier';
    invoice.delivery_city = 'Le Marin';
    invoice.delivery_postal_code = '97290';
    invoice.delivery_country = 'FR';
    invoice.items.push({
      ...invoice.items[0]!,
      id: 'line-2',
      quantity: 0.333,
      unit_price_cents: 1001,
      vat_rate: 8.5,
    });
    invoice.totals = {
      ...invoice.totals!,
      subtotal_cents: 2801,
      vat_cents: 522,
      total_cents: 3323,
    };
    const xml = exportXml(invoice);
    if (process.env.EXPORT_UBL_FIXTURES === '1') {
      mkdirSync('test-results/ubl-fixtures', { recursive: true });
      writeFileSync('test-results/ubl-fixtures/mixed-delivery.xml', xml);
    }
  });
  it('produit les jeux de validation indépendants pour les quatre cas pris en charge', () => {
    for (const category of ['S', 'E', 'Z', 'AE'] as const) {
      const invoice = completeInvoice();
      if (category !== 'S') {
        invoice.items[0] = {
          ...invoice.items[0]!,
          vat_rate: 0,
          vat_category: category,
          vat_exemption_reason: category === 'AE' ? 'Autoliquidation' : null,
        };
        invoice.totals = { ...invoice.totals!, vat_cents: 0, total_cents: 2468 };
      }
      if (category === 'E') {
        invoice.seller_vat_regime = 'franchise';
        invoice.seller_vat_number = null;
      }
      const xml = exportXml(invoice);
      if (process.env.EXPORT_UBL_FIXTURES === '1') {
        mkdirSync('test-results/ubl-fixtures', { recursive: true });
        writeFileSync(`test-results/ubl-fixtures/${category}.xml`, xml);
      }
    }
  });
});

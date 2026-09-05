import { describe, expect, it } from 'vitest';
import type { Organization } from '@/types/domain';
import { completeInvoice } from '@/test/fixtures/invoice';
import { emetteurFacture } from '../validation/invoice';
import { serializeCii } from '../serializers/cii';
import { preparerExportCii } from './mapper';
import { preparerTestFacturX, TEST_INVOICE_NOTICE } from './test-preview';

const date = new Date('2026-09-04T14:00:00Z');
function source() {
  const invoice = completeInvoice();
  invoice.payment_method = 'CB';
  const organization = emetteurFacture(invoice, null) as Organization;
  invoice.status = 'draft';
  invoice.issued_at = null;
  invoice.reference = 'BR-invoice-test';
  return { invoice, organization };
}
describe('simulation Factur-X', () => {
  it('marque le document et son XML sans modifier le brouillon ni ses montants', () => {
    const { invoice, organization } = source();
    const before = JSON.stringify(invoice);
    const result = preparerTestFacturX(invoice, organization, date);
    expect(result.issues).toEqual([]);
    expect(result.invoice).toMatchObject({
      id: 'TEST-invoice-test',
      isTest: true,
      totalCents: 2962,
      issueDate: '2026-09-04',
    });
    const xml = serializeCii(result.invoice!);
    expect(xml).toContain('TEST-invoice-test');
    expect(xml).toContain(TEST_INVOICE_NOTICE);
    expect(xml).not.toContain('BR-invoice-test');
    expect(JSON.stringify(invoice)).toBe(before);
  });
  it('utilise les coordonnées actuelles de l’entreprise pour le brouillon', () => {
    const { invoice, organization } = source();
    organization.legal_name = 'Entreprise mise à jour';
    expect(preparerTestFacturX(invoice, organization, date).invoice?.seller.name).toBe(
      'Entreprise mise à jour',
    );
  });
  it('garde les mêmes blocages sur les identifiants, les montants et le virement', () => {
    const { invoice, organization } = source();
    invoice.customer_registration_number = '123';
    invoice.totals!.total_cents++;
    const result = preparerTestFacturX(invoice, organization, date);
    expect(result.invoice).toBeNull();
    expect(result.issues.join(' ')).toMatch(/identifiant du client/);
    expect(result.issues.join(' ')).toMatch(/totaux/);
    const other = source();
    other.invoice.payment_method = 'Virement';
    expect(preparerTestFacturX(other.invoice, other.organization, date).issues.join(' ')).toMatch(
      /IBAN/,
    );
  });
  it('refuse un document déjà émis et une échéance passée', () => {
    const { invoice, organization } = source();
    invoice.due_date = '2026-09-03';
    expect(preparerTestFacturX(invoice, organization, date).issues.join(' ')).toMatch(/échéance/);
    expect(preparerTestFacturX(completeInvoice(), organization, date).issues.join(' ')).toMatch(
      /brouillons/,
    );
  });
  it('ne marque jamais un export définitif comme simulation', () => {
    const invoice = completeInvoice();
    invoice.payment_method = 'CB';
    const result = preparerExportCii(invoice);
    expect(result.invoice?.isTest).toBeUndefined();
    expect(serializeCii(result.invoice!)).not.toContain(TEST_INVOICE_NOTICE);
  });
});

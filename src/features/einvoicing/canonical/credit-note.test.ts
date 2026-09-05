import { describe, expect, it } from 'vitest';
import { completeCreditNote } from '@/test/fixtures/invoice';
import { preparerExportCii, preparerExportUbl } from './mapper';
import { serializeCii } from '../serializers/cii';
import { serializeUbl } from '../serializers/ubl';
import { preparerTestFacturX } from './test-preview';
import { emetteurFacture } from '../validation/invoice';
import type { InvoiceWithItems, Organization } from '@/types/domain';

describe('export électronique des avoirs', () => {
  it('produit un crédit positif 381 avec la facture corrigée dans les deux syntaxes', () => {
    const source = completeCreditNote();
    source.corrected_invoice_reference = 'FAC-2026-<1>&2';
    source.credit_note_reason = 'Annulation <totale> & remboursement';
    source.seller_iban = 'FR7612345987650123456789014';
    source.payment_method = 'Virement';
    const before = JSON.stringify(source);
    const prepared = preparerExportCii(source);
    expect(prepared.issues).toEqual([]);
    const invoice = prepared.invoice!;
    expect(invoice.documentType).toBe('credit_note');
    if (invoice.documentType !== 'credit_note') throw new Error('Avoir canonique attendu');
    expect(invoice.creditNoteScope).toBe('full');
    expect(invoice.totalCents).toBe(2962);
    expect(invoice.lines[0]!.quantity).toBe('2');
    expect(invoice.paymentIban).toBeNull();
    expect(invoice.paymentMeansCode).toBe('1');
    expect(invoice.paymentTerms).not.toMatch(/IBAN|Pénalités|Escompte|40 €|Virement/);
    const cii = new DOMParser().parseFromString(serializeCii(invoice), 'application/xml');
    expect(cii.querySelector('parsererror')).toBeNull();
    const exchanged = cii.getElementsByTagName('rsm:ExchangedDocument')[0]!;
    expect(exchanged.getElementsByTagName('ram:TypeCode')[0]!.textContent).toBe('381');
    const ref = cii.getElementsByTagName('ram:InvoiceReferencedDocument')[0]!;
    expect(ref.getElementsByTagName('ram:IssuerAssignedID')[0]!.textContent).toBe(
      source.corrected_invoice_reference,
    );
    expect(ref.getElementsByTagName('qdt:DateTimeString')[0]!.textContent).toBe('20260903');
    const ubl = new DOMParser().parseFromString(serializeUbl(invoice), 'application/xml');
    expect(ubl.querySelector('parsererror')).toBeNull();
    expect(ubl.documentElement.localName).toBe('CreditNote');
    expect(ubl.documentElement.namespaceURI).toMatch(/CreditNote-2$/);
    expect(ubl.getElementsByTagName('cbc:CreditNoteTypeCode')[0]!.textContent).toBe('381');
    expect(ubl.getElementsByTagName('cbc:CreditedQuantity')[0]!.textContent).toBe('2');
    expect(ubl.getElementsByTagName('cbc:DueDate').length).toBe(0);
    expect(ubl.getElementsByTagName('cbc:PaymentDueDate')[0]!.textContent).toBe(source.due_date);
    expect(ubl.getElementsByTagName('cac:InvoiceDocumentReference')[0]!.textContent).toBe(
      source.corrected_invoice_reference + '2026-09-03',
    );
    expect(ubl.getElementsByTagName('cbc:Note')[0]!.textContent).toContain(
      source.credit_note_reason,
    );
    expect(ubl.getElementsByTagName('cbc:PayableAmount')[0]!.textContent).toBe('29.62');
    expect(ubl.getElementsByTagName('cac:InvoiceLine').length).toBe(0);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('conserve un montant partiel et sa portée dans les trois formats', () => {
    const source = completeCreditNote();
    source.credit_note_scope = 'partial';
    source.items[0]!.quantity = 0.5;
    source.totals = { ...source.totals!, subtotal_cents: 617, vat_cents: 123, total_cents: 740 };
    const prepared = preparerExportCii(source);
    expect(prepared.issues).toEqual([]);
    const credit = prepared.invoice;
    if (credit?.documentType !== 'credit_note') throw new Error('Avoir canonique attendu');
    expect(credit.creditNoteScope).toBe('partial');
    expect(credit.totalCents).toBe(740);
    expect(serializeCii(credit)).toContain('Avoir partiel. Motif de l’avoir');
    expect(serializeUbl(credit)).toContain('Avoir partiel. Motif de l’avoir');
  });

  it.each([
    { corrected_invoice_reference: null },
    { corrected_invoice_reference: '   ' },
    { corrected_invoice_issued_at: null },
    { corrected_invoice_issued_at: '2026-02-30T14:00:00Z' },
    { corrected_invoice_issued_at: '2099-01-01T14:00:00Z' },
    { corrects_invoice_id: null },
    { corrects_invoice_id: 'credit-test' },
    { credit_note_reason: ' ' },
    { status: 'cancelled' as const },
    { status: 'draft' as const },
  ])('refuse une origine, un motif ou un statut invalide : %j', (changes) => {
    const source: InvoiceWithItems = { ...completeCreditNote(), ...changes };
    expect(preparerExportUbl(source).invoice).toBeNull();
    expect(preparerExportCii(source).issues.length).toBeGreaterThan(0);
  });

  it('refuse un montant nul sans lui attribuer le sens d’un remboursement', () => {
    const source = completeCreditNote();
    source.items[0]!.unit_price_cents = 0;
    source.totals = { ...source.totals!, subtotal_cents: 0, vat_cents: 0, total_cents: 0 };
    expect(preparerExportCii(source).issues.join(' ')).toContain('strictement positif');
  });

  it('simule un avoir sans perdre sa référence d’origine ni modifier son brouillon', () => {
    const source = completeCreditNote();
    const organization = emetteurFacture(source, null) as Organization;
    source.status = 'draft';
    source.issued_at = null;
    const before = JSON.stringify(source);
    const prepared = preparerTestFacturX(source, organization, new Date('2026-09-04T15:00:00Z'));
    expect(prepared.issues).toEqual([]);
    expect(prepared.invoice?.documentType).toBe('credit_note');
    expect(prepared.invoice?.precedingInvoice?.id).toBe('FAC-2026-00001');
    expect(prepared.invoice?.id).toBe('TEST-credit-test');
    expect(prepared.invoice?.isTest).toBe(true);
    expect(JSON.stringify(source)).toBe(before);
  });
});

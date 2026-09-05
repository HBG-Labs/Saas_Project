import { describe, expect, it } from 'vitest';
import { completeInvoice } from '@/test/fixtures/invoice';
import { validerFactureAvantEmission } from './invoice';
import { mentionsReglement } from './business-fields';

describe('mentions des avoirs', () => {
  it('demande une facture d’origine et un motif avant émission', () => {
    const invoice = completeInvoice();
    invoice.document_type = 'credit_note';
    invoice.credit_note_scope = null;
    const result = validerFactureAvantEmission(invoice, null);
    expect(result.bloquants.map((item) => item.code)).toEqual(
      expect.arrayContaining(['avoir.portee', 'avoir.origine', 'avoir.motif']),
    );
    invoice.corrects_invoice_id = 'original';
    invoice.corrected_invoice_reference = 'FAC-2026-00001';
    invoice.corrected_invoice_issued_at = '2026-09-04T12:00:00Z';
    invoice.credit_note_reason = 'Annulation totale';
    invoice.credit_note_scope = 'full';
    expect(
      validerFactureAvantEmission(invoice, null).bloquants.filter((item) =>
        item.code.startsWith('avoir.'),
      ),
    ).toEqual([]);
  });
  it('affiche les modalités de crédit sans ajouter de pénalité ni d’indemnité de recouvrement', () => {
    const invoice = completeInvoice();
    invoice.document_type = 'credit_note';
    invoice.credit_note_scope = 'full';
    invoice.payment_terms = 'Remboursement sous dix jours.';
    expect(mentionsReglement(invoice)).toEqual(['Remboursement sous dix jours.']);
  });
});

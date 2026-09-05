import { describe, expect, it } from 'vitest';
import type { Invoice } from '@/types/domain';
import { mentionsReglement, validerMentionsCommerciales } from './business-fields';

const base = {
  service_date: '2026-09-03',
  operation_type: 'services',
  early_payment_terms: 'Escompte : néant',
  customer_type: 'company',
  late_payment_terms: 'Taux contractuel',
  payment_terms: 'À 30 jours',
} as Invoice;
describe('mentions commerciales', () => {
  it('n’applique pas les pénalités professionnelles ni les 40 € à un particulier', () => {
    const invoice = { ...base, customer_type: 'individual' as const, late_payment_terms: null };
    expect(validerMentionsCommerciales(invoice)).toEqual([]);
    expect(mentionsReglement(invoice).join(' ')).not.toContain('40');
  });
  it('réclame les nouvelles mentions avant émission et signale une livraison incomplète', () => {
    const issues = validerMentionsCommerciales({
      ...base,
      service_date: null,
      operation_type: null,
      early_payment_terms: '',
      late_payment_terms: '',
      delivery_city: 'Le Marin',
    });
    expect(issues.map((i) => i.code)).toEqual([
      'facture.date_prestation',
      'facture.nature_operation',
      'facture.escompte',
      'facture.penalites',
      'facture.livraison',
    ]);
  });
  it('affiche les mentions de recouvrement pour une entreprise', () => {
    expect(mentionsReglement(base)).toContain(
      'Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 €.',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_EARLY_PAYMENT_TERMS, suggestedOperationType } from './draft-defaults';

describe('préremplissage des brouillons de facture', () => {
  it('propose les mentions d’escompte usuelles', () => {
    expect(DEFAULT_EARLY_PAYMENT_TERMS).toBe('Escompte pour paiement anticipé : néant.');
  });

  it('reconnaît une prestation lorsque le devis ne contient que du temps', () => {
    expect(suggestedOperationType([{ unit: 'h' }, { unit: 'jours' }])).toBe('services');
  });

  it('demande confirmation pour une unité ambiguë ou un devis vide', () => {
    expect(suggestedOperationType([{ unit: 'forfait' }])).toBeNull();
    expect(suggestedOperationType([])).toBeNull();
  });
});

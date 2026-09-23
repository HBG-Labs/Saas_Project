import { describe, expect, it } from 'vitest';

import { calculateInvoiceTotals, calculateQuoteTotals } from './document-totals';

describe('totaux documentaires en centimes', () => {
  it('arrondit chaque ligne comme PostgreSQL', () => {
    const result = calculateQuoteTotals(
      [
        { quantity: 0.5, unitPriceEuros: 0.01 },
        { quantity: 0.5, unitPriceEuros: 0.01 },
      ],
      20,
      0,
    );
    expect(result).toEqual({
      grossSubtotalCents: 2,
      discountCents: 0,
      subtotalCents: 2,
      vatCents: 0,
      totalCents: 2,
    });
  });

  it('applique remise et TVA par groupe de taux', () => {
    const result = calculateInvoiceTotals(
      [
        { quantity: 1, unitPriceEuros: 10, vatRate: 20, vatCategory: 'S' },
        { quantity: 1, unitPriceEuros: 10, vatRate: 5.5, vatCategory: 'S' },
      ],
      10,
    );
    expect(result).toEqual({
      grossSubtotalCents: 2_000,
      discountCents: 200,
      subtotalCents: 1_800,
      vatCents: 230,
      totalCents: 2_030,
    });
  });
});

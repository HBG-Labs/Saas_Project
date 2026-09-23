export interface MonetaryLine {
  quantity: number;
  unitPriceEuros: number;
  vatRate: number;
  vatCategory?: string;
}

export interface DocumentTotals {
  grossSubtotalCents: number;
  discountCents: number;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function eurosToCents(value: number): number {
  return Math.round(finiteOrZero(value) * 100);
}

export function lineTotalCents(quantity: number, unitPriceEuros: number): number {
  return Math.round(finiteOrZero(quantity) * eurosToCents(unitPriceEuros));
}

/** Meme regle que `quote_totals` : ligne, remise, TVA, toujours en centimes. */
export function calculateQuoteTotals(
  lines: readonly Pick<MonetaryLine, 'quantity' | 'unitPriceEuros'>[],
  vatRate: number,
  discountRate: number,
): DocumentTotals {
  const grossSubtotalCents = lines.reduce(
    (sum, line) => sum + lineTotalCents(line.quantity, line.unitPriceEuros),
    0,
  );
  const discountCents = Math.round(grossSubtotalCents * (finiteOrZero(discountRate) / 100));
  const subtotalCents = grossSubtotalCents - discountCents;
  const vatCents = Math.round(subtotalCents * (finiteOrZero(vatRate) / 100));
  return {
    grossSubtotalCents,
    discountCents,
    subtotalCents,
    vatCents,
    totalCents: subtotalCents + vatCents,
  };
}

/** Meme regle que `invoice_vat_breakdown` : remise et TVA par groupe de taux. */
export function calculateInvoiceTotals(
  lines: readonly MonetaryLine[],
  discountRate: number,
): DocumentTotals {
  const groups = new Map<string, { grossCents: number; vatRate: number }>();
  for (const line of lines) {
    const vatRate = finiteOrZero(line.vatRate);
    const key = `${line.vatCategory ?? 'S'}:${vatRate}`;
    const group = groups.get(key) ?? { grossCents: 0, vatRate };
    group.grossCents += lineTotalCents(line.quantity, line.unitPriceEuros);
    groups.set(key, group);
  }

  let grossSubtotalCents = 0;
  let discountCents = 0;
  let subtotalCents = 0;
  let vatCents = 0;
  for (const group of groups.values()) {
    const groupDiscount = Math.round(group.grossCents * (finiteOrZero(discountRate) / 100));
    const groupBase = group.grossCents - groupDiscount;
    grossSubtotalCents += group.grossCents;
    discountCents += groupDiscount;
    subtotalCents += groupBase;
    vatCents += Math.round(groupBase * (group.vatRate / 100));
  }

  return {
    grossSubtotalCents,
    discountCents,
    subtotalCents,
    vatCents,
    totalCents: subtotalCents + vatCents,
  };
}

import { describe, expect, it } from 'vitest';
import { formatInvoiceDate, invoiceCalendarDate } from './date';

describe('dates des documents', () => {
  it('préserve une date de prestation ou d’échéance sans décalage vers la veille', () => {
    expect(formatInvoiceDate('2026-09-03')).toBe('03/09/2026');
  });
  it('utilise la même date UTC pour l’affichage et l’export au changement d’année', () => {
    const value = '2025-12-31T22:30:00-04:00';
    expect(invoiceCalendarDate(value)).toBe('2026-01-01');
    expect(formatInvoiceDate(value)).toBe('01/01/2026');
  });
});

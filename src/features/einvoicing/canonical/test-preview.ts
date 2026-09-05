import type { InvoiceWithItems, Organization } from '../../../types/domain.ts';
import { preparerExportCii, withSellerSnapshot, type ExportPreparation } from './mapper.ts';

export const TEST_INVOICE_NOTICE = 'TEST - SIMULATION SANS EMISSION - NE PAS COMPTABILISER.';

/** An in-memory copy only: no status change, number allocation or persisted document. */
export function preparerTestFacturX(
  source: InvoiceWithItems,
  organization: Organization | null,
  simulatedAt: Date,
): ExportPreparation {
  if (source.status !== 'draft')
    return { invoice: null, issues: ['Le mode test est réservé aux brouillons.'] };
  if (!Number.isFinite(simulatedAt.getTime()))
    return { invoice: null, issues: ['La date de simulation est invalide.'] };
  if (source.due_date && source.due_date < simulatedAt.toISOString().slice(0, 10))
    return {
      invoice: null,
      issues: ['L’échéance doit être égale ou postérieure à la date de simulation.'],
    };
  const candidate = withSellerSnapshot(
    {
      ...source,
      status: 'issued',
      reference: `TEST-${source.id}`,
      issued_at: simulatedAt.toISOString(),
      notes: [TEST_INVOICE_NOTICE, source.notes].filter(Boolean).join('\n'),
    },
    organization,
  );
  const result = preparerExportCii(candidate);
  return result.invoice ? { ...result, invoice: { ...result.invoice, isTest: true } } : result;
}

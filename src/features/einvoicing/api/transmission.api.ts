import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { InvoiceTransmission, InvoiceTransmissionEvent } from '@/types/domain';

export interface InvoiceTransmissionTimeline {
  transmission: InvoiceTransmission | null;
  events: InvoiceTransmissionEvent[];
}

/**
 * Lit le transport séparément de la facture : aucun statut comptable n'est
 * déduit d'un code de plateforme, et cette lecture ne déclenche aucun envoi.
 */
export async function getInvoiceTransmissionTimeline(
  invoiceId: string,
): Promise<InvoiceTransmissionTimeline> {
  const transmission = await unwrapMaybe(
    supabase.from('invoice_transmissions').select('*').eq('invoice_id', invoiceId).maybeSingle(),
  );

  if (transmission === null) return { transmission: null, events: [] };

  const events = await unwrap(
    supabase
      .from('invoice_transmission_events')
      .select('*')
      .eq('transmission_id', transmission.id)
      .order('occurred_at', { ascending: false })
      .order('recorded_at', { ascending: false })
      .limit(25),
  );

  return { transmission, events };
}

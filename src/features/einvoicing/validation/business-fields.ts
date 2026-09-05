import type { Invoice } from '../../../types/domain.ts';
import type { Manque } from './rules.ts';

export const OPERATION_LABELS = {
  goods: 'Vente de biens',
  services: 'Prestation de services',
  mixed: 'Biens et services',
} as const;

export function validerMentionsCommerciales(invoice: Invoice): Manque[] {
  const issues: Manque[] = [];
  const missing = (code: string, message: string) =>
    issues.push({ code, message, cible: 'facture', gravite: 'bloquant' });
  if (invoice.document_type === 'credit_note') {
    if (!['full', 'partial'].includes(invoice.credit_note_scope ?? ''))
      missing('avoir.portee', 'La portée totale ou partielle de l’avoir');
    if (
      !invoice.corrects_invoice_id ||
      !invoice.corrected_invoice_reference ||
      !invoice.corrected_invoice_issued_at
    )
      missing('avoir.origine', 'La référence et la date de la facture corrigée');
    if ((invoice.credit_note_reason?.trim().length ?? 0) < 3)
      missing('avoir.motif', 'Le motif de l’avoir');
  }
  if (!invoice.service_date)
    missing('facture.date_prestation', 'La date effective de prestation ou de livraison');
  if (!invoice.operation_type)
    missing('facture.nature_operation', 'La nature de l’opération : biens, services ou les deux');
  if (!invoice.early_payment_terms?.trim())
    missing(
      'facture.escompte',
      'Les conditions d’escompte pour paiement anticipé, ou la mention « néant »',
    );
  if (
    (invoice.customer_type === 'company' || invoice.customer_type === 'public_body') &&
    !invoice.late_payment_terms?.trim()
  )
    missing('facture.penalites', 'Les pénalités de retard applicables au client professionnel');
  const delivery = [
    invoice.delivery_address_line1,
    invoice.delivery_address_line2,
    invoice.delivery_city,
    invoice.delivery_postal_code,
    invoice.delivery_country,
  ];
  if (
    delivery.some((s) => s?.trim()) &&
    ![
      invoice.delivery_address_line1,
      invoice.delivery_city,
      invoice.delivery_postal_code,
      invoice.delivery_country,
    ].every((s) => s?.trim())
  )
    missing(
      'facture.livraison',
      'Une adresse de livraison distincte complète, ou aucun champ de livraison',
    );
  return issues;
}

/** Mentions partagées par le document lisible et le document structuré. */
export function mentionsReglement(invoice: Invoice): string[] {
  if (invoice.document_type === 'credit_note')
    return invoice.payment_terms?.trim() ? [invoice.payment_terms] : [];
  return [
    invoice.payment_terms,
    invoice.early_payment_terms,
    ...(invoice.customer_type === 'company' || invoice.customer_type === 'public_body'
      ? [
          invoice.late_payment_terms,
          'Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 €.',
        ]
      : []),
  ].filter((s): s is string => !!s?.trim());
}

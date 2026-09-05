import type { InvoiceWithItems, Organization } from '../../../types/domain.ts';
import { validerMentionsCommerciales } from './business-fields.ts';
import { validerEmission } from './rules.ts';

/** Une facture émise se lit exclusivement à partir de son instantané. */
export function emetteurFacture(
  invoice: InvoiceWithItems,
  organization: Organization | null,
): Partial<Organization> {
  if (invoice.status === 'draft') return organization ?? {};
  return {
    name: invoice.seller_name ?? '',
    legal_name: invoice.seller_legal_name,
    registration_number: invoice.seller_registration_number,
    vat_number: invoice.seller_vat_number,
    legal_form: invoice.seller_legal_form,
    ape_code: invoice.seller_ape_code,
    share_capital_cents: invoice.seller_share_capital_cents,
    rcs_city: invoice.seller_rcs_city,
    address_line1: invoice.seller_address_line1,
    address_line2: invoice.seller_address_line2,
    postal_code: invoice.seller_postal_code,
    city: invoice.seller_city,
    country: invoice.seller_country,
    iban: invoice.seller_iban,
    bic: invoice.seller_bic,
    vat_regime: invoice.seller_vat_regime,
  };
}

export function validerFactureAvantEmission(
  invoice: InvoiceWithItems,
  organization: Organization | null,
) {
  const initial = validerEmission(
    invoice,
    {
      name: invoice.customer_name || invoice.customer_legal_name,
      customer_type: invoice.customer_type,
      registration_number: invoice.customer_registration_number,
      vat_number: invoice.customer_vat_number,
      address_line1: invoice.customer_address_line1,
      postal_code: invoice.customer_postal_code,
      city: invoice.customer_city,
      country: invoice.customer_country,
    },
    emetteurFacture(invoice, organization),
  );
  const manques = [...initial.manques, ...validerMentionsCommerciales(invoice)];
  const bloquants = manques.filter((m) => m.gravite === 'bloquant');
  return {
    manques,
    bloquants,
    avertissements: initial.avertissements,
    emissionPossible: bloquants.length === 0,
  };
}

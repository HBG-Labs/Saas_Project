import type { InvoiceWithItems, Organization } from '../../../types/domain.ts';
import { normalizeBusinessIdentifier } from '../../../lib/business-identifiers.ts';
import { mentionsReglement, OPERATION_LABELS } from '../validation/business-fields.ts';
import { validerFactureAvantEmission } from '../validation/invoice.ts';
import { invoiceCalendarDate } from './date.ts';
import { formatMoney, roundPositive, safeInteger, scaledDecimal } from './decimal.ts';
import type {
  CanonicalInvoice,
  CanonicalInvoiceLine,
  CanonicalVatBreakdown,
  PostalAddress,
  SupportedVatCategory,
} from './types.ts';

// UN/ECE Rec.20. Une unité inconnue est signalée, jamais remplacée silencieusement.
const UNIT_CODES: Record<string, string> = {
  u: 'C62',
  unité: 'C62',
  unite: 'C62',
  pièce: 'C62',
  piece: 'C62',
  h: 'HUR',
  heure: 'HUR',
  jour: 'DAY',
  j: 'DAY',
  m: 'MTR',
  ml: 'MTR',
  m2: 'MTK',
  'm²': 'MTK',
  m3: 'MTQ',
  'm³': 'MTQ',
  kg: 'KGM',
  l: 'LTR',
  forfait: 'C62',
  lot: 'C62',
};
const KNOWN_UNITS = new Set(Object.values(UNIT_CODES));
export function normalizedUnit(value: string): string | null {
  return KNOWN_UNITS.has(value.trim().toUpperCase())
    ? value.trim().toUpperCase()
    : (UNIT_CODES[value.trim().toLowerCase()] ?? null);
}
const clean = (v: string | null | undefined) => v?.trim() || null;
const identifier = normalizeBusinessIdentifier;
const paymentMeansCode = (value: string | null | undefined): '20' | '30' | '48' | null => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (['virement', 'transfer', 'transfert'].includes(normalized)) return '30';
  if (['chèque', 'cheque'].includes(normalized)) return '20';
  if (['cb', 'carte', 'carte bancaire'].includes(normalized)) return '48';
  return null;
};
const validDate = (v: string | null) =>
  !!v &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;

export interface ExportPreparation {
  invoice: CanonicalInvoice | null;
  issues: string[];
}

/** Factures et avoirs nationaux FR, EUR, professionnels, sans acomptes. */
export function preparerExportUbl(source: InvoiceWithItems): ExportPreparation {
  return validateAndMap(source, null, false);
}

/** Le profil CII impose un compte créditeur lorsqu'un virement est indiqué. */
export function preparerExportCii(source: InvoiceWithItems): ExportPreparation {
  const prepared = preparerExportUbl(source);
  if (prepared.invoice?.paymentMeansCode === '30' && !prepared.invoice.paymentIban) {
    return {
      invoice: null,
      issues: ['L’IBAN de l’émetteur est requis pour un règlement par virement en Factur-X.'],
    };
  }
  return prepared;
}

/** Contrôle préalable sans inventer de numéro ni de date et sans produire de document. */
export function verifierExportBrouillon(
  source: InvoiceWithItems,
  organization: Organization | null,
): ExportPreparation {
  return validateAndMap(withSellerSnapshot(source, organization), organization, true);
}

/** Copies the current seller fields without changing the source draft. */
export function withSellerSnapshot(
  source: InvoiceWithItems,
  organization: Organization | null,
): InvoiceWithItems {
  const org = organization;
  return {
    ...source,
    seller_name: org?.name ?? null,
    seller_legal_name: org?.legal_name ?? null,
    seller_registration_number: org?.registration_number ?? null,
    seller_vat_number: org?.vat_number ?? null,
    seller_legal_form: org?.legal_form ?? null,
    seller_share_capital_cents: org?.share_capital_cents ?? null,
    seller_address_line1: org?.address_line1 ?? null,
    seller_address_line2: org?.address_line2 ?? null,
    seller_city: org?.city ?? null,
    seller_postal_code: org?.postal_code ?? null,
    seller_country: org?.country ?? null,
    seller_vat_regime: org?.vat_regime ?? null,
    seller_iban: org?.iban ?? null,
    seller_bic: org?.bic ?? null,
    seller_rcs_city: org?.rcs_city ?? null,
  };
}

function validateAndMap(
  source: InvoiceWithItems,
  organization: Organization | null,
  preview: boolean,
): ExportPreparation {
  const isCreditNote = source.document_type === 'credit_note';
  const issues = validerFactureAvantEmission(source, organization).bloquants.map((m) => m.message);
  if (!preview && !['issued', 'sent', 'paid'].includes(source.status))
    issues.unshift('L’export électronique définitif est disponible après émission de la facture.');
  if (isCreditNote) {
    const originalDate = invoiceCalendarDate(source.corrected_invoice_issued_at ?? '');
    if (
      !validDate(source.corrected_invoice_issued_at?.slice(0, 10) ?? null) ||
      !validDate(originalDate)
    )
      issues.push('La date d’émission de la facture corrigée est absente ou invalide.');
    if (!clean(source.corrected_invoice_reference))
      issues.push('La référence de la facture corrigée est obligatoire.');
    if (!['full', 'partial'].includes(source.credit_note_scope ?? ''))
      issues.push('Précisez si l’avoir est total ou partiel.');
    if (
      source.corrects_invoice_id === source.id ||
      source.corrected_invoice_reference === source.reference
    )
      issues.push('Un avoir doit faire référence à une autre facture.');
    if (!preview && originalDate > invoiceCalendarDate(source.issued_at ?? ''))
      issues.push('L’avoir ne peut pas précéder la facture corrigée.');
  } else if (source.document_type !== 'invoice') {
    issues.push('Ce type de document n’est pas pris en charge par l’export.');
  }
  if (source.currency !== 'EUR')
    issues.push('Ce premier export prend en charge les factures en euros.');
  if (!['company', 'public_body'].includes(source.customer_type ?? ''))
    issues.push(
      'Ce premier export concerne les entreprises et organismes publics. Les particuliers relèvent d’un autre parcours.',
    );
  if (
    source.seller_country !== 'FR' ||
    source.customer_country !== 'FR' ||
    (source.delivery_country && source.delivery_country !== 'FR')
  )
    issues.push('Ce premier export prend en charge les opérations nationales en France.');
  if (!clean(source.seller_legal_form))
    issues.push('La forme juridique de l’émetteur doit être renseignée.');
  const capitalForms = /^(SASU?|SARL|EURL|SA|SNC|SCA|SCS|SCI)$/i;
  if (
    capitalForms.test(source.seller_legal_form?.trim() ?? '') &&
    source.seller_share_capital_cents == null
  )
    issues.push('Le capital social de la société doit être renseigné.');
  if (!validDate(source.service_date) || !validDate(source.due_date))
    issues.push('Les dates de prestation et d’échéance doivent être valides.');
  if (!preview && (!source.issued_at || !Number.isFinite(Date.parse(source.issued_at))))
    issues.push('La date d’émission est absente ou invalide.');
  if (source.vat_on_debits == null && source.seller_vat_regime !== 'franchise')
    issues.push('Confirmez si l’option TVA d’après les débits s’applique.');
  if (source.seller_vat_regime === 'franchise' && source.vat_on_debits)
    issues.push('L’option TVA d’après les débits est incompatible avec la franchise en base.');
  const groups = new Map<string, CanonicalVatBreakdown>();
  const lines: CanonicalInvoiceLine[] = [];
  for (const [index, line] of source.items.entries()) {
    const unitCode = normalizedUnit(line.unit);
    if (!unitCode)
      issues.push(
        `Ligne ${index + 1} : unité non reconnue. Utilisez u, h, j, m, m², m³, kg, l, forfait ou lot.`,
      );
    if (!['S', 'E', 'Z', 'AE'].includes(line.vat_category)) {
      issues.push(
        `Ligne ${index + 1} : ce cas de TVA n’est pas encore pris en charge par l’export.`,
      );
      continue;
    }
    const category = line.vat_category as SupportedVatCategory;
    if ((category === 'S' && line.vat_rate <= 0) || (category !== 'S' && line.vat_rate !== 0))
      issues.push(`Ligne ${index + 1} : le taux et la catégorie de TVA ne correspondent pas.`);
    const exemption =
      clean(line.vat_exemption_reason) ??
      (category === 'E' && source.seller_vat_regime === 'franchise'
        ? 'TVA non applicable, art. 293 B du CGI.'
        : null);
    if (['E', 'AE'].includes(category) && !exemption)
      issues.push(`Ligne ${index + 1} : précisez le motif d’exonération ou d’autoliquidation.`);
    if (category === 'AE' && (!source.customer_vat_number || !source.seller_vat_number))
      issues.push('L’autoliquidation exige les numéros de TVA de l’émetteur et du client.');
    if (['S', 'Z'].includes(category) && exemption)
      issues.push(
        `Ligne ${index + 1} : un motif d’exonération ne s’applique pas à cette catégorie.`,
      );
    try {
      const netCents = safeInteger(
        roundPositive(
          scaledDecimal(line.quantity, 3) * scaledDecimal(line.unit_price_cents, 0),
          1000n,
        ),
      );
      const key = `${category}:${line.vat_rate}`;
      const group = groups.get(key) ?? {
        category,
        rate: line.vat_rate,
        baseCents: 0,
        taxCents: 0,
        exemptionReason: exemption,
      };
      if (group.exemptionReason !== exemption)
        issues.push(
          'Les lignes d’une même catégorie et d’un même taux doivent porter le même motif d’exonération.',
        );
      group.baseCents = safeInteger(BigInt(group.baseCents) + BigInt(netCents));
      group.taxCents = safeInteger(
        roundPositive(BigInt(group.baseCents) * scaledDecimal(line.vat_rate, 2), 10000n),
      );
      groups.set(key, group);
      lines.push({
        id: String(index + 1),
        description: line.description,
        quantity: String(line.quantity),
        unitCode: unitCode ?? '',
        unitPriceCents: line.unit_price_cents,
        netCents,
        vatCategory: category,
        vatRate: line.vat_rate,
      });
    } catch {
      issues.push(`Ligne ${index + 1} : montant ou précision numérique non pris en charge.`);
    }
  }
  const vatBreakdown = [...groups.values()].sort(
    (a, b) => a.category.localeCompare(b.category) || a.rate - b.rate,
  );
  let netCents = 0,
    taxCents = 0,
    totalCents = 0;
  try {
    netCents = safeInteger(vatBreakdown.reduce((sum, g) => sum + BigInt(g.baseCents), 0n));
    taxCents = safeInteger(vatBreakdown.reduce((sum, g) => sum + BigInt(g.taxCents), 0n));
    totalCents = safeInteger(BigInt(netCents) + BigInt(taxCents));
  } catch {
    issues.push('Les montants dépassent la précision autorisée.');
  }
  if (isCreditNote && totalCents <= 0)
    issues.push('Un avoir doit porter un montant à créditer strictement positif.');
  if (
    !source.totals ||
    source.totals.subtotal_cents !== netCents ||
    source.totals.vat_cents !== taxCents ||
    source.totals.total_cents !== totalCents
  )
    issues.push(
      'Les totaux de la facture ne concordent pas avec ses lignes. Actualisez avant l’export.',
    );
  if (issues.length || preview) return { invoice: null, issues: [...new Set(issues)] };
  const address = (
    line1: string | null,
    line2: string | null,
    city: string | null,
    postalCode: string | null,
    country: string | null,
  ): PostalAddress => ({
    line1: line1!,
    line2,
    city: city!,
    postalCode: postalCode!,
    country: country!,
  });
  return {
    issues: [],
    invoice: {
      ...(isCreditNote
        ? {
            documentType: 'credit_note' as const,
            creditNoteScope: source.credit_note_scope!,
            precedingInvoice: {
              id: source.corrected_invoice_reference!.trim(),
              issueDate: invoiceCalendarDate(source.corrected_invoice_issued_at!),
            },
            creditNoteReason: source.credit_note_reason!.trim(),
          }
        : { documentType: 'invoice' as const }),
      id: source.reference,
      issueDate: invoiceCalendarDate(source.issued_at!),
      dueDate: source.due_date!,
      deliveryDate: source.service_date!,
      currency: 'EUR',
      seller: {
        ...(!source.seller_vat_number
          ? { taxRegistrationId: identifier(source.seller_registration_number).slice(0, 9) }
          : {}),
        name: clean(source.seller_legal_name) ?? source.seller_name!,
        siren: identifier(source.seller_registration_number).slice(0, 9),
        electronicAddress: {
          scheme: '0225',
          value: identifier(source.seller_registration_number).slice(0, 9),
        },
        vatNumber: clean(identifier(source.seller_vat_number)),
        address: address(
          source.seller_address_line1,
          source.seller_address_line2,
          source.seller_city,
          source.seller_postal_code,
          source.seller_country,
        ),
        legalInformation: [
          source.seller_legal_form,
          source.seller_share_capital_cents != null
            ? `Capital social : ${formatMoney(source.seller_share_capital_cents)} EUR`
            : null,
          source.seller_rcs_city ? `RCS ${source.seller_rcs_city}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      },
      buyer: {
        name: clean(source.customer_legal_name) ?? source.customer_name!,
        siren: identifier(source.customer_registration_number).slice(0, 9),
        electronicAddress: {
          scheme: '0225',
          value: identifier(source.customer_registration_number).slice(0, 9),
        },
        vatNumber: clean(identifier(source.customer_vat_number)),
        address: address(
          source.customer_address_line1,
          source.customer_address_line2,
          source.customer_city,
          source.customer_postal_code,
          source.customer_country,
        ),
      },
      deliveryAddress: source.delivery_address_line1
        ? address(
            source.delivery_address_line1,
            source.delivery_address_line2,
            source.delivery_city,
            source.delivery_postal_code,
            source.delivery_country,
          )
        : null,
      buyerReference: clean(source.buyer_reference),
      purchaseOrderReference: clean(source.purchase_order_reference),
      note: [
        isCreditNote
          ? `Avoir ${source.credit_note_scope === 'partial' ? 'partiel' : 'total'}. Motif de l’avoir : ${source.credit_note_reason!.trim()}`
          : null,
        source.operation_type ? OPERATION_LABELS[source.operation_type] : null,
        source.vat_on_debits ? 'Option pour le paiement de la taxe d’après les débits.' : null,
        source.notes,
      ]
        .filter(Boolean)
        .join('\n'),
      paymentTerms: [
        ...mentionsReglement(source),
        !isCreditNote && source.payment_method
          ? `Mode de règlement : ${source.payment_method}`
          : null,
        !isCreditNote && source.seller_iban
          ? `IBAN : ${source.seller_iban}${source.seller_bic ? ' · BIC : ' + source.seller_bic : ''}`
          : null,
      ]
        .filter(Boolean)
        .join('\n'),
      // Le compte de l’émetteur n’est pas le compte destinataire d’un remboursement.
      // UNCL 4461 code 1 : instrument non défini, modalités précisées dans les conditions.
      paymentMeansCode: isCreditNote ? '1' : paymentMeansCode(source.payment_method),
      paymentIban: isCreditNote ? null : clean(identifier(source.seller_iban)),
      paymentBic: isCreditNote ? null : clean(identifier(source.seller_bic)),
      lines,
      vatBreakdown,
      netCents,
      taxCents,
      totalCents,
    },
  };
}

export interface PostalAddress {
  line1: string;
  line2: string | null;
  city: string;
  postalCode: string;
  country: string;
}

export interface InvoiceParty {
  name: string;
  siren: string;
  electronicAddress: { scheme: '0225'; value: string };
  vatNumber: string | null;
  taxRegistrationId?: string;
  address: PostalAddress;
  legalInformation?: string;
}

export type SupportedVatCategory = 'S' | 'Z' | 'E' | 'AE';
export interface CanonicalInvoiceLine {
  id: string;
  description: string;
  quantity: string;
  unitCode: string;
  unitPriceCents: number;
  netCents: number;
  vatRate: number;
  vatCategory: SupportedVatCategory;
}
export interface CanonicalVatBreakdown {
  category: SupportedVatCategory;
  rate: number;
  baseCents: number;
  taxCents: number;
  exemptionReason: string | null;
}

/** Codes de notes BT-21 utilisés par le profil français AFNOR. */
export type InvoiceNoteSubjectCode = 'PMT' | 'PMD' | 'AAB' | 'REG' | 'TXD' | 'AAI';

export interface CanonicalInvoiceNote {
  subjectCode: InvoiceNoteSubjectCode;
  content: string;
}

/** Contrat indépendant de la base et des formats de sortie. Montants en centimes. */
interface CanonicalDocument {
  /** Ephemeral simulation only; never returned by the normal invoice mapper. */
  isTest?: boolean;
  id: string;
  issueDate: string;
  dueDate: string;
  deliveryDate: string;
  currency: 'EUR';
  seller: InvoiceParty;
  buyer: InvoiceParty;
  buyerReference: string | null;
  purchaseOrderReference: string | null;
  deliveryAddress: PostalAddress | null;
  documentNotes: CanonicalInvoiceNote[];
  paymentTerms: string;
  /** Code UNCL 4461, lorsque le mode de règlement est connu sans ambiguïté. */
  paymentMeansCode: '1' | '20' | '30' | '48' | null;
  paymentIban: string | null;
  paymentBic: string | null;
  lines: CanonicalInvoiceLine[];
  vatBreakdown: CanonicalVatBreakdown[];
  netCents: number;
  taxCents: number;
  totalCents: number;
}

export type CanonicalInvoice = CanonicalDocument &
  (
    | { documentType: 'invoice'; precedingInvoice?: never; creditNoteReason?: never }
    | {
        documentType: 'credit_note';
        creditNoteScope: 'full' | 'partial';
        precedingInvoice: { id: string; issueDate: string };
        creditNoteReason: string;
      }
  );

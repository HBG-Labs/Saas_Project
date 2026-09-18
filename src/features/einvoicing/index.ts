/** Préparation, contrôles et export UBL. Aucune transmission à une plateforme. */

export {
  preparationEmetteur,
  validerDestinataire,
  validerEmetteur,
  validerEmission,
  validerFacture,
  type Cible,
  type DestinataireAValider,
  type EmetteurAValider,
  type EtapePreparation,
  type FactureAValider,
  type Gravite,
  type LigneAValider,
  type Manque,
  type Verdict,
} from './validation/rules';

export { emetteurFacture, validerFactureAvantEmission } from './validation/invoice';

export { preparerExportUbl } from './canonical/mapper';
export { serializeUbl } from './serializers/ubl';
export { serializeCii } from './serializers/cii';
export { mentionsReglement, OPERATION_LABELS } from './validation/business-fields';

export { ExportUblPanel } from './components/ExportUblPanel';
export { TransmissionStatusPanel } from './components/TransmissionStatusPanel';
export { ProviderConnectionCard } from './components/ProviderConnectionCard';
export { InvoicesSectionTabs } from './components/InvoicesSectionTabs';
export { ReceivedInvoiceFiltersBar } from './components/ReceivedInvoiceFiltersBar';
export { ReceivedInvoicesTable, type ReceivedInvoiceSort } from './components/ReceivedInvoicesTable';
export { ReceivedInvoiceStatusBadge } from './components/ReceivedInvoiceStatusBadge';
export { RECEIVED_INVOICE_STATUS_LABELS } from './lib/received-invoice-display';

export { formatInvoiceDate } from './canonical/date';
export { ensureFacturX } from './api/facturx.api';
export {
  getReceivedInvoiceDetail,
  getReceivedInvoiceDocumentUrl,
  listReceivedInvoices,
  updateReceivedInvoiceStatus,
  type ReceivedInvoiceDetail,
  type ReceivedInvoiceFilters,
  type ReceivedInvoiceListResult,
  type ReceivedInvoiceSortColumn,
} from './api/received-invoices.api';

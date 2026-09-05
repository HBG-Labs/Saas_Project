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

export { formatInvoiceDate } from './canonical/date';

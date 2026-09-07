export {
  buildDocumentPath,
  createFolder,
  deleteDocument,
  getDocumentDownloadUrl,
  getDocumentUrl,
  listDocuments,
  listFolders,
  updateDocument,
  uploadDocument,
  type DocumentListInput,
  type DocumentListResult,
  type UploadDocumentInput,
} from './api/documents.api';

export {
  ACCEPT_FICHIER,
  DOCUMENTS_PAR_PAGE,
  FILTRES_FAMILLE,
  TAILLE_MAX_LISIBLE,
  TAILLE_MAX_OCTETS,
  TYPES_AUTORISES,
  estPrevisualisable,
  familleDeDocument,
  formaterTaille,
  verifierFichier,
  type FamilleDocument,
  type FiltreFamille,
  type RefusFichier,
} from './constants';

export {
  useDocumentFolders,
  useDocumentMutations,
  useDocuments,
  type DocumentFilters,
} from './hooks/useDocuments';

export { DocumentEditDialog } from './components/DocumentEditDialog';
export { DocumentList } from './components/DocumentList';
export { DocumentPreviewDialog } from './components/DocumentPreviewDialog';
export { DocumentUploadDialog } from './components/DocumentUploadDialog';

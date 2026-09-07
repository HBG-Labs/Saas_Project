export {
  buildDocumentPath,
  compterContenuDossier,
  createFolder,
  deleteDocument,
  deleteFolder,
  getDocumentDownloadUrl,
  getDocumentUrl,
  listDocuments,
  listFolders,
  updateDocument,
  updateFolder,
  uploadDocument,
  type ContenuDossier,
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
  cheminDe,
  construireArbre,
  descendantsDe,
  destinationsPossibles,
  enfantsDe,
  nomDeDossier,
  type NoeudDossier,
  type OptionDossier,
} from './folder-tree';

export {
  useDocumentFolders,
  useDocumentMutations,
  useDocuments,
  type DocumentFilters,
} from './hooks/useDocuments';

export {
  useFileTeleversement,
  type EtatFichier,
  type FichierEnFile,
} from './hooks/useUploadQueue';

export { DocumentEditDialog } from './components/DocumentEditDialog';
export { DocumentList } from './components/DocumentList';
export { DocumentPreviewDialog } from './components/DocumentPreviewDialog';
export { DocumentUploadDialog } from './components/DocumentUploadDialog';
export { FolderDialog, type DemandeDossier } from './components/FolderDialog';
export { FolderBreadcrumb, FolderGrid } from './components/FolderList';

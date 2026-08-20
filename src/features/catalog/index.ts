/** API publique de la feature « catalog » (lecture serveur du catalogue). */
export {
  addFavorite,
  getCategoryBySlug,
  getToolBySlug,
  listCategories,
  listFavorites,
  listPublishedToolSlugs,
  listToolHistory,
  listTools,
  listToolsByCategorySlug,
  recordToolUsage,
  removeFavorite,
  type ToolHistoryRow,
} from './api/catalog.api';

export {
  useCatalogTool,
  useCatalogTools,
  useFavorites,
  useRecordToolUsage,
  useToggleFavorite,
  useToolHistory,
} from './hooks/useLibrary';

/**
 * API publique de la feature « tools ».
 *
 * Les autres features et les pages doivent importer depuis ce point d'entrée,
 * jamais depuis un fichier interne : la règle ESLint `no-restricted-imports`
 * l'impose. Cela permet de réorganiser l'intérieur de la feature sans casser
 * ses consommateurs.
 */
export { ToolErrorBoundary } from './components/ToolErrorBoundary';
export { CategoryCard, type CategoryCardProps } from './components/CategoryCard';
export { ToolCard, type ToolCardProps } from './components/ToolCard';
export { ToolReferences } from './components/ToolReferences';

export { CATEGORY_METADATA, getCategoryMetadata, type CategoryMetadata } from './catalog-metadata';

export {
  defineTool,
  getTool,
  hasTool,
  listRegisteredSlugs,
  listTools,
  listToolsByCategory,
  logReconciliationReport,
  reconcileRegistryWithCatalog,
  registerTool,
  TOOL_CATEGORIES,
  type ToolCategorySlug,
  type ToolDefinition,
} from './registry';

export { useCatalogReconciliation } from './useCatalogReconciliation';

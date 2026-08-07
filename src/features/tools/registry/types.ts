import type { ComponentType, LazyExoticComponent } from 'react';

/** Catégories du catalogue. Doit rester aligné avec la table `categories`. */
export const TOOL_CATEGORIES = ['fiber-optics', 'networking', 'electrical', 'general'] as const;

export type ToolCategorySlug = (typeof TOOL_CATEGORIES)[number];

/**
 * Contrat que doit respecter tout outil de NexoraTech.
 *
 * `Component` est OBLIGATOIREMENT un composant paresseux. C'est ce qui préserve
 * le code splitting : `src/tools/index.ts` charge tous les `index.ts` d'outils
 * en `eager` pour les enregistrer au démarrage, mais seules les métadonnées
 * (des chaînes de caractères) entrent dans le bundle initial. Le code de l'UI
 * n'est téléchargé qu'au moment où l'outil est réellement ouvert.
 *
 * Une règle ESLint (`no-restricted-syntax` appliquée à l'index d'un outil)
 * interdit tout import statique de composant, ce qui rend la violation
 * impossible sans casser le lint.
 */
export interface ToolDefinition {
  /** Identifiant stable, en kebab-case. Doit correspondre à `tools.slug` en base. */
  slug: string;
  category: ToolCategorySlug;
  title: string;
  description: string;
  keywords: readonly string[];
  /** Nom d'icône lucide (ex. « calculator »). Une chaîne, pour ne pas coupler le registry à une librairie d'icônes. */
  icon: string;
  /** Toujours `lazy(() => import('./MonOutilTool'))`. */
  Component: LazyExoticComponent<ComponentType>;
}

export const TOOL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Point d'entrée unique pour déclarer un outil.
 *
 * Sert de contrôle de type explicite et de repère de recherche : tout outil du
 * projet passe par `defineTool`.
 */
export function defineTool(definition: ToolDefinition): ToolDefinition {
  return definition;
}

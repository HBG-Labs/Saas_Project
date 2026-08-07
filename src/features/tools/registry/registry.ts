import {
  TOOL_CATEGORIES,
  TOOL_SLUG_PATTERN,
  type ToolCategorySlug,
  type ToolDefinition,
} from './types';

/**
 * Registre en mémoire des implémentations d'outils.
 *
 * Le registry ne connaît AUCUN outil à l'avance : les outils s'y déclarent
 * eux-mêmes au démarrage (voir `src/tools/index.ts`). Ajouter un outil ne
 * demande donc de modifier aucun fichier du cœur applicatif.
 */
const registry = new Map<string, ToolDefinition>();

export function registerTool(definition: ToolDefinition): void {
  if (!TOOL_SLUG_PATTERN.test(definition.slug)) {
    throw new Error(
      `Slug d'outil invalide : « ${definition.slug} ». Attendu : kebab-case (ex. « ohms-law »).`,
    );
  }

  if (!TOOL_CATEGORIES.includes(definition.category)) {
    throw new Error(
      `Catégorie inconnue « ${definition.category} » pour l'outil « ${definition.slug} ». ` +
        `Valeurs acceptées : ${TOOL_CATEGORIES.join(', ')}.`,
    );
  }

  const existing = registry.get(definition.slug);
  if (existing) {
    throw new Error(
      `Deux outils déclarent le slug « ${definition.slug} ». Les slugs doivent être uniques.`,
    );
  }

  registry.set(definition.slug, definition);
}

export function getTool(slug: string): ToolDefinition | undefined {
  return registry.get(slug);
}

export function hasTool(slug: string): boolean {
  return registry.has(slug);
}

/** Tous les outils enregistrés, triés par titre. */
export function listTools(): ToolDefinition[] {
  return [...registry.values()].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
}

export function listToolsByCategory(category: ToolCategorySlug): ToolDefinition[] {
  return listTools().filter((tool) => tool.category === category);
}

export function listRegisteredSlugs(): string[] {
  return [...registry.keys()];
}

/** Réservé aux tests : garantit l'isolation entre les cas. */
export function resetRegistry(): void {
  registry.clear();
}

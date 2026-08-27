import { registerTool, type ToolDefinition } from '@/features/tools/registry';

/**
 * Auto-découverte des outils.
 *
 * Chaque `src/tools/<slug>/index.ts` est chargé au démarrage et enregistré
 * automatiquement. Ajouter un outil = créer un dossier. AUCUN fichier du cœur
 * applicatif n'est à modifier.
 *
 * Les dossiers préfixés par `_` (gabarits) ainsi que les outils masqués sont exclus.
 */
const modules = import.meta.glob<{ default: ToolDefinition }>(
  [
    './scientific-calculator/index.ts',
  ],
  {
    eager: true,
  },
);

for (const [path, module] of Object.entries(modules)) {
  if (!module.default) {
    console.error(
      `[outils] ${path} n'a pas d'export par défaut. Attendu : « export default defineTool({...}) ».`,
    );
    continue;
  }

  registerTool(module.default);
}

export const registeredToolCount = Object.keys(modules).length;

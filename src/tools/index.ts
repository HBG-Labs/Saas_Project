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
const modules = import.meta.glob<{ default: ToolDefinition | undefined }>(
  ['./*/index.ts', '!./_template/**'],
  {
    eager: true,
  },
);

for (const module of Object.values(modules)) {
  if (!module.default) {
    continue;
  }

  registerTool(module.default);
}

export const registeredToolCount = Object.keys(modules).length;

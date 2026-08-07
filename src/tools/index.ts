import { registerTool, type ToolDefinition } from '@/features/tools/registry';

/**
 * Auto-découverte des outils.
 *
 * Chaque `src/tools/<slug>/index.ts` est chargé au démarrage et enregistré
 * automatiquement. Ajouter un outil = créer un dossier. AUCUN fichier du cœur
 * applicatif n'est à modifier.
 *
 * Pourquoi `eager: true` ne casse pas le code splitting :
 * seules les métadonnées (chaînes) sont chargées ici. Le composant d'un outil
 * est déclaré via `lazy(() => import('./MonOutilTool'))`, donc son code n'est
 * téléchargé qu'à l'ouverture de l'outil. La règle ESLint appliquée à l'index
 * de chaque outil interdit tout import statique de composant, ce qui rend cette
 * garantie structurelle plutôt que documentaire.
 *
 * Les dossiers préfixés par `_` (gabarits) sont exclus.
 */
const modules = import.meta.glob<{ default: ToolDefinition }>(['./*/index.ts', '!./_*/**'], {
  eager: true,
});

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

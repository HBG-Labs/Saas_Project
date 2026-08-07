import { lazy } from 'react';

import { defineTool } from '@/features/tools/registry';

/**
 * Déclaration de l'outil.
 *
 * Les dossiers préfixés par `_` sont exclus de l'auto-découverte : ce gabarit
 * n'est donc pas enregistré. Il reste néanmoins compilé, linté et testé, ce qui
 * garantit qu'il ne devient jamais obsolète.
 *
 * ⚠️ `Component` doit TOUJOURS utiliser `lazy(() => import(...))`.
 * Un import statique ferait entrer le code UI dans le bundle initial et sera
 * refusé par ESLint.
 */
export default defineTool({
  slug: 'template',
  category: 'general',
  title: "Gabarit d'outil",
  description: 'Squelette à copier pour créer un nouvel outil NexoraTech.',
  keywords: ['gabarit', 'exemple'],
  icon: 'puzzle',
  Component: lazy(() => import('./TemplateTool')),
});

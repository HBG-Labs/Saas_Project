# Implémentations des outils

Ce dossier contient **un sous-dossier par outil**. Le cœur de l'application ne
connaît aucun outil à l'avance : `src/tools/index.ts` les découvre et les
enregistre automatiquement au démarrage.

> Le *moteur* du système vit dans [`src/features/tools/registry/`](../features/tools/registry/).
> Ici se trouvent uniquement les *implémentations*.

## Ajouter un outil

1. Copier `_template/` vers `<slug>/` (kebab-case, ex. `ohms-law`).
2. Renseigner les métadonnées dans `index.ts`.
3. Écrire la logique de calcul dans `compute.ts` et ses tests dans `compute.test.ts`.
4. Écrire l'UI dans `<Nom>Tool.tsx`.
5. Ajouter la ligne correspondante dans la table `tools` via une migration
   (voir [`supabase/README.md`](../../supabase/README.md)).

Aucun fichier existant n'est à modifier.

## Structure imposée

```
src/tools/<slug>/
├─ index.ts          → export default defineTool({ ... })
├─ <Nom>Tool.tsx     → UI uniquement
├─ compute.ts        → fonctions PURES, sans React
├─ compute.test.ts   → tests unitaires, sans DOM
└─ schema.ts         → schéma zod des entrées
```

## Deux règles appliquées par ESLint

Ce ne sont pas des conventions : les enfreindre casse `npm run lint`.

**1. `index.ts` ne peut pas importer statiquement le composant.**

```ts
// ❌ Casse le code splitting : le code UI de TOUS les outils
//    se retrouverait dans le bundle initial.
import OhmsLawTool from './OhmsLawTool';

// ✅ Chargé uniquement quand l'utilisateur ouvre l'outil.
Component: lazy(() => import('./OhmsLawTool'));
```

`src/tools/index.ts` charge les `index.ts` en `eager` pour pouvoir enregistrer
les outils au démarrage. Un import statique y ferait donc entrer tout le code UI
dans le bundle de démarrage.

**2. `compute.ts` ne peut importer ni React, ni les services.**

La logique de calcul doit être testable sans DOM ni réseau — c'est ce qui rend
les outils vérifiables indépendamment de l'interface.

# Architecture de NexoraTech

## Principe directeur

L'application est organisée en couches, du plus générique au plus spécifique.
**Les dépendances ne vont que vers le bas.**

```
   pages / components        ← présentation, aucune logique métier
          ↓
        features            ← logique métier, regroupée par domaine
          ↓
        services            ← seule couche qui parle à Supabase
          ↓
   lib / config / types     ← utilitaires purs, sans dépendance applicative
```

Ces règles ne sont pas des conventions : **elles sont appliquées par ESLint** et
une violation casse `npm run lint`. Une convention non outillée finit toujours
par être contournée sous la pression du délai.

| Périmètre | Interdiction | Motif |
|---|---|---|
| tout sauf `services/` et `features/*/api/` | importer le client Supabase | Supabase ne doit jamais atteindre les composants |
| `components/ui/` | importer `features/`, `services/`, `tools/` | les primitives restent réutilisables |
| `features/x/` | importer les fichiers internes de `features/y/` | force le passage par l'API publique `index.ts` |
| `tools/*/compute.ts` | importer React ou les services | garantit que les calculs sont testables sans UI |
| `tools/*/index.ts` | tout import statique de composant | préserve le code splitting |

Les imports de **types** Supabase restent autorisés partout : ils disparaissent à
la compilation et ne peuvent donc pas alourdir le bundle.

## Arborescence

```
src/
├─ app/            racine de composition : providers, routeur
├─ components/
│  ├─ ui/          primitives (Button…) — zéro logique métier
│  ├─ layout/      AppShell
│  └─ feedback/    ErrorBoundary, ErrorFallback, LoadingScreen, PagePlaceholder
├─ features/
│  ├─ auth/        session, garde de routes, API d'authentification
│  └─ tools/       registry (moteur du catalogue) + ToolErrorBoundary
├─ tools/          IMPLÉMENTATIONS des outils, un dossier chacun
├─ services/       accès Supabase (client + déballage des réponses)
├─ lib/            pur : cn, erreurs, client TanStack Query
├─ config/         env validé, constantes de routes
├─ types/          types de base et types métier
├─ pages/          composants de route, tous chargés paresseusement
├─ styles/         Tailwind 4 + tokens du futur Design System
└─ test/           setup et helpers de rendu
```

## Le système modulaire d'outils

C'est l'exigence centrale du projet : **ajouter un outil ne doit modifier aucun
fichier du cœur applicatif.**

Deux moitiés distinctes :

- `src/features/tools/registry/` — le **moteur**. Ne connaît aucun outil.
- `src/tools/<slug>/` — les **implémentations**. S'enregistrent elles-mêmes.

`src/tools/index.ts` découvre les outils via `import.meta.glob` et les
enregistre au démarrage. Créer un dossier suffit.

### Comment le code splitting est préservé

L'auto-découverte charge les `index.ts` en `eager` — c'est nécessaire pour
connaître le catalogue dès le démarrage. Le risque est évident : si un `index.ts`
importait statiquement son composant, **le code UI de tous les outils entrerait
dans le bundle initial**.

La parade est double :

1. `ToolDefinition.Component` est typé `LazyExoticComponent` — un composant
   ordinaire est refusé par TypeScript.
2. Une règle ESLint interdit tout import statique dans `src/tools/*/index.ts`,
   à l'exception des modules non-UI (`compute`, `schema`, `types`, `constants`).

Seules les métadonnées (des chaînes) sont donc chargées au démarrage ; le code
d'un outil arrive quand l'utilisateur l'ouvre.

Voir [`src/tools/README.md`](src/tools/README.md) pour la marche à suivre.

## Isolation des pannes

Deux niveaux, délibérément distincts :

| Frontière | Portée | Effet d'un crash |
|---|---|---|
| `ErrorBoundary` racine (`app/providers.tsx`) | application entière | écran d'erreur pleine page |
| `ToolErrorBoundary` (`pages/ToolDetailPage.tsx`) | zone d'un outil seulement | en-tête, navigation et routing **restent opérationnels** |

Les outils constituent la partie la plus volumineuse et la plus changeante du
produit, et chacun est chargé dynamiquement. Un calcul qui déborde ne doit pas
emporter l'application : seule sa zone affiche une erreur, avec un bouton de
relance. Changer d'outil réinitialise automatiquement la frontière via
`resetKeys`.

## Authentification

`AuthProvider` expose trois états : `loading`, `authenticated`,
`unauthenticated`. **`loading` est distinct de `unauthenticated`** — les
confondre redirigerait vers `/login` un utilisateur connecté à chaque
rechargement de page.

Deux précautions dans la séquence de démarrage :

1. L'abonnement `onAuthStateChange` est posé **avant** la lecture de la session
   initiale : un événement survenant pendant cette lecture serait autrement
   perdu.
2. Le résultat de `getSession()` n'est appliqué **que si l'état est encore
   `loading`** : sinon une lecture lente écraserait un état plus récent livré
   par l'abonnement.

Les mises à jour identiques sont filtrées (comparaison du jeton et de l'identité)
pour éviter les rendus inutiles quand Supabase rediffuse la même session.

## Gestion des erreurs

Toute erreur atteignant l'UI est une `AppError` avec un message sûr en français.
`mapPostgrestError` traduit les codes Postgres (`23505`, `42501`, `PGRST116`…)
sans jamais reprendre les champs `details`/`hint`, qui divulgueraient la
structure de la base. L'erreur d'origine reste dans `cause` pour la
journalisation.

## Choix explicitement écartés

| Écarté | Raison |
|---|---|
| Zustand / Redux | Le server state est couvert par TanStack Query, la session par un contexte, le reste est local. À reconsidérer si un état UI non-serveur doit être partagé entre branches éloignées de l'arbre. |
| `manualChunks` | Le découpage par route suffit et est vérifié. Un découpage vendor est une optimisation de cache à mesurer, pas à supposer. |
| `react-hook-form` | Aucun formulaire avant la Phase 2. |
| `eslint-plugin-boundaries` | `no-restricted-imports` couvre le besoin sans dépendance supplémentaire. |
| Tables `tool_configurations` / `references` | Leur schéma dépend d'un usage qui n'existe pas encore. |

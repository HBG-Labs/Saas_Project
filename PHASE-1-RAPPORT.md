# NexoraTech — Rapport de fin de Phase 1

**Date :** 7 août 2026
**Commit :** `8326d5e` — branche `main`
**Statut :** PHASE 1 — READY FOR REVIEW

---

## 0. Réponse à la contre-expertise Gemini Flash

### 0.1 Versions prétendument « fictives ou futures » — affirmation **incorrecte**

Le registre npm a été interrogé directement, avec les dates de publication comme
preuve :

| Paquet | `latest` réel | Publié le |
|---|---|---|
| react | 19.2.8 | 2026-08-07 |
| react-router | 8.3.0 | 2026-08-07 |
| typescript | 7.0.2 | 2026-08-07 |
| tailwindcss | 4.3.3 | 2026-08-07 |
| typescript-eslint | 8.66.0 | 2026-08-07 |
| vite | 8.2.1 | 2026-08-06 |
| @supabase/supabase-js | 2.112.2 | 2026-08-06 |
| eslint | 10.8.0 | 2026-07-24 |
| vitest | 4.1.10 | 2026-07-24 |

Ces versions existent. Le cutoff d'entraînement de Gemini Flash est simplement
antérieur à ces publications. **Aucune version proposée par Gemini n'a été
adoptée** : le registre npm accessible depuis l'environnement est resté la seule
source de vérité, conformément à la consigne.

### 0.2 Deux `latest` néanmoins écartés — pour incompatibilité vérifiée

Vérification faite via `npm view <pkg> peerDependencies` :

**TypeScript 6.0.3 retenu au lieu de 7.0.2**
`typescript-eslint@8.66.0` — seule ligne stable, canary `8.66.1-alpha.10`
incluse — déclare `typescript: ">=4.8.4 <6.1.0"`. TypeScript 7 (portage natif Go)
n'est pas encore supporté et casserait tout le lint type-aware.
Vite ne typecheckant pas (transpilation seule via esbuild/oxc), le build n'est
pas affecté.
*Déclencheur de mise à jour :* passer à TS 7 dès que `typescript-eslint` élargit
son peer range.

**ESLint 9.39.5 retenu au lieu de 10.8.0**
`eslint-plugin-jsx-a11y@6.10.2` déclare `eslint: "^3 || … || ^9"` — ESLint 10
absent. La version 9.39.5 porte le dist-tag `maintenance` (activement
maintenue, flat config). Toute la chaîne s'y aligne proprement.

**Résultat : zéro `--legacy-peer-deps`, zéro `overrides`, zéro hack.**

*Conséquence méthodologique :* `npm create vite@latest` aurait scaffoldé
TypeScript 7 et ESLint 10. Le scaffolder n'a donc pas été utilisé —
`package.json`, `index.html` et `vite.config.ts` ont été écrits à la main sur la
matrice vérifiée. Bénéfice secondaire : aucun boilerplate à purger.

### 0.3 Point A — Code splitting du registry : **corrigé et prouvé**

La préoccupation était fondée. Si un `src/tools/<slug>/index.ts` importait
statiquement son composant, l'auto-découverte `eager` ferait entrer le code UI
de **tous** les outils dans le bundle initial.

Double parade, structurelle :

1. **Au niveau du type** — `ToolDefinition.Component` est typé
   `LazyExoticComponent<ComponentType>`. TypeScript refuse un composant
   ordinaire.
2. **Au niveau du lint** — règle `no-restricted-syntax` sur
   `src/tools/*/index.ts` interdisant tout import statique, à l'exception des
   modules non-UI (`compute`, `schema`, `types`, `constants`).

### 0.4 Point B — ToolErrorBoundary : **implémentée et testée**

Placée dans `ToolDetailPage`, à l'intérieur de l'AppShell, au plus près de la
zone d'affichage de l'outil. En cas de crash :

- l'en-tête, la navigation et le routing restent opérationnels ;
- seule la zone de l'outil affiche un message récupérable ;
- « Relancer l'outil » remonte le composant à neuf ;
- `resetKeys={[toolSlug]}` réinitialise automatiquement au changement d'outil.

Quatre tests vérifient chacun de ces comportements, dont la non-exposition du
message technique de l'erreur.

### 0.5 Point C — AuthProvider : trois garanties explicites

1. **Ordre d'initialisation** — l'abonnement `onAuthStateChange` est posé
   **avant** la lecture de la session initiale. Un événement survenant pendant
   la résolution de `getSession()` serait autrement perdu.
2. **Garde anti-course** — le résultat de `getSession()` n'est appliqué **que si
   l'état est encore `loading`**. Une lecture lente ne peut donc pas écraser un
   état plus récent livré par l'abonnement.
3. **Filtrage des rendus inutiles** — `reduceSession` compare le jeton d'accès et
   l'identité, et renvoie l'objet d'état précédent à l'identique si rien n'a
   changé. React court-circuite alors le rendu (`Object.is`).

Le nettoyage est assuré par `subscription.unsubscribe()` plus un drapeau
`active` neutralisant toute mise à jour post-démontage (StrictMode monte les
effets deux fois).

`loading` est un état à part entière, distinct de `unauthenticated` — les
confondre redirigerait vers `/login` un utilisateur connecté à chaque
rechargement de page.

### 0.6 Point D — OneDrive : recommandation **testée puis rejetée**

La jonction NTFS recommandée par Gemini a été implémentée, puis **invalidée
empiriquement**. `npm install` l'a détruite :

```
npm warn reify Removing non-directory C:\...\ApplicationTech\node_modules
```

npm 11 supprime le lien au début de chaque installation et recrée un dossier
réel. **La mitigation ne survit pas à `npm install`** — elle a donc été retirée.

Elle a été remplacée par le traitement du **vrai** risque. Diagnostic posé sur
l'environnement réel :

- clé `FilesOnDemandDisabled` absente → **Files On-Demand ACTIF** ;
- processus OneDrive en cours d'exécution ;
- dossier projet portant l'attribut `ReparsePoint`.

Dans cette configuration, le danger n'est pas le volume synchronisé (gênant mais
bénin) : c'est la **déshydratation**. OneDrive peut transformer un fichier de
`node_modules` en placeholder cloud, et Node échoue alors en `EIO`/`ENOENT` au
milieu d'un build.

`scripts/protect-node-modules.ps1` épingle `node_modules` en local
(`attrib +P -U /S /D`), ce qui interdit à OneDrive de le déshydrater. Le script
est idempotent et documenté ; il est à relancer après chaque `npm install`.

```bash
npm run protect:node-modules
```

---

## 1. Architecture finale

### 1.1 Couches

Les dépendances ne vont que vers le bas.

```
   pages / components        ← présentation, aucune logique métier
          ↓
        features             ← logique métier, regroupée par domaine
          ↓
        services             ← seule couche qui parle à Supabase
          ↓
   lib / config / types      ← utilitaires purs, sans dépendance applicative
```

### 1.2 Frontières appliquées **mécaniquement**

Ce ne sont pas des conventions : une violation casse `npm run lint`. Une
convention non outillée finit toujours par être contournée sous la pression du
délai.

| Périmètre | Interdiction | Motif |
|---|---|---|
| tout sauf `services/` et `features/*/api/` | client Supabase | Supabase n'atteint jamais les composants |
| `components/ui/` | `features/`, `services/`, `tools/` | primitives réutilisables |
| `features/x/` | internes de `features/y/` | force l'API publique `index.ts` |
| `tools/*/compute.ts` | React, services | calculs testables sans UI (§16) |
| `tools/*/index.ts` | import statique de composant | préserve le code splitting |

Les imports de **types** Supabase restent autorisés partout
(`allowTypeImports: true`) : ils disparaissent à la compilation et ne peuvent
donc pas alourdir le bundle.

**Vérification empirique.** Des violations volontaires ont été créées, lintées,
puis supprimées. Les quatre règles se déclenchent :

```
src/components/ui/__violation.ts
  error  '@/features/auth' import is restricted…
         Une primitive UI ne doit dépendre ni des features, ni des services…

src/pages/__violation.ts
  error  '@/services/supabase/client' import is restricted…
         Accès direct à Supabase interdit ici…

src/tools/__violation/compute.ts
  error  'react' import is restricted…
         compute.ts doit rester pur et testable sans DOM…

src/tools/__violation/index.ts
  error  Import statique interdit dans l'index d'un outil : il casserait le
         code splitting… Utilisez Component: lazy(() => import('./MonOutilTool'))

✖ 4 problems (4 errors, 0 warnings)
```

### 1.3 Système modulaire d'outils

Exigence centrale : **ajouter un outil ne doit modifier aucun fichier du cœur.**

Deux moitiés distinctes :

- `src/features/tools/registry/` — le **moteur**, ne connaît aucun outil ;
- `src/tools/<slug>/` — les **implémentations**, qui s'enregistrent elles-mêmes.

`src/tools/index.ts` découvre les outils via
`import.meta.glob(['./*/index.ts', '!./_*/**'], { eager: true })`. Créer un
dossier suffit à enregistrer un outil.

Structure imposée par outil (gabarit vivant dans `src/tools/_template/`,
compilé, linté et testé — donc jamais obsolète) :

```
src/tools/<slug>/
├─ index.ts          → export default defineTool({ … })
├─ <Nom>Tool.tsx     → UI uniquement
├─ compute.ts        → fonctions PURES, sans React
├─ compute.test.ts   → tests unitaires, sans DOM
└─ schema.ts         → schéma zod des entrées
```

`reconcile.ts` compare les slugs du registry et ceux de la table `tools`, et
signale les divergences — garde-fou du modèle hybride.

### 1.4 Isolation des pannes — deux niveaux délibérément distincts

| Frontière | Portée | Effet d'un crash |
|---|---|---|
| `ErrorBoundary` racine (`app/providers.tsx`) | application entière | écran d'erreur pleine page |
| `ToolErrorBoundary` (`pages/ToolDetailPage.tsx`) | zone d'un outil | en-tête, navigation et routing **restent opérationnels** |

---

## 2. Arborescence finale

90 fichiers versionnés.

```
ApplicationTech/
├─ .env.example              ← seul fichier d'environnement versionné
├─ .gitattributes            ← normalisation LF (dépôt développé sous Windows)
├─ .gitignore
├─ .prettierrc.json  .prettierignore
├─ ARCHITECTURE.md           ← couches, frontières, système d'outils
├─ README.md                 ← installation, scripts, note OneDrive
├─ PHASE-1-RAPPORT.md        ← ce document
├─ eslint.config.js          ← flat config + 5 règles d'architecture
├─ index.html                ← lang="fr", viewport-fit=cover
├─ package.json  package-lock.json
├─ playwright.config.ts      ← écrit, non installé (voir §9)
├─ tsconfig.json  tsconfig.app.json  tsconfig.node.json
├─ vite.config.ts            ← Vite + Vitest, une seule config
│
├─ e2e/
│  └─ smoke.spec.ts          ← 3 parcours documentés pour la Phase 2
│
├─ scripts/
│  └─ protect-node-modules.ps1
│
├─ supabase/
│  ├─ README.md              ← application sans CLI/Docker, RLS, types
│  └─ migrations/
│     ├─ 20260807090000_profiles.sql
│     ├─ 20260807090100_catalog.sql
│     ├─ 20260807090200_user_data.sql
│     └─ 20260807090300_seed_categories.sql
│
└─ src/
   ├─ app/
   │  ├─ App.tsx
   │  ├─ providers.tsx       ← ErrorBoundary → QueryClient → AuthProvider
   │  ├─ router.tsx          ← `routes` exporté séparément (testabilité)
   │  └─ router.test.tsx     ← 7 tests sur l'arbre de routes RÉEL
   │
   ├─ components/
   │  ├─ ui/Button.tsx                    ← cva, cible tactile 44 px
   │  ├─ layout/AppShell.tsx              ← header/nav/main, lien d'évitement
   │  └─ feedback/
   │     ├─ ErrorBoundary.tsx             ← générique, avec resetKeys
   │     ├─ ErrorFallback.tsx
   │     ├─ LoadingScreen.tsx             ← role="status" aria-live
   │     └─ PagePlaceholder.tsx
   │
   ├─ features/
   │  ├─ auth/
   │  │  ├─ api/auth.api.ts               ← seul accès Supabase de la feature
   │  │  ├─ components/ProtectedRoute.tsx
   │  │  ├─ components/PublicOnlyRoute.tsx
   │  │  ├─ context/auth-context.ts
   │  │  ├─ context/AuthProvider.tsx
   │  │  ├─ hooks/useAuth.ts
   │  │  └─ index.ts                      ← API publique
   │  └─ tools/
   │     ├─ components/ToolErrorBoundary.tsx (+ .test.tsx)
   │     ├─ registry/types.ts             ← ToolDefinition, defineTool
   │     ├─ registry/registry.ts          (+ .test.ts)
   │     ├─ registry/reconcile.ts
   │     └─ index.ts
   │
   ├─ tools/
   │  ├─ index.ts                         ← auto-découverte
   │  ├─ README.md                        ← « comment ajouter un outil »
   │  └─ _template/                       ← gabarit vivant
   │     ├─ index.ts  TemplateTool.tsx  compute.ts  compute.test.ts  schema.ts
   │
   ├─ services/supabase/
   │  ├─ client.ts                        ← singleton typé, seule instanciation
   │  ├─ query.ts                         ← unwrap / unwrapMaybe
   │  └─ index.ts
   │
   ├─ lib/
   │  ├─ cn.ts
   │  ├─ query-client.ts
   │  └─ errors/
   │     ├─ app-error.ts
   │     ├─ map-supabase-error.ts (+ .test.ts)
   │     └─ index.ts
   │
   ├─ config/
   │  ├─ env.ts (+ .test.ts)              ← validation zod au démarrage
   │  └─ routes.ts                        ← aucune URL en dur ailleurs
   │
   ├─ types/
   │  ├─ database.ts                      ← miroir exact des migrations
   │  └─ domain.ts
   │
   ├─ pages/                              ← 15 pages, toutes lazy
   │  ├─ HomePage.tsx  NotFoundPage.tsx (+ .test.tsx)
   │  ├─ LoginPage  RegisterPage  ForgotPasswordPage  AuthCallbackPage
   │  ├─ ToolsPage  ToolDetailPage  CategoryPage  ReferencesPage
   │  └─ DashboardPage  FavoritesPage  HistoryPage  ProfilePage  SettingsPage
   │
   ├─ styles/index.css                    ← Tailwind 4 + @theme + a11y
   ├─ test/setup.ts  test/utils.tsx
   ├─ main.tsx
   └─ vite-env.d.ts
```

---

## 3. Versions réellement utilisées

Environnement : **Node v24.19.0**, **npm 11.17.0**, **git 2.55.0.windows.3**.

Sortie de `npm ls --depth=0` :

### Runtime

| Paquet | Version | Justification |
|---|---|---|
| `react` / `react-dom` | 19.2.8 | Imposé |
| `react-router` | 8.3.0 | `react-router-dom` est figé à 7.18.2 : en v8 tout est consolidé dans `react-router`. Lazy routes natives |
| `@supabase/supabase-js` | 2.112.2 | Imposé |
| `@tanstack/react-query` | 5.101.4 | Les appels Supabase **sont** du server state : cache, dédup, retry, invalidation |
| `zod` | 4.4.3 | Validation runtime (env, entrées) + inférence de types = source unique |
| `clsx` | 2.1.1 | Composition de classes conditionnelles |
| `tailwind-merge` | 3.6.0 | Résolution des conflits Tailwind (`cn()`) |
| `class-variance-authority` | 0.7.1 | Variantes typées — fondation du Design System |
| `lucide-react` | 1.30.0 | Icônes tree-shakeables |

### Développement

| Paquet | Version |
|---|---|
| `vite` | 8.2.1 |
| `@vitejs/plugin-react` | 6.0.5 |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.3 |
| **`typescript`** | **6.0.3** (voir §0.2) |
| `@types/react` / `@types/react-dom` | 19.2.18 / 19.2.4 |
| `@types/node` | 26.2.0 |
| **`eslint`** | **9.39.5** (voir §0.2) |
| `typescript-eslint` | 8.66.0 |
| `eslint-plugin-react-hooks` | 7.1.1 |
| `eslint-plugin-react-refresh` | 0.5.3 |
| `eslint-plugin-jsx-a11y` | 6.10.2 |
| `eslint-config-prettier` | 10.1.8 |
| `globals` | 17.9.0 |
| `prettier` | 3.9.6 |
| `prettier-plugin-tailwindcss` | 0.8.1 |
| `vitest` | 4.1.10 |
| `@vitest/coverage-v8` | 4.1.10 |
| `jsdom` | 30.0.1 |
| `@testing-library/react` | 16.3.2 |
| `@testing-library/jest-dom` | 7.0.0 |
| `@testing-library/user-event` | 14.6.3 |

**33 dépendances directes, 319 paquets installés au total, 0 conflit de peer
dependencies.**

### Écartés volontairement

| Paquet | Raison |
|---|---|
| `react-hook-form` | Aucun formulaire avant la Phase 2 |
| `@playwright/test` | Aucun parcours réel à tester (voir §9) |
| Zustand / Redux | Server state couvert par TanStack Query, session par contexte, reste local |
| `eslint-plugin-boundaries` | `no-restricted-imports` couvre le besoin sans dépendance |

---

## 4. Configuration Supabase

### 4.1 Cinq tables MVP

```
auth.users (géré par Supabase)
   │
   ├─1:1─ profiles          lisible/modifiable par son propriétaire uniquement
   ├─1:N─ favorites  ──┐
   └─1:N─ tool_history ─┤    isolées par utilisateur
                        │
categories ─1:N─ tools ─┘    lecture publique du contenu publié
```

| Table | RLS |
|---|---|
| `profiles` | `select`/`update` sur sa propre ligne. **Aucune** politique `insert`/`delete` : trigger `handle_new_user()` + cascade |
| `categories` | `select` du contenu publié, pour `anon` + `authenticated`. **Aucune écriture** |
| `tools` | idem `categories` |
| `favorites` | `select`/`insert`/`delete` propres, avec `with check`. Pas d'`update` |
| `tool_history` | `select`/`insert`/`delete` propres. Pas d'`update` : append-only |

### 4.2 Principes de sécurité appliqués

- **RLS activée sur les cinq tables**, sans exception.
- **Moindre privilège** : le catalogue n'est pas modifiable depuis le client.
  L'administration passe par le dashboard (`service_role`).
- **`with check` sur toutes les insertions** de données utilisateur — sans lui,
  un client pourrait écrire une ligne au nom d'un autre utilisateur.
- **Pas de politique `update`** là où elle n'a pas de sens métier. Toute
  permission non nécessaire est une surface d'attaque.
- **`(select auth.uid())`** plutôt que `auth.uid()` : évaluation unique par
  requête (initplan) au lieu d'une fois par ligne.
- **`set search_path = ''`** sur les fonctions `security definer` : empêche le
  détournement des appels non qualifiés dans une fonction privilégiée.
- **Index sur les colonnes de policy** : `tools_category_id_idx`,
  `tool_history_user_used_idx`.

### 4.3 Application des migrations

Ni la CLI Supabase ni Docker ne sont installés. Les migrations sont des fichiers
SQL bruts, à exécuter **dans l'ordre des horodatages** via le SQL Editor du
dashboard. Ils restent compatibles avec `supabase db push`. Procédure détaillée
dans `supabase/README.md`.

### 4.4 Migrations volontairement reportées

| Table | Raison |
|---|---|
| `tool_configurations` | Sa forme dépend entièrement de la structure des paramètres des outils, qui n'existent pas encore. La créer maintenant garantirait de la refaire. |
| `references` | Aucun contenu défini. Le format (texte, tableau, abaque, fichier) déterminera le schéma. |

---

## 5. Variables d'environnement

Fichier `.env.local` (jamais versionné). Modèle : `.env.example`.

| Variable | Rôle |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique (`sb_publishable_…` ou clé `anon` legacy) |
| `VITE_APP_ENV` | `development` \| `staging` \| `production` |

Validées par Zod **au démarrage** (`src/config/env.ts`) : une variable manquante
ou mal formée provoque un échec immédiat nommant précisément le problème, plutôt
qu'un `undefined` opaque révélé bien plus tard au milieu d'un appel réseau.

> **`SUPABASE_SERVICE_ROLE_KEY` ne doit jamais figurer dans ce projet.** Cette
> clé contourne la RLS et n'a sa place que côté serveur. Vite n'expose au bundle
> que les variables préfixées `VITE_` — une clé serveur en est donc
> structurellement exclue.

---

## 6. Commandes

```bash
npm install
Copy-Item .env.example .env.local     # puis renseigner les valeurs
npm run dev                            # http://localhost:5173
```

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Typecheck puis build de production |
| `npm run preview` | Sert le build de production |
| `npm run typecheck` | TypeScript seul |
| `npm run lint` | ESLint (inclut les règles d'architecture) |
| `npm run lint:fix` | ESLint avec corrections |
| `npm run format` / `format:check` | Prettier |
| `npm run test` | Tests unitaires et d'intégration |
| `npm run test:watch` | Mode surveillance |
| `npm run test:coverage` | Avec couverture |
| `npm run protect:node-modules` | Protection OneDrive |

---

## 7. Tests exécutés et résultats réels

Toutes les commandes ci-dessous ont été **réellement exécutées**.

| Vérification | Résultat |
|---|---|
| `npm install` | ✅ 407 paquets ajoutés, **0 conflit de peer dependencies** |
| `npm run typecheck` | ✅ 0 erreur |
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm run format:check` | ✅ « All matched files use Prettier code style! » |
| `npm run test` | ✅ **31 tests / 7 fichiers**, sur 3 exécutions consécutives |
| `npm run build` | ✅ built in 1,08 s |
| `npm run dev` | ✅ « VITE v8.2.1 ready in 1286 ms » |
| Règles d'architecture | ✅ 4 violations volontaires correctement rejetées |

### 7.1 Répartition des 31 tests

| Fichier | Tests | Ce qui est prouvé |
|---|---|---|
| `src/app/router.test.tsx` | 7 | Routing réel : accueil, catalogue public, **redirection effective des 5 routes privées vers `/login`**, 404, outil inconnu, navigation persistante |
| `src/features/tools/components/ToolErrorBoundary.test.tsx` | 4 | Confinement du crash, non-exposition du message technique, relance, réinitialisation au changement d'outil |
| `src/features/tools/registry/registry.test.ts` | 6 | Enregistrement, doublon de slug rejeté, format kebab-case, filtrage par catégorie, réconciliation avec le catalogue |
| `src/lib/errors/map-supabase-error.test.ts` | 4 | Mapping des codes Postgres, repli sur le statut HTTP, **non-divulgation du message brut** |
| `src/config/env.test.ts` | 4 | Rejet d'URL invalide, de clé manquante, valeur par défaut |
| `src/tools/_template/compute.test.ts` | 2 | §16 : la logique de calcul se teste **sans DOM ni React** |
| `src/pages/NotFoundPage.test.tsx` | 1 | Câblage RTL + routeur + providers |

### 7.2 Note d'honnêteté — un test flaky détecté et corrigé

Lors de la vérification finale, un test a échoué une fois puis passé. Cause
réelle identifiée : le test « protège toutes les routes privées » utilisait une
boucle empilant quatre applications dans le même document sans nettoyage
intermédiaire, en concurrence CPU avec le serveur de développement resté actif.

Corrigé via `it.each` (nettoyage automatique entre les cas) et arrêt du serveur.
**Trois exécutions consécutives ont ensuite confirmé la stabilité** — le résultat
n'est pas rapporté sur la foi d'un tirage chanceux.

### 7.3 Vérification du routing — pourquoi les codes HTTP ne suffisaient pas

Une première vérification a interrogé le serveur de développement :

```
/                  200      /login             200
/tools             200      /references        200
/dashboard         200      /tools/inconnu     200
                            /page-inexistante  200
```

**Ces 200 ne prouvent rien** : une SPA renvoie `index.html` pour toute URL. Le
routing est côté client.

L'arbre de routes a donc été extrait dans un export `routes`, ce qui permet aux
tests de reconstruire un routeur mémoire à partir des **mêmes définitions que la
production**. Les 7 tests de `router.test.tsx` observent le comportement réel,
y compris `router.state.location.pathname === '/login'` après tentative d'accès
à une route privée, avec conservation de l'origine dans `location.state.from`.

### 7.4 Code splitting — confirmé par le build

19 chunks de route distincts :

```
index-D43mGYq7.js              598,6 ko   ← bundle initial
ToolsPage-DuEzLUwS.js            1,1 ko
ToolDetailPage-Blymq2Zv.js       1,1 ko
tools-DH1oZ4TV.js                0,8 ko
HomePage-CnbEhtnA.js             0,7 ko
NotFoundPage-r9Ncl6W6.js         0,6 ko
PagePlaceholder-CsIbUuDC.js      0,5 ko
LoginPage / RegisterPage / ForgotPasswordPage / AuthCallbackPage
CategoryPage / ReferencesPage / DashboardPage / FavoritesPage
ProfilePage / HistoryPage / SettingsPage            ← 0,2 à 0,3 ko chacun
```

---

## 8. Décision OneDrive / node_modules

**Décision : épinglage local, pas de jonction.** Voir §0.6 pour le détail du test
qui a invalidé la jonction.

| | Jonction NTFS | Épinglage `attrib +P` |
|---|---|---|
| Sort node_modules de la synchronisation | Oui | Non |
| Empêche la déshydratation (le vrai risque) | Oui | **Oui** |
| **Survit à `npm install`** | **Non** | **Oui** |

Le volume synchronisé reste un inconvénient de performance assumé. La corruption
de build, elle, est écartée. Documenté dans `README.md` et dans l'en-tête du
script.

---

## 9. Playwright — pourquoi il n'est pas installé

`playwright.config.ts` et `e2e/smoke.spec.ts` sont **écrits**, avec deux profils
(Desktop Chrome et Pixel 7 — le responsive est traité comme une contrainte
d'architecture, pas une finition). Le paquet n'est **pas installé**.

Raison : Playwright télécharge environ 500 Mo de navigateurs, et la Phase 1 ne
contient aucun parcours utilisateur réel — les pages sont des coquilles
destinées à valider le routing. Installer maintenant reviendrait à immobiliser
de l'espace disque (sur 25,6 Go libres) pour vérifier des écrans appelés à
changer intégralement en Phase 2.

Activation :

```bash
npm install -D @playwright/test
npx playwright install chromium
npx playwright test
```

Retirer alors les exclusions de `e2e/` et `playwright.config.ts` dans
`tsconfig.node.json` et `eslint.config.js`.

---

## 10. État Git

```
Commit  : 8326d5e  feat: fondations Phase 1 de NexoraTech
Branche : main
Fichiers: 90
Statut  : arbre de travail propre
```

Audit de sécurité effectué **avant** le commit :

```
=== .env.local est-il bien ignoré ? ===
.gitignore:11:.env.*    .env.local            ✅

=== node_modules bien ignoré ? ===
.gitignore:2:node_modules/    node_modules/react/package.json    ✅

=== Contrôle : .env / secrets / node_modules indexés ? ===
OK — aucun .env, secret, node_modules, dist ou coverage indexé.
```

`.gitignore` couvre `.env.*` avec l'exception explicite `!.env.example`.
`.gitattributes` normalise les fins de ligne en LF (dépôt développé sous Windows,
susceptible d'être cloné ailleurs).

---

## 11. Problèmes restants

1. **Bundle initial de 598,6 ko (179 ko gzip).** Le build en avertit. Cause :
   React, React Router, Supabase et TanStack Query sont tous requis au démarrage,
   la session étant résolue avant le premier rendu. Le découpage par route
   fonctionne et est vérifié ; un découpage vendor améliorerait le **cache** sans
   réduire le poids total. Non fait : c'est une optimisation à mesurer, pas à
   supposer.

2. **Aucun projet Supabase provisionné.** C'est le seul prérequis bloquant pour
   la Phase 2. `src/types/database.ts` est écrit à la main en correspondance
   exacte avec les migrations ; à régénérer via
   `npx supabase gen types typescript --project-id <ref>` une fois le projet créé.

3. **`.env.local` contient des valeurs factices**
   (`https://placeholder-a-remplacer.supabase.co`) mises pour vérifier le
   démarrage réel. À remplacer par les vraies valeurs.

4. **Playwright non installé** — voir §9.

5. **`C:\dev-modules`** — dossier vide résiduel de la jonction abandonnée. Le
   sandbox a bloqué sa suppression. Sans conséquence, supprimable manuellement.

6. **TypeScript 7 en attente.** À adopter dès que `typescript-eslint` élargit son
   peer range — le portage natif Go apporte un gain de vitesse notable au
   typecheck.

---

## 12. Recommandations pour la Phase 2

**Prérequis bloquant** — provisionner le projet Supabase et appliquer les quatre
migrations. Rien d'autre ne peut être validé de bout en bout sans cela.

Ordre suggéré ensuite :

1. **Design System** — les tokens `@theme` de `src/styles/index.css` et
   `class-variance-authority` sont en place et attendent d'être remplis. Traiter
   le mode sombre à ce moment-là, pas après : `color-scheme` est déjà déclaré.

2. **Formulaires d'authentification** — c'est le moment d'ajouter
   `react-hook-form` + `@hookform/resolvers`, délibérément écartés en Phase 1.
   Les schémas zod et la couche `auth.api.ts` sont prêts ; il ne reste que l'UI.
   Traiter aussi `/auth/callback`, qui reçoit les liens e-mail.

3. **Activer Playwright** sur des parcours réels — inscription, connexion,
   déconnexion, accès à une route privée.

4. **Premier outil** — copier `src/tools/_template/` pour valider le système
   modulaire de bout en bout. La loi d'Ohm est un bon candidat : calcul simple,
   entièrement testable dans `compute.ts`, et suffisant pour éprouver la chaîne
   registry → catalogue → réconciliation avec la table `tools`.

5. **Intégration continue** — un workflow GitHub Actions exécutant
   `typecheck` + `lint` + `test` + `build` figerait les garanties de cette phase.
   Non fait en Phase 1 : aucun remote Git n'existe encore.

---

**PHASE 1 — READY FOR REVIEW**

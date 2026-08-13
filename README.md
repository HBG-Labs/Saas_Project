# NexoraTech

Plateforme SaaS de boîte à outils technique destinée aux techniciens,
ingénieurs et étudiants techniques : fibre optique, réseaux, électricité et
calculs généraux.

> **État : Phase 1 — fondations.** L'architecture, le routing, l'authentification
> et le système modulaire d'outils sont en place. Aucun outil métier n'est encore
> développé : c'est l'objet des phases suivantes.

## Démarrage

```bash
npm install
cp .env.example .env.local     # PowerShell : Copy-Item .env.example .env.local
# renseigner VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

L'application démarre sur http://localhost:5173.

Les migrations de base de données s'appliquent séparément : voir
[`supabase/README.md`](supabase/README.md).

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Typecheck puis build de production |
| `npm run preview` | Sert le build de production |
| `npm run typecheck` | TypeScript seul |
| `npm run lint` | ESLint (inclut les règles d'architecture) |
| `npm run lint:fix` | ESLint avec corrections automatiques |
| `npm run format` | Prettier — écriture |
| `npm run format:check` | Prettier — vérification |
| `npm run test` | Tests unitaires et d'intégration |
| `npm run test:watch` | Tests en mode surveillance |
| `npm run test:coverage` | Tests avec couverture |
| `npm run smoke` | Rejoue toutes les requêtes Supabase de l'app contre la vraie base (lecture seule) |
| `npm run smoke:writes` | Idem, plus les écritures, dans une organisation jetable auto-supprimée |
| `npm run protect:node-modules` | Protection OneDrive (voir plus bas) |

## Variables d'environnement

Définies dans `.env.local`, jamais versionné. Modèle : `.env.example`.

| Variable | Rôle |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique (`sb_publishable_…` ou clé `anon` legacy) |
| `VITE_APP_ENV` | `development` \| `staging` \| `production` |

Elles sont validées par Zod au démarrage : une variable manquante ou mal formée
provoque un échec immédiat et explicite, plutôt qu'un `undefined` silencieux.

> **Ne jamais placer `SUPABASE_SERVICE_ROLE_KEY` dans ce projet.** Cette clé
> contourne la Row Level Security et n'a sa place que côté serveur. Vite
> n'expose au navigateur que les variables préfixées `VITE_`.

## Déploiement

L'application est un frontend statique : `vercel.json` est versionné, et le seul
travail restant est de renseigner les trois variables ci-dessus dans Vercel puis
d'autoriser le domaine dans Supabase Auth.

Procédure complète, réglages Supabase compris :
[`docs/DEPLOIEMENT-VERCEL.md`](docs/DEPLOIEMENT-VERCEL.md).

> Les migrations ne partent PAS avec le déploiement. Elles s'appliquent
> séparément par `npx supabase db push --linked`, et doivent précéder la mise en
> ligne du frontend qui en dépend.

## Architecture

Voir [`ARCHITECTURE.md`](ARCHITECTURE.md) — couches, frontières appliquées par
ESLint, système modulaire d'outils, isolation des pannes.

Pour ajouter un outil : [`src/tools/README.md`](src/tools/README.md).

## Tests

```bash
npm run test
```

Vitest + Testing Library, environnement jsdom. Les tests d'amorçage couvrent
le mapping des erreurs Supabase, la validation d'environnement, le registry
d'outils, l'isolation des pannes et le routing réel (y compris la protection des
routes privées).

### End-to-end

Playwright est **configuré mais volontairement non installé** en Phase 1 :
il télécharge ~500 Mo de navigateurs alors qu'aucun parcours utilisateur réel
n'existe encore (les pages sont des coquilles).

Activation en Phase 2 :

```bash
npm install -D @playwright/test
npx playwright install chromium
npx playwright test
```

Retirer alors les exclusions de `e2e/` et `playwright.config.ts` dans
`tsconfig.node.json` et `eslint.config.js`.

## Note OneDrive

Le projet est hébergé dans OneDrive avec **Files On-Demand actif**. Le risque
n'est pas le volume synchronisé — gênant mais bénin — c'est la
**déshydratation** : OneDrive peut transformer un fichier de `node_modules` en
placeholder cloud, et Node échoue alors en `EIO`/`ENOENT` au milieu d'un build.

```bash
npm run protect:node-modules   # à relancer après chaque npm install
```

Ce script épingle `node_modules` en local (attribut `+P`), ce qui interdit à
OneDrive de le déshydrater.

**Approche écartée — jonction NTFS.** Déplacer `node_modules` hors de OneDrive
via une jonction a été testé et échoue : npm 11 supprime le lien au début de
chaque installation (`npm warn reify Removing non-directory … node_modules`) et
recrée un dossier réel. La mitigation ne survivait donc pas à `npm install`.

## Stack

| | Version |
|---|---|
| React | 19.2.8 |
| TypeScript | 6.0.3 |
| Vite | 8.2.1 |
| Tailwind CSS | 4.3.3 |
| React Router | 8.3.0 |
| Supabase JS | 2.112.2 |
| TanStack Query | 5.101.4 |
| Zod | 4.4.3 |
| Vitest | 4.1.10 |
| ESLint | 9.39.5 |

Deux versions sont délibérément en retrait de `latest`, pour cause
d'incompatibilité vérifiée sur le registre :

- **TypeScript 6.0.3** (et non 7.0.2) — `typescript-eslint@8.66.0` exige
  `typescript <6.1.0`. TypeScript 7 casserait le lint type-aware. Vite ne
  typecheckant pas, le build n'est pas affecté.
- **ESLint 9.39.5** (et non 10.8.0) — `eslint-plugin-jsx-a11y@6.10.2` plafonne à
  `eslint ^9`.

Ces deux choix évitent tout `--legacy-peer-deps` ou `overrides`.

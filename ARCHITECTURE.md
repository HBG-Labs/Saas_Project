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
│  ├─ layout/      RootLayout, PublicLayout, AppLayout, Sidebar, MobileNav
│  ├─ marketing/   sections de la landing (Hero, Pricing, Faq…)
│  └─ feedback/    ErrorBoundary, ErrorFallback, LoadingScreen, PagePlaceholder
├─ features/
│  ├─ auth/        session, garde de routes, API d'authentification
│  ├─ tools/       registry (moteur du catalogue) + ToolErrorBoundary
│  ├─ theme/       thème clair/sombre, persistance
│  ├─ search/      palette de commandes ⌘K
│  ├─ history/     historique de calculs (local, à migrer vers Supabase)
│  ├─ catalog/     lecture serveur du catalogue
│  └─ organizations/ teams/ missions/ interventions/ billing/ audit/
│                 module professionnel multi-tenant — couche `api/` uniquement
│                 à ce stade, les hooks et écrans arrivent en Phase 2 et suivantes
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

## Le module professionnel (multi-tenant)

NexoraTech comporte deux produits dans une même application :

| | Catalogue d'outils | Module professionnel |
|---|---|---|
| Cloisonnement | par utilisateur | **par organisation** |
| Accès | compte, ou anonyme | abonnement `business` **et** appartenance |
| Autorisation | propriétaire de la ligne | RBAC à 6 rôles |
| Source de vérité | registry en mémoire + `tools` | PostgreSQL exclusivement |

### Pourquoi tout se joue dans la base

L'application n'a **pas de serveur applicatif**. Il n'existe aucune couche où
placer une vérification que le client ne pourrait pas contourner : une règle
métier écrite en TypeScript s'exécute dans le navigateur de l'utilisateur, donc
sous son contrôle.

Toute règle critique — isolation entre entreprises, séparation des pouvoirs,
quotas d'abonnement — vit donc dans PostgreSQL, sous forme de policies RLS et de
triggers. Voir [`supabase/README.md`](supabase/README.md) pour le détail.

### Les miroirs TypeScript

Trois modules reflètent des tables SQL :

| Module | Reflète | Sert à |
|---|---|---|
| `features/organizations/rbac.ts` | `role_permissions` | masquer les actions interdites |
| `features/missions/workflow.ts` | `mission_status_transitions` | n'afficher que les transitions possibles |
| `features/billing/entitlements.ts` | `plan_features` | expliquer ce qu'un plan débloque |

**Aucun ne sécurise quoi que ce soit.** Ils évitent un aller-retour réseau et un
message d'erreur, rien de plus.

Le danger d'un miroir est qu'il diverge et réponde faux avec assurance. Chacun
est donc accompagné d'un test qui lit le fichier de migration et compare paire
par paire : modifier l'un sans l'autre casse `npm test`. C'est la même approche
que les frontières d'architecture appliquées par ESLint — une convention non
outillée finit toujours par être contournée.

### Source unique des catégories

`src/config/categories.ts` est la seule déclaration des huit domaines
techniques. `registry/types.ts` et `catalog-metadata.ts` en dérivent, le seed SQL
en est la contrepartie vérifiée par test. Ajouter une catégorie ne touche qu'un
fichier.

## Une policy raisonne par LIGNE, jamais par COLONNE

C'est la leçon la plus coûteuse de ce projet, et elle explique cinq des huit
failles qui ont été trouvées et fermées. Elle mérite d'être lue avant d'écrire la
moindre policy.

Une policy RLS décide si une LIGNE est accessible. Elle ne sait pas dire « cette
personne peut modifier ce champ mais pas cet autre ». Dès qu'on ouvre l'écriture
à quelqu'un pour un motif légitime — le technicien doit faire avancer le statut
de sa mission — on la lui ouvre **sur toutes les colonnes**.

Les cas rencontrés, tous mesurés sur la base avant correction :

| Ce qui était permis | Pourquoi |
|---|---|
| Un technicien réécrivait l'intitulé de sa mission et changeait son client | ouverture accordée pour le statut |
| Un technicien antidatait ses heures de six heures | ouverture accordée pour terminer l'intervention |
| Un contrôleur réécrivait le compte rendu du technicien, puis le validait | ouverture accordée pour approuver |
| Une équipe changeait d'entreprise | `WITH CHECK` plus faible que `USING` |
| Voir un client suffisait à lui ajouter contacts et sites | `FOR ALL` : le `USING` n'est **pas** évalué à l'INSERT |

Deux règles en découlent.

**Un `WITH CHECK` doit être au moins aussi fort que son `USING`.** Le premier
s'applique à la ligne APRÈS écriture, le second à la ligne AVANT. Les écrire
différemment, c'est autoriser une transformation qu'aucun des deux ne décrit.

**Ce qu'une policy ne sait pas exprimer, un trigger le sait.** Comparer `OLD` et
`NEW`, colonne par colonne, est précisément son rôle. Chaque fois qu'une règle
porte sur un CHANGEMENT plutôt que sur un état, elle appartient à un trigger :

```
app.enforce_organization_immutable()    une entité ne change pas d'entreprise
app.enforce_mission_assignee_scope()    l'intervenant fait avancer, il ne redéfinit pas
app.enforce_intervention_scope()        le serveur horodate, jamais le client
app.enforce_report_authorship()         qui contrôle n'écrit pas ; un CR validé est définitif
```

**Corollaire pour les tests.** Le refus n'a pas toujours la même forme. Quand la
ligne est visible en écriture, le trigger lève une exception. Quand la policy
l'exclut, l'UPDATE ne touche aucune ligne et ne lève rien. Une assertion portant
sur l'exception passerait à côté du second cas : **tester le résultat, pas la
manière dont il est obtenu.**

## Choix explicitement écartés

| Écarté | Raison |
|---|---|
| Zustand / Redux | Le server state est couvert par TanStack Query, la session par un contexte, le reste est local. À reconsidérer si un état UI non-serveur doit être partagé entre branches éloignées de l'arbre. |
| `manualChunks` | Le découpage par route suffit et est vérifié. Un découpage vendor est une optimisation de cache à mesurer, pas à supposer. |
| ~~`react-hook-form`~~ | **Adopté depuis la Phase 3.** Il porte tous les formulaires métier, avec Zod comme résolveur. |
| `eslint-plugin-boundaries` | `no-restricted-imports` couvre le besoin sans dépendance supplémentaire. |
| Tables `tool_configurations` / `references` | Leur schéma dépend d'un usage qui n'existe pas encore. |

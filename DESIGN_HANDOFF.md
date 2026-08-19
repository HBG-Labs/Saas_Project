# DESIGN_HANDOFF — REZO360

> **Destinataire : Gemini.** Ce document est l'inventaire complet de l'application au
> 9 août 2026, état `57d5d1b`, branche `phase-2/application-foundation`.
>
> Il est écrit pour être lu **en entier avant de dessiner quoi que ce soit**. Chaque
> chiffre a été relevé dans le code, pas estimé.

---

## ⚠️ À LIRE EN PREMIER — la frontière

REZO360 a un backend fini et prouvé : 28 migrations appliquées, 26 tables, des policies
RLS et des triggers PostgreSQL, 171 tests automatisés, **huit failles de sécurité trouvées
et fermées**, chacune mesurée sur la base avant et après correction.

Le partage des responsabilités est le suivant :

- **Gemini tient le visuel** — apparence, mise en page, hiérarchie de l'information,
  responsive.
- **Claude tient le métier** — Supabase, sécurité, API, permissions, machine à états.

### Ce que vous POUVEZ modifier

| Périmètre | Portée |
|---|---|
| `src/styles/index.css` | **Tokens compris.** Palette OKLCH claire et sombre, typographie, rayons, ombres, effets « Cockpit ». L'identité chromatique vous appartient. |
| `src/pages/**` | Mise en page, hiérarchie de l'information, classes Tailwind, structure du JSX de présentation. |
| `src/features/*/components/**` | Apparence et disposition des composants métier. |
| `src/components/layout/**` | Ossature, barre latérale, navigation basse, en-tête — leur **rendu**. |

### Ce que vous ne devez PAS modifier

| Périmètre | Pourquoi |
|---|---|
| `supabase/**` | Policies, triggers, migrations. Huit failles y ont été fermées et mesurées. |
| `src/features/*/api/**` | Requêtes et forme des données. |
| `src/features/*/hooks/**` | Cache TanStack Query, invalidations, mutations. |
| `rbac.ts`, `entitlements.ts`, `workflow.ts` | Miroirs TypeScript du SQL, vérifiés par des tests qui **lisent les fichiers de migration**. Les modifier casse `npm test`. |
| `src/components/ui/**` | Les 17 primitives portent l'accessibilité (Radix : piège de focus, `aria`, clavier ; cibles 44 px). Vous les **consommez**, vous ne les réécrivez pas. |
| `src/config/navigation.ts` | Mêle intitulés et métadonnées `permission` / `feature`. Une entrée mal étiquetée masque une section à qui y a droit — ou la révèle à qui n'y a pas droit. |
| Landing et marketing | `src/pages/LandingPage.tsx`, `src/components/marketing/*`, `src/assets/`, `src/components/dashboard/TechnicianHeroBanner.tsx`. Travail non commité du propriétaire du projet, explicitement préservé. |

### La conséquence, en une phrase

**Vous refondez l'identité par les _tokens_, et la disposition par les _pages_.**

Si vous voulez renommer une section de menu, changer l'ordre du menu, modifier une
primitive de `components/ui/`, ou toucher au marketing : **proposez-le, ne le faites pas.**
Format attendu :

```
DEMANDE À CLAUDE — <fichier concerné>
Ce que je veux :   …
Pourquoi :         …
Impact supposé :   … (métier ? sécurité ? aucun ?)
```

### Documents complémentaires (à ouvrir, pas à ignorer)

| Fichier | Contenu | Quand le lire |
|---|---|---|
| `docs/DESIGN_SYSTEM.md` | 11 sections. Justification de **chaque** valeur du design system : pourquoi OKLCH, pourquoi 14 px, pourquoi ces contrastes. | Avant toute refonte chromatique ou typographique. |
| `ARCHITECTURE.md` | Principe directeur, arborescence, système modulaire d'outils, isolation des pannes, **« une policy raisonne par LIGNE, jamais par COLONNE »**. | Avant de toucher à la structure d'une page. |
| `DESIGN_INVENTORY.md` | Audit daté + rapport de ce qui en a été fait. Trace historique. | Pour comprendre d'où vient l'état actuel. |

---

## 1. Vue d'ensemble REZO360

### Ce que c'est

Un **SaaS multi-tenant en français** pour les entreprises d'intervention technique de
terrain : fibre optique, réseaux, électricité, télécoms.

L'application contient **deux produits dans une seule interface** :

**① Le catalogue d'outils — public.**
Six calculatrices et outils techniques métier, consultables sans compte. C'est la porte
d'entrée du produit et son acquisition.

**② Le module professionnel — réservé au plan `business`.**
Le cycle complet d'une intervention : client → site → mission → affectation → intervention
chronométrée → compte rendu photographié → contrôle → validation → clôture, le tout tracé
dans un journal d'audit inaltérable.

### Les deux publics, et ce qu'ils viennent y faire

| Public | Ce qu'il ouvre l'application pour faire | Contexte d'usage |
|---|---|---|
| **Technicien de terrain** | Savoir ce qu'il a à faire aujourd'hui, pointer ses heures, photographier, rédiger son compte rendu. | **Téléphone, sur un chantier.** Une main occupée, parfois des gants, réseau incertain, plein soleil ou local sombre. |
| **Responsable / dirigeant** | Savoir ce qui l'attend : comptes rendus à contrôler, missions qui traînent, quota de membres. Piloter le portefeuille client. | Ordinateur de bureau, session longue, densité d'information élevée. |
| **Visiteur** | Comparer des offres, essayer une calculatrice. | Indifférent. |

**Conséquence de conception, non négociable :** ce ne sont pas deux mises en page du même
écran, ce sont deux besoins différents. Un technicien qui doit chercher son travail du jour
dans un tableau de bord de directeur ne l'utilisera pas.

### Positionnement visuel actuel

L'identité s'appelle en interne le **« Cockpit numérique »** : outil de travail dense,
sombre par défaut sur le terrain, chiffres en police monospace tabulaire, accents
lumineux bleu/cyan. Ni SaaS pastel, ni tableau de bord ludique. Voir §19.

### Stack

React 19.2 · TypeScript 6.0 (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) ·
Vite 8.2 · Tailwind CSS 4.3 · TanStack Query 5 · React Hook Form + Zod · Radix UI ·
Supabase (PostgreSQL 17.6) · react-router 7.

---

## 2. Architecture

### 2.1 Arborescence de `src/`

```
src/
├── app/                    Composition racine
│   ├── App.tsx             RouterProvider
│   ├── providers.tsx       4 providers, ordre significatif (§2.3)
│   └── router.tsx          Arbre de routes, 3 ossatures (§4)
│
├── config/                 Couche la plus BASSE — ne dépend d'aucune feature
│   ├── routes.ts           33 chemins. Aucune URL en dur ailleurs.
│   ├── navigation.ts       Entrées de menu + métadonnées d'accès  ⛔ NE PAS MODIFIER
│   ├── categories.ts       8 catégories métier — source unique
│   ├── pricing.ts          Grille tarifaire marketing
│   └── env.ts              Variables d'environnement validées
│
├── components/
│   ├── ui/                 17 primitives Radix + CVA          ⛔ NE PAS MODIFIER
│   ├── feedback/           EmptyState, ErrorState, FormError, LoadingScreen…
│   ├── layout/             AppLayout, PublicLayout, RootLayout, Sidebar, MobileNav
│   ├── guards/             RequireOrganization, RequirePermission, RequirePlan
│   ├── marketing/          14 composants de landing            ⛔ NE PAS MODIFIER
│   └── dashboard/          TechnicianHeroBanner (WIP propriétaire) ⛔ NE PAS MODIFIER
│
├── features/               13 features, découpage vertical
│   └── <nom>/
│       ├── api/            Requêtes Supabase                   ⛔
│       ├── hooks/          TanStack Query                      ⛔
│       ├── components/     Composants métier                   ✅ apparence
│       ├── schemas/        Validation Zod                      ⛔
│       └── index.ts        API PUBLIQUE — seul point d'entrée
│
├── pages/                  35 pages, une par route             ✅
├── tools/                  6 outils de calcul + gabarit
├── services/supabase/      Client unique + helpers d'erreur
├── lib/                    cn, format, errors, query-keys, query-client
├── types/                  database.ts (miroir SQL) · domain.ts
└── styles/index.css        TOKENS                              ✅ vous pouvez tout y changer
```

### 2.2 La règle d'architecture, imposée par ESLint

```
api/  →  hooks/  →  components/          jamais l'inverse
```

Et entre features : **on importe par `@/features/<nom>`, jamais par un fichier interne.**
`eslint.config.js` refuse `@/features/*/*`. Une primitive de `components/ui/` ne peut
importer **aucune** feature.

**Ce que cela signifie pour vous :** si vous déplacez du JSX d'une page vers un composant,
il doit vivre soit dans `pages/`, soit dans `features/<nom>/components/`, et importer les
autres features par leur `index.ts`. Sinon `npm run lint` échoue.

### 2.3 Providers — l'ordre est significatif

```tsx
<ErrorBoundary>            {/* capture même une panne des providers */}
  <ThemeProvider>          {/* l'écran d'erreur doit être dans le bon thème */}
    <QueryClientProvider>  {/* l'auth va déclencher des requêtes */}
      <AuthProvider>       {/* la session avant le routeur */}
        <OrganizationProvider>  {/* dépend des deux précédents */}
```

Le thème est appliqué **avant le premier rendu** par `theme-script.ts` (script bloquant
dans `index.html`) : aucun flash blanc au chargement en mode sombre. Ne le supprimez pas.

### 2.4 Trois ossatures, pas une

| Ossature | Ce qu'elle héberge | Densité |
|---|---|---|
| `RootLayout` | Sans interface propre. Palette de commandes ⌘K (dans le routeur car elle utilise `useNavigate`). | — |
| `PublicLayout` | Landing, tarifs, FAQ, authentification. En-tête marketing, pied de page. | **16 px** |
| `AppLayout` | Application connectée **et catalogue public**. Barre latérale, navigation basse mobile, en-tête applicatif. | **14 px** |

Le catalogue d'outils est dans `AppLayout` bien qu'il soit public : un visiteur qui
explore les outils est déjà dans le produit, pas dans la vitrine. L'en-tête s'adapte donc
à l'état d'authentification (avatar + menu, ou boutons Connexion / Créer un compte).

### 2.5 TanStack Query

Toutes les clés passent par une fabrique centrale, `src/lib/query-keys.ts` (`qk`). Aucune
clé écrite à la main. Les invalidations en dépendent — un `queryKey` inventé casse
silencieusement la mise à jour d'un écran après une mutation.

**Chaque hook de liste expose `isPending`, `isError`, `error`, `refetch`, `data`.** Les
trois états qui en découlent sont obligatoires à l'écran (§23).

---
## 3. Fonctionnalités — inventaire opérationnel

Les **34** fonctionnalités développées depuis la Phase 0 — la liste du brief, éclatée là où
un intitulé en recouvrait deux. **Colonne « État » :** ✅ complet ·
🟡 partiel · ⚪ non implémenté (assumé).

Légende d'accès — `perm` = permission RBAC exigée · `plan` = fonctionnalité d'abonnement
exigée · `assigné` = réservé à l'intervenant de la mission.

| # | Fonctionnalité | Route | Accès | Actions possibles | États à représenter | Composants existants | État |
|---|---|---|---|---|---|---|---|
| 1 | Catalogue d'outils | `/tools` | public | rechercher, filtrer par catégorie, ouvrir | empty | `ToolCard`, `CategoryCard`, `ToolCardSkeleton` | ✅ |
| 2 | Fiche outil + calculatrice | `/tools/:slug` | public (`visibility` par outil) | saisir, calculer, mettre en favori, consulter la doc | loading, empty | `ToolErrorBoundary`, `Input`, `Select`, `StatCard` | ✅ |
| 3 | Catégories | `/categories/:slug` | public | parcourir les outils d'un domaine | empty | `CategoryCard`, `ToolCard` | ✅ |
| 4 | Favoris | `/favorites` | authentifié · quota `free` = 3 | retirer, ouvrir | loading, error, empty | `ToolCard`, `ListSkeleton` | ✅ |
| 5 | Historique d'outils | `/history` | authentifié · quota `free` = 10 | ouvrir, effacer | loading, error, empty | `ActivityTimeline`, `HistoryUpgradeBanner` | ✅ |
| 6 | Authentification | `/login` `/register` `/forgot-password` | public non connecté | s'inscrire, se connecter, réinitialiser | error de formulaire | `AuthCard`, `FormError`, `Input` | ✅ |
| 7 | Retour de lien e-mail | `/auth/callback` | indifférent | — (redirection) | loading | `LoadingScreen` | ✅ |
| 8 | Landing / tarifs / FAQ / fonctionnalités | `/` `/pricing` `/faq` `/features` | public | — | — | 14 composants `marketing/` ⛔ | ✅ |
| 9 | Création d'entreprise | `/organisation/nouvelle` | authentifié, **hors** `RequireOrganization` | créer (nom + slug suggéré) | error de formulaire | `Input`, `FormError` | ✅ |
| 10 | Changement d'organisation | menu avatar (partout) | multi-appartenance | basculer | loading | `OrganizationSwitcher` (dans `Dropdown`) | ✅ |
| 11 | Paramètres d'entreprise | `/organisation` | perm `organization.view` · écriture `organization.update` | renommer, modifier les coordonnées | loading, error | `Input`, `FormError`, `Card` | ✅ |
| 12 | Membres et rôles | `/organisation/membres` | perm `member.view` | changer un rôle, retirer, voir les équipes | loading, error, empty | `MemberRow`, `RoleSelect`, `RoleBadge`, `Avatar`, `Tooltip` | ✅ |
| 13 | Invitations | `/organisation/membres` | perm `member.invite` | inviter, copier le lien, révoquer | loading, error, empty | `InviteMemberDialog`, `InvitationLink`, `MemberQuotaBar` | ✅ |
| 14 | Acceptation d'invitation | `/invitations/:token` | authentifié, **hors** `RequireOrganization` | accepter | loading, empty (jeton invalide) | `LoadingScreen`, `EmptyState` | ✅ |
| 15 | Rôles et permissions | transverse | — | — | — | `RoleBadge`, `RoleSelect`, `usePermission` | ✅ |
| 16 | Abonnements / entitlements | `/organisation/facturation` | perm `billing.view` | consulter, comparer (lien externe) | loading, error | `MemberQuotaBar`, `Badge` | 🟡 |
| 17 | Clients | `/clients` `/clients/:id` | plan `customers` + perm `customer.view` ¹ | créer, modifier, archiver, **réactiver**, rechercher, filtrer actifs/archivés | loading, error, empty | `CustomerFormDialog`, `Card`, `Badge`, `Tabs` | ✅ |
| 18 | Contacts clients | onglet de `/clients/:id` | perm `customer.update` pour écrire | créer, **modifier**, supprimer, désigner principal | loading, error, empty | `ContactsPanel` | ✅ |
| 19 | Sites d'intervention | onglet de `/clients/:id` | idem | créer, **modifier**, archiver | loading, error, empty | `SitesPanel` | ✅ |
| 20 | Consignes d'accès | fiche site + fiche mission + fiche intervention | lecture large | saisir sur le site, lire partout | — | bloc `KeyRound` dédié (3 écrans) | ✅ |
| 21 | Équipes | `/equipes` `/equipes/:id` | plan `teams` + perm `team.view` | créer, modifier, archiver | loading, error, empty | `TeamFormDialog`, `Badge` (couleur d'équipe) | ✅ |
| 22 | Composition d'équipe et lead | `/equipes/:id` | perm `team.assign_member` **ou** être lead | ajouter, retirer, promouvoir/rétrograder lead | loading, error, empty | `TeamMembersPanel`, `TeamRoleBadge`, `TeamManagerBadge` | ✅ |
| 23 | Missions | `/missions` `/missions/nouvelle` `/missions/:id` | plan `missions` ² · création `mission.create` | créer, **modifier**, filtrer (6 critères), rechercher | loading, error, empty | `MissionFormFields`, `MissionEditDialog`, `MissionFiltersBar`, `MissionStatusBadge`, `MissionPriorityBadge` | ✅ |
| 24 | Machine à états de mission | `/missions/:id` | selon la transition (§11) | 17 transitions sur 10 états | — | `MissionTransitions` | ✅ |
| 25 | Affectation équipe / technicien | `/missions/:id` | perm `mission.assign` | affecter, réaffecter, retirer | error | `AssignMissionDialog` | ✅ |
| 26 | Historique d'affectation | `/missions/:id` | lecture large | consulter (acceptée / refusée + motif / retirée / en attente) | loading, empty | `Badge`, `ListSkeleton` | ✅ |
| 27 | Interventions et chronométrage | `/interventions/:id` | plan `interventions` · pointage : **assigné** | démarrer, pause, reprise, terminer (confirmé), noter | loading, error, empty | `InterventionTimer`, `MissionInterventionsPanel` | ✅ |
| 28 | Compte rendu + photos | `/interventions/:id/rapport` | auteur seul, tant que non validé | rédiger, enregistrer, joindre avant/après, soumettre | loading, error, empty | `AttachmentGallery`, `Textarea`, `FormError` | ✅ |
| 29 | Contrôle / validation / refus | `/controle` | plan `intervention_review` + perm `intervention.review` | valider, refuser en motivant (≥ 5 car.) | loading, error, empty | `Modal`, `Badge`, `Textarea` | ✅ |
| 30 | Tableau de bord | `/dashboard` | authentifié · bloc métier selon rôle + plan | consulter, naviguer | loading | `StatCard`, `ProfessionalSummary` | ✅ |
| 31 | Journal d'audit | `/journal` | plan `audit_log` + perm `audit.view` | filtrer par action et par objet | loading, error, empty | `Select`, `Badge`, `ListSkeleton` | ✅ |
| 32 | Profil | `/profile` | authentifié | (lecture seule) | — | `Avatar`, `Input` | 🟡 |
| 33 | Paramètres | `/settings` | authentifié | changer le thème | — | `Switch`, boutons de thème | 🟡 |
| 34 | Références techniques | `/references` | public | — | empty | `EmptyState` | ⚪ |

¹ **La LISTE exige `customer.view` ; la FICHE non.** Un technicien doit atteindre la fiche
du client chez qui il intervient — la policy `customers_select` l'y autorise par sa
seconde branche (via ses missions). Poser la permission sur la fiche lui fermerait une
porte que le serveur lui ouvre.

² **Les missions n'exigent AUCUNE permission de route.** Un technicien n'a pas
`mission.view_all` et doit pourtant atteindre ses propres missions ; la policy
`missions_select_scoped` les lui sert par ses branches « assigné » et « équipe ».

---

## 4. Routes — inventaire exhaustif

33 chemins déclarés dans `src/config/routes.ts`, tous câblés dans `src/app/router.tsx`,
plus un fourre-tout `*`. **Aucune route orpheline, aucune route cachée.**

Les gardes s'empilent de l'extérieur vers l'intérieur :
`ProtectedRoute` → `RequireOrganization` → `RequirePlan` → `RequirePermission`.

### 4.1 Public — `PublicLayout`

| Chemin | Page | Gardes | Objectif | État |
|---|---|---|---|---|
| `/` | `LandingPage` | — | Acquisition | ✅ ⛔ marketing |
| `/features` | `FeaturesPage` | — | Argumentaire | ✅ ⛔ |
| `/pricing` | `PricingPage` | — | Grille tarifaire | ✅ ⛔ |
| `/faq` | `FaqPage` | — | Objections | ✅ ⛔ |
| `/login` | `LoginPage` | `PublicOnlyRoute` | Connexion | ✅ |
| `/register` | `RegisterPage` | `PublicOnlyRoute` | Inscription | ✅ |
| `/forgot-password` | `ForgotPasswordPage` | `PublicOnlyRoute` | Réinitialisation | ✅ |
| `/auth/callback` | `AuthCallbackPage` | aucun (volontaire) | Retour de lien e-mail — doit fonctionner dans un navigateur sans session | ✅ |

### 4.2 Catalogue — `AppLayout`, public

| Chemin | Page | Gardes | Objectif | État |
|---|---|---|---|---|
| `/tools` | `ToolsPage` | — | Catalogue, recherche, filtre | ✅ |
| `/tools/:toolSlug` | `ToolDetailPage` | — | Outil de calcul | ✅ |
| `/categories/:categorySlug` | `CategoryPage` | — | Outils d'un domaine | ✅ |
| `/references` | `ReferencesPage` | — | Bibliothèque technique | ⚪ **état vide uniquement** |

### 4.3 Compte — `ProtectedRoute`

| Chemin | Page | Gardes | Objectif | État |
|---|---|---|---|---|
| `/dashboard` | `DashboardPage` | `ProtectedRoute` | Point d'entrée connecté | ✅ |
| `/favorites` | `FavoritesPage` | `ProtectedRoute` | Outils épinglés | ✅ |
| `/history` | `HistoryPage` | `ProtectedRoute` | Outils consultés | ✅ |
| `/profile` | `ProfilePage` | `ProtectedRoute` | Informations personnelles | 🟡 **bouton inerte** |
| `/settings` | `SettingsPage` | `ProtectedRoute` | Préférences | 🟡 **2 interrupteurs désactivés, suppression de compte désactivée** |

### 4.4 Entrée dans une organisation — hors `RequireOrganization`

| Chemin | Page | Gardes | Objectif | État |
|---|---|---|---|---|
| `/organisation/nouvelle` | `CreateOrganizationPage` | `ProtectedRoute` | Créer une entreprise | ✅ |
| `/invitations/:token` | `AcceptInvitationPage` | `ProtectedRoute` | Rejoindre une entreprise | ✅ |

**Ces deux routes sont volontairement hors du garde d'organisation** : ce sont précisément
les écrans destinés à qui n'en a pas encore. Les y placer produirait une boucle de
redirection.

### 4.5 Module professionnel — `RequireOrganization`

| Chemin | Page | Plan exigé | Permission exigée | État |
|---|---|---|---|---|
| `/clients` | `CustomersListPage` | `customers` | `customer.view` | ✅ |
| `/clients/:customerId` | `CustomerDetailPage` | `customers` | **aucune** (voir §3 note ¹) | ✅ |
| `/missions` | `MissionsListPage` | `missions` | **aucune** (voir note ²) | ✅ |
| `/missions/nouvelle` | `MissionCreatePage` | `missions` | `mission.create` | ✅ |
| `/missions/:missionId` | `MissionDetailPage` | `missions` | **aucune** | ✅ |
| `/interventions/:interventionId` | `InterventionPage` | `interventions` | **aucune** | ✅ |
| `/interventions/:interventionId/rapport` | `ReportEditorPage` | `interventions` | **aucune** (auteur seul en écriture) | ✅ |
| `/controle` | `ReviewQueuePage` | `interventions` | `intervention.review` | ✅ |
| `/equipes` | `TeamsListPage` | `teams` | `team.view` | ✅ |
| `/equipes/:teamId` | `TeamDetailPage` | `teams` | `team.view` ³ | ✅ |
| `/organisation` | `OrganizationSettingsPage` | — | aucune sur la route | ✅ |
| `/organisation/membres` | `MembersPage` | — | `member.view` | ✅ |
| `/organisation/facturation` | `BillingPage` | — | `billing.view` | 🟡 **lecture seule** |
| `/journal` | `AuditLogPage` | `audit_log` | `audit.view` | ✅ |

³ Contrairement aux clients, **la fiche d'équipe reste derrière `team.view`** : aucune
branche de la RLS n'ouvre une équipe à qui n'a pas cette permission.

### 4.6 Fourre-tout

| Chemin | Page | État |
|---|---|---|
| `*` | `NotFoundPage` | ✅ |

### 4.7 Routes dont l'interface est incomplète — à ne pas maquiller

| Route | Ce qui manque réellement |
|---|---|
| `/references` | La table n'existe pas en base. **Volontairement reportée** : sa forme dépend du type de contenu (texte, tableau, abaque, fichier), non arrêté. Il n'y a rien à brancher. |
| `/profile` | Le bouton « Enregistrer » n'appelle rien. La table `profiles` accepte pourtant l'écriture par son propriétaire. |
| `/settings` | Le thème fonctionne. Les deux interrupteurs et la suppression de compte sont `disabled`. |
| `/organisation/facturation` | Aucune action de paiement : `subscriptions` est fermée en écriture au client (sinon chacun s'attribuerait la formule Entreprise). Stripe = Phase 12. |

---

## 5. Navigation

### 5.1 Structure actuelle — `src/config/navigation.ts` ⛔

```
                Tableau de bord          (hors section : c'est le point de départ)

OPÉRATIONS      Missions · Contrôle
RESSOURCES      Clients · Équipes
ENTREPRISE      Paramètres · Membres · Facturation · Journal
OUTILS          Catalogue · Favoris · Historique · Références

COMPTE          Profil · Paramètres      (en bas, poussé par mt-auto)
```

L'ordre n'est pas décoratif : **les missions sont ce qu'un technicien ouvre dix fois par
jour, la facturation ce qu'un dirigeant ouvre une fois par mois.**

Chaque entrée porte, en plus de son intitulé et de son icône, deux métadonnées d'accès :

```ts
{ to, label, icon, primary?, permission?, feature? }
```

`useVisibleNavGroups()` filtre par rôle et par plan, **et retire les sections devenues
vides** — un intitulé « Ressources » sans entrée n'informe de rien et laisse croire à une
panne. Hors organisation, les trois premières sections disparaissent entièrement.

> ⛔ **Vous ne modifiez pas ce fichier.** Ni les intitulés, ni l'ordre, ni les icônes, ni
> — surtout — `permission` et `feature`. Vous restylez `Sidebar.tsx` et `MobileNav.tsx`
> autant que vous voulez ; le contenu du menu se demande.

### 5.2 Les trois modèles de navigation

| Largeur | Modèle |
|---|---|
| `< 768 px` | Barre supérieure (56 px, fixe) + **navigation basse fixe** + tiroir latéral (Radix Dialog, piège de focus) |
| `768 – 1023 px` | Barre supérieure + tiroir latéral. Navigation basse masquée (`md:hidden`). |
| `≥ 1024 px` | Barre supérieure + **barre latérale persistante** de 208 px (`w-52`) |

La barre latérale est rendue **deux fois** — une fixe pour le bureau, une dans le tiroir
pour le mobile. C'est volontaire : masquer un unique élément en CSS ne permettrait pas le
piège de focus du tiroir.

### 5.3 Navigation basse mobile

4 entrées maximum (`MOBILE_NAV`) : Tableau de bord · Catalogue · Favoris · Historique.
Au-delà, les cibles tactiles passent sous 44 px sur les téléphones étroits (WCAG 2.5.5).

Le rembourrage bas suit `env(safe-area-inset-bottom)` — sans quoi la barre passe sous
l'indicateur d'accueil iOS et la barre gestuelle Android.

**Elle est en bas et pas en haut** parce que sur un téléphone tenu à une main, le haut de
l'écran est hors d'atteinte du pouce.

### 5.4 Palette de commandes ⌘K / Ctrl+K

`CommandBar` (cmdk dans un Radix Dialog). Sert : les 6 outils avec leurs mots-clés, les
8 catégories, et **toutes les destinations visibles** (racine + sections filtrées +
compte). Le déclencheur dans l'en-tête est un `<button>`, pas un `<input>` : un vrai champ
ouvrirait le clavier virtuel avant la palette, produisant un double saut sur téléphone.

### 5.5 Le manque connu

**Aucune entrée ne mène aux interventions en cours.** On y accède uniquement par une
mission. C'est cohérent pour un technicien qui part de son travail du jour ; un responsable
n'a en revanche aucun moyen de voir l'ensemble des interventions en cours. Voir §22 et §24.

---
## 6. Rôles et permissions

### 6.1 Les six rôles

| Rôle | Libellé affiché | En une phrase |
|---|---|---|
| `owner` | Propriétaire | Contrôle total, y compris facturation et suppression de l'entreprise. |
| `admin` | Administrateur | Gestion des membres, des équipes et des missions. |
| `manager` | Responsable | Pilotage des équipes, des missions, contrôle des comptes rendus. |
| `team_leader` | Chef d'équipe | Pilotage de ses propres équipes et suivi de leurs missions. |
| `technician` | Technicien | **Ses** missions et **ses** interventions, rien d'autre. |
| `employee` | Employé | Consultation restreinte. |

### 6.2 Matrice complète — 6 rôles × 28 permissions

Source : `src/features/organizations/rbac.ts`, miroir vérifié par test du seed
`20260808100100_rbac.sql`.

| Permission | owner | admin | manager | team_leader | technician | employee |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `organization.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `organization.update` | ✅ | ✅ | — | — | — | — |
| `organization.delete` | ✅ | — | — | — | — | — |
| `billing.view` | ✅ | ✅ | — | — | — | — |
| `billing.manage` | ✅ | — | — | — | — | — |
| `member.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `member.invite` | ✅ | ✅ | — | — | — | — |
| `member.update_role` | ✅ | ✅ | — | — | — | — |
| `member.remove` | ✅ | ✅ | — | — | — | — |
| `team.view` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `team.create` | ✅ | ✅ | ✅ | — | — | — |
| `team.update` | ✅ | ✅ | ✅ | — | — | — |
| `team.delete` | ✅ | ✅ | — | — | — | — |
| `team.assign_member` | ✅ | ✅ | ✅ | ✅ | — | — |
| `customer.view` | ✅ | ✅ | ✅ | ✅ | — | — |
| `customer.create` | ✅ | ✅ | ✅ | — | — | — |
| `customer.update` | ✅ | ✅ | ✅ | — | — | — |
| `customer.delete` | ✅ | ✅ | — | — | — | — |
| `mission.view_all` | ✅ | ✅ | ✅ | — | — | — |
| `mission.create` | ✅ | ✅ | ✅ | ✅ | — | — |
| `mission.update` | ✅ | ✅ | ✅ | ✅ | — | — |
| `mission.delete` | ✅ | ✅ | — | — | — | — |
| `mission.assign` | ✅ | ✅ | ✅ | ✅ | — | — |
| `mission.cancel` | ✅ | ✅ | ✅ | — | — | — |
| `intervention.view_all` | ✅ | ✅ | ✅ | — | — | — |
| `intervention.review` | ✅ | ✅ | ✅ | ✅ | — | — |
| `audit.view` | ✅ | ✅ | — | — | — | — |
| `statistics.view` | ✅ | ✅ | ✅ | ✅ | — | — |

### 6.3 Ce qu'un TECHNICIEN voit, comparé à un RESPONSABLE

**C'est la section la plus importante du document pour la conception.** Un technicien ne
possède que trois permissions. Il accède pourtant à l'essentiel du produit — par les
branches des policies, pas par le RBAC.

| Écran | Technicien | Responsable (`manager`) |
|---|---|---|
| **Menu latéral** | Tableau de bord · **Missions** · Outils · Favoris · Historique · Références · Paramètres entreprise · Membres | Tout, sauf Facturation et Journal (réservés `owner`/`admin`) |
| **Tableau de bord** | Ses missions en cours (5 max). Pas de tuile « À contrôler ». | Missions en cours + **À contrôler** (mis en évidence si > 0) + quota Membres |
| **Missions — liste** | Uniquement les siennes (nommément affecté **ou** membre de l'équipe affectée). Recherche + statut seulement. | Toutes. **Filtres avancés** : client, équipe, intervenant, période. |
| **Mission — fiche** | Lecture. Peut **accepter**, **démarrer**, **terminer**, **soumettre**, **reprendre**. Pas de bouton « Modifier », pas d'affectation. | Peut modifier, affecter, réaffecter, annuler, clôturer. |
| **Clients — liste** | ⛔ Route refusée (`RequirePermission`) : message expliquant que son rôle ne le permet pas. | Liste complète, recherche, actifs/archivés. |
| **Client — fiche** | ✅ **Accessible** pour les clients de ses missions. Lecture seule (pas de `customer.update`). | Accès complet, création, modification, archivage. |
| **Équipes** | ✅ Visible (`team.view`), lecture. Ne peut pas composer. | Créer, modifier, composer. |
| **Intervention** | **Seul à pouvoir pointer.** Chronomètre actif, notes modifiables. | Consulte. Le chronomètre est en lecture seule. |
| **Compte rendu** | **Seul à pouvoir l'écrire**, tant qu'il n'est pas validé. | Lecture. Ne peut pas le réécrire — même en le refusant. |
| **Contrôle** | ⛔ Route refusée. Un technicien ne valide **jamais** un compte rendu, pas même celui d'un collègue. | File complète. |
| **Journal** | ⛔ Refusé. | ⛔ Refusé aussi (`audit.view` = `owner`/`admin` seulement). |

### 6.4 Trois pièges de conception liés aux rôles

**① Un `team_leader` contrôle des comptes rendus sans voir les missions.**
Il a `intervention.review` mais **pas** `mission.view_all`. Sur `/controle`, la mission
jointe au compte rendu peut donc revenir `null`. L'écran l'affiche « Mission non
consultable » plutôt qu'un vide. **Toute maquette de la file de contrôle doit prévoir ce
cas.**

**② Le rôle ne dit pas tout : l'équipe compte autant.**
Un « technicien » sans équipe ne recevra jamais de mission par affectation d'équipe. C'est
pourquoi la liste des membres affiche les équipes de chacun (pastille de couleur + nom).

**③ Masquer un bouton ne sécurise rien.**
`rbac.ts` porte cet avertissement en tête, et il vaut pour vous aussi :

> Retirer une entrée de menu n'empêche pas d'atteindre l'URL à la main. La section
> s'ouvrira — et restera vide, la RLS ne renvoyant rien. C'est l'**ergonomie** qui est en
> jeu, pas l'accès.

L'inverse est vrai également : **afficher un bouton que le serveur refusera est un défaut
grave.** Exemple réel : le formulaire d'édition de mission n'est rendu que sous
`mission.update`, parce que le trigger `enforce_mission_assignee_scope` interdit à
l'intervenant de modifier tout ce que ce formulaire touche. Lui ouvrir la fenêtre
reviendrait à le laisser saisir dix champs pour se voir refuser à l'enregistrement.

---

## 7. Organisation

**Tables :** `organizations`, `organization_members`, `organization_invitations`,
`role_permissions`.

### 7.1 Modèle

| Table | Champs affichés |
|---|---|
| `organizations` | `name`, `slug`, `status` (`active`/`suspended`/`archived`), `created_by` |
| `organization_members` | `role` (6 valeurs), `status` (`invited`/`active`/`suspended`/`removed`), `job_title`, `user_id`, jointure `profiles` (`display_name`, `avatar_url`) |
| `organization_invitations` | `email`, `role`, `token`, `status` (`pending`/`accepted`/`revoked`/`expired`), `expires_at` |

### 7.2 Écrans et parcours

| Écran | Route | Ce qu'il montre |
|---|---|---|
| Création | `/organisation/nouvelle` | Nom + slug suggéré automatiquement (`suggestOrganizationSlug`). Le créateur devient `owner`. |
| Paramètres | `/organisation` | Nom, coordonnées. Écriture sous `organization.update`. |
| Membres | `/organisation/membres` | Liste + rôle + équipes + invitations en attente + jauge de quota. |
| Changement d'organisation | Menu avatar | `OrganizationSwitcher`, dans le `Dropdown` du compte. Multi-appartenance supportée. |
| Acceptation | `/invitations/:token` | Aperçu **avant** acceptation via la RPC `get_invitation_preview` — l'utilisateur voit le nom de l'entreprise et le rôle proposé. |

### 7.3 Règles serveur visibles à l'écran

Ces trois règles sont appliquées par des triggers. L'interface ne les applique pas — elle
**évite de proposer une action refusée, et dit pourquoi** (infobulle sur le contrôle
désactivé) :

| Règle | Trigger | Rendu actuel |
|---|---|---|
| Le dernier propriétaire actif est intouchable | `protect_last_owner` | Rôle et retrait verrouillés, infobulle « Cette personne est le dernier propriétaire : l'entreprise deviendrait ingérable. » |
| Nul ne modifie son propre rôle | `prevent_privilege_escalation` | Verrouillé, infobulle « Un autre administrateur doit s'en charger. » |
| Seul un propriétaire en désigne un autre | idem | « Propriétaire » retiré des choix de `RoleSelect` (`canAssignOwner={false}`) |
| Quota de membres (25 en `business`) | trigger d'invitation | `MemberQuotaBar` + `InviteMemberDialog` désactivé quand `quotaReached` |

### 7.4 Invitations — pas d'e-mail, et c'est assumé

Aucune Edge Function d'envoi. **Le mécanisme retenu est le lien à copier**
(`InvitationLink`), et l'interface le dit explicitement. Ne maquillez pas cela en « e-mail
envoyé ».

---

## 8. Clients

**Tables :** `customers`, `customer_contacts`, `sites`.

### 8.1 Modèle

| Champ | Notes |
|---|---|
| `reference` | Générée par trigger, par organisation. Affichée en `Badge variant="outline"` partout. |
| `name`, `legal_name` | Nom d'usage et raison sociale |
| `vat_number`, `registration_number` | TVA, SIRET |
| `address_line1`, `postal_code`, `city`, `country` | |
| `phone`, `email`, `notes` | |
| `status` | `active` / `archived` — l'archivage est **réversible** |

### 8.2 Écrans

**Liste `/clients`** — recherche (nom, référence, ville) + sélecteur **Actifs / Archivés**.
Grille de cartes : nom, référence, ville, téléphone.

**Fiche `/clients/:id`** — quatre onglets : **Fiche** · **Contacts** · **Sites** ·
**Historique**.

L'onglet Historique liste les missions de ce client. La policy `missions_select_scoped`
s'y applique : **un technicien n'y voit que SES interventions, un responsable toutes.**

### 8.3 Actions et permissions

| Action | Permission | Note |
|---|---|---|
| Consulter la liste | `customer.view` | |
| Consulter une fiche | *aucune* | Le technicien y accède par ses missions |
| Créer | `customer.create` | |
| Modifier | `customer.update` | |
| Archiver | `customer.delete` | |
| **Réactiver** | `customer.update` | Et non `customer.delete` : côté serveur c'est un UPDATE ordinaire soumis à `customers_update`. Le bouton reprend la permission que le serveur exigera. |

### 8.4 Deux états vides différents — ne pas les confondre

- Avec `customer.create` : « Créez une fiche client pour rattacher ses sites… »
- **Sans** (technicien) : « Les clients apparaîtront ici dès que vous serez affecté à une
  mission chez eux. » — parce qu'une liste vide signifie qu'il n'a aucune mission en
  cours, **pas qu'il manque un droit**. Le dire évite de faire chercher une panne.

---

## 9. Sites et consignes d'accès

**Table :** `sites`, rattachée à `customers`.

| Champ | Rôle |
|---|---|
| `name`, `code` | Le `code` est **la référence du client**, pas la nôtre |
| `address_line1`, `postal_code`, `city`, `country` | |
| `access_notes` | **Le champ le plus important du module** |
| `status` | `active` / `archived` |

### 9.1 Les consignes d'accès méritent un traitement à part

`access_notes` contient les codes de portail, les horaires, les consignes de sécurité.
**C'est l'information qui fait gagner une heure à un technicien devant une grille fermée.**

Elles sont mises en évidence dans un bloc dédié (icône `KeyRound` + fond
`bg-surface-sunken`) sur **trois écrans** : la fiche site, la fiche mission, la page
d'intervention. Elles ne doivent jamais être noyées dans le reste.

### 9.2 Règle serveur

Le trigger `enforce_mission_customer_site` **refuse un site n'appartenant pas au client de
la mission**. C'est pourquoi `CustomerPicker` et `SitePicker` sont couplés : choisir un
client réinitialise le site, et le sélecteur de site est désactivé tant qu'aucun client
n'est choisi (« Choisissez d'abord un client »).

Une mission créée depuis un site **hérite** de son adresse et de ses consignes.

### 9.3 Modifier plutôt que recréer

Un code de portail qui change ne doit pas rompre le lien des missions passées vers ce site.
C'est pourquoi sites et contacts sont **modifiables** (et non archivés-puis-recréés).
Distinction technique conservée dans les formulaires : `omitEmpty` à la création (le champ
n'est pas envoyé), `emptyToNull` à l'édition (vider un champ l'efface).

---

## 10. Équipes

**Tables :** `teams`, `team_members`.

| Champ | Notes |
|---|---|
| `name`, `slug` | |
| `color` | Utilisée comme **pastille** dans les listes de missions et de membres. Repli : `var(--color-border-strong)`. |
| `category_id` | Référence `categories` — **un UUID, pas un slug** |
| `status` | `active` / `archived` |
| `team_members.role` | `lead` ou `member` |

### 10.1 Chefs d'équipe (`lead`)

Distinct du rôle d'organisation `team_leader`. Un `lead` est le responsable **d'une équipe
donnée** ; il peut composer son équipe sans détenir `team.assign_member` au niveau de
l'entreprise. `TeamMembersPanel` autorise donc l'ajout si `canAssign` **ou** si le
visiteur est lead de cette équipe.

`TeamRoleBadge` et `TeamManagerBadge` distinguent les deux à l'écran.

### 10.2 Règle serveur

`app.enforce_organization_immutable()` (trigger sur `teams`, `customers`, `missions`)
**interdit de déplacer une équipe vers une autre organisation.** C'était l'une des huit
failles fermées.

---

## 11. Missions — le cœur du produit

**Tables :** `missions`, `mission_assignments`, `mission_status_events`,
`mission_status_transitions`.

### 11.1 Modèle

| Champ | Notes |
|---|---|
| `reference` | **Générée par trigger** (`2026-0042`), par organisation et par année. Jamais fournie par le client : cela produirait des collisions et des numéros devinables d'une entreprise à l'autre. |
| `title`, `description` | |
| `priority` | `low` / `normal` / `high` / `urgent` → `MissionPriorityBadge` |
| `status` | 10 valeurs → `MissionStatusBadge` |
| `customer_id`, `site_id` | Optionnels — une intervention d'urgence peut se passer de fiche client |
| `customer_name` | **Instantané figé** à la création, quand aucune fiche n'est rattachée. Ne bouge plus. |
| `location_label`, `address_line1`, `postal_code`, `city` | Recopiés du site |
| `assigned_team_id`, `assigned_user_id` | `assigned_user_id` référence **`organization_members.id`**, pas `auth.users.id` |
| `scheduled_start`, `actual_start` | |

### 11.2 Machine à états — 10 états, 17 transitions

**Source : `src/features/missions/workflow.ts`, miroir vérifié du seed SQL.**

```
  draft ──affecter──▶ assigned ──accepter*──▶ accepted ──démarrer*──▶ in_progress
    │                    │  ▲                    │                        │
    │                    │  └──réaffecter────────┘                        │
    │                    ▼                                        terminer les travaux*
    │                  draft                                              │
    │                                                                     ▼
    │                                                                 completed
    │                                                                     │
    │                                                    soumettre le compte rendu*
    │                                                                     ▼
    │                                                                 submitted
    │                                                      ┌──────────────┴──────────────┐
    │                                                  valider                       refuser
    │                                                      ▼                             ▼
    │                                                  approved                      rejected
    │                                                      │                             │
    │                                              clôturer le dossier      reprendre les travaux*
    │                                                      ▼                             ▼
    │                                                   closed                     in_progress
    ▼
 cancelled  ◀── annuler / interrompre / abandonner, depuis draft, assigned, accepted, in_progress, rejected
```

`*` = **réservé à l'intervenant affecté** (`assigneeOnly`).

| De → Vers | Libellé du bouton | Exigence |
|---|---|---|
| `draft` → `assigned` | Affecter | `mission.assign` |
| `draft` → `cancelled` | Annuler | `mission.cancel` |
| `assigned` → `accepted` | Accepter la mission | **assigné** |
| `assigned` → `assigned` | Réaffecter | `mission.assign` |
| `assigned` → `draft` | Retirer l'affectation | `mission.assign` |
| `assigned` → `cancelled` | Annuler | `mission.cancel` |
| `accepted` → `in_progress` | Démarrer l'intervention | **assigné** |
| `accepted` → `assigned` | Réaffecter | `mission.assign` |
| `accepted` → `cancelled` | Annuler | `mission.cancel` |
| `in_progress` → `completed` | Terminer les travaux | **assigné** |
| `in_progress` → `cancelled` | Interrompre | `mission.cancel` |
| `completed` → `submitted` | Soumettre le compte rendu | **assigné** |
| `submitted` → `approved` | Valider | `intervention.review` |
| `submitted` → `rejected` | Refuser | `intervention.review` |
| `rejected` → `in_progress` | Reprendre les travaux | **assigné** |
| `rejected` → `cancelled` | Abandonner | `mission.cancel` |
| `approved` → `closed` | Clôturer le dossier | **`mission.update`** |

**Deux subtilités à respecter :**

- **`approved` n'est PAS terminal.** Une mission validée attend sa clôture — c'est
  précisément ce qui rend la question « quelles missions sont validées mais pas encore
  facturées ? » exprimable. Seuls `closed` et `cancelled` sont terminaux.
- **Clôturer exige `mission.update`, pas `intervention.review`** : clore relève de
  l'exploitation, pas d'un second contrôle technique.

`MissionTransitions` n'affiche que les transitions réellement déclenchables par
l'utilisateur courant (`getPermittedTransitions`). Le trigger
`enforce_mission_transition` reste l'autorité.

### 11.3 Qualité d'intervenant — deux voies

`isAssignee` reproduit `app.is_mission_assignee()` : être **nommément désigné** OU
**appartenir à l'équipe affectée**. Ne retenir que la première masquerait ses actions à un
membre d'équipe qui a pourtant le droit de les déclencher.

### 11.4 Filtres de la liste

`MissionFiltersBar` — ligne toujours visible : recherche + statut. Repliés derrière un
bouton **« Filtres »** portant le **nombre de critères actifs** : client, équipe,
intervenant, à partir du / jusqu'au.

Les filtres avancés ne sont rendus que sous `mission.view_all` : un intervenant verrait
trois sélecteurs vides (la RLS ne lui sert ni les clients ni les équipes) pour filtrer une
liste qui ne contient déjà que ses missions.

**Par défaut, les états terminaux sont exclus.** Une liste de missions sert à savoir quoi
faire ensuite ; y laisser les dossiers clos la fait grossir indéfiniment.

### 11.5 Historique — deux journaux distincts, à ne pas fusionner

| Bloc | Table | Répond à |
|---|---|---|
| **Historique des affectations** | `mission_assignments` | « Qui a eu ce dossier en main, et depuis quand ? » — avec acceptation, refus **et son motif**, retrait |
| **Historique des états** | `mission_status_events` | « Par quels états est-elle passée ? » — écrit par le trigger `enforce_mission_transition`, **jamais par le client** |

Quand le nom de l'équipe ou de la personne n'est pas consultable (RLS, équipe archivée),
l'écran affiche « Destinataire non consultable » — pas « supprimé », qui serait une
déduction et non un fait.

---
## 12. Interventions, chronométrage, temps de travail

**Tables :** `interventions`, `intervention_time_entries`.
**RPC :** `intervention_worked_seconds(p_intervention_id)`.

### 12.1 Mission ≠ intervention

La **mission** décrit ce qu'il y a à faire ; l'**intervention** ce qui a été fait. **Une
mission peut en compter plusieurs** — un chantier revient souvent sur deux passages.
C'est `MissionInterventionsPanel`, sur la fiche mission, qui referme la chaîne.

### 12.2 Démarrage

`canStart` = **assigné** ET aucune intervention déjà ouverte ET mission en `accepted` ou
`in_progress`. `draft` et `assigned` viennent trop tôt (personne n'a accepté le travail),
les états terminaux trop tard.

**La mission avance AVANT la création de l'intervention** : commencer à travailler, c'est
factuellement passer la mission en cours. Demander de le déclarer séparément serait de la
bureaucratie, et la mission resterait « acceptée » pendant que le chronomètre tourne.

Trois messages distincts selon la situation, à conserver :

| Situation | Message |
|---|---|
| Peut démarrer | Bouton « Démarrer une intervention » |
| Une intervention est déjà ouverte | « Une intervention est en cours — ouvrez-la pour gérer le chronomètre et le compte rendu. » |
| N'est pas l'intervenant | « Seul l'intervenant affecté peut démarrer une intervention. » |

### 12.3 Le chronomètre — `InterventionTimer`

**Le compteur affiché n'est JAMAIS stocké.** Il se recalcule chaque seconde depuis
`started_at`, l'heure posée **par le serveur**. Stocker un compteur inviterait
l'incohérence dès qu'un onglet se ferme, que l'écran se verrouille ou que le réseau tombe
— trois situations quotidiennes en intervention.

Le temps net des segments **clos** vient de PostgreSQL (RPC) : c'est le même calcul que
celui qui servira à facturer.

| Élément | Rendu actuel |
|---|---|
| Compteur | `font-mono text-4xl tabular-nums sm:text-3xl` — **plus gros sur téléphone**, c'est là qu'on le lit à bout de bras |
| État | `Badge` : En cours (succès) / En pause (avertissement) / Terminée (neutre) |
| Précision | « Temps de travail net — les pauses ne sont pas comptées. » |
| Commandes | Démarrer / Reprendre (primaire) ou Mettre en pause (contour), `size="lg"`, **pleine largeur sur téléphone** |
| Terminer | **Séparé par une bordure haute, et confirmé par une modale** |

**Pourquoi la confirmation :** terminer pose `end_time` une fois pour toutes — le trigger
`enforce_intervention_scope` ne la réécrit jamais. Un pouce qui glisse sur la commande
d'à côté clôturerait une intervention en cours, sans retour possible.

### 12.4 Relevé du temps

`intervention_time_entries` : segments `work` / `pause`, avec `started_at`, `ended_at`,
`reason`. Affichés en liste : badge de nature, plage horaire `HH:MM → HH:MM` (ou `…` si
le segment est ouvert), motif éventuel.

Le passage travail ↔ pause est **une seule mutation** (`useSwitchTimeEntry`) : fermer le
segment courant, en ouvrir un de l'autre nature. Trois hooks distincts feraient croire à
trois mécanismes, et l'un des trois finirait par oublier une invalidation.

### 12.5 Notes de terrain

Champ libre sur l'intervention, **enregistrement explicite** (bouton), pas automatique à
la frappe : sur un chantier le réseau est ce qu'il est, et un champ qui se sauvegarde tout
seul ne dit pas si le texte est parti.

En **lecture seule après clôture** — choix d'ergonomie, **pas** une protection : le trigger
laisse ce champ libre. Ce qui doit être opposable passe par le compte rendu et son circuit
de validation.

### 12.6 Règle serveur — ce que l'intervenant NE peut PAS faire

`app.enforce_intervention_scope()` — l'une des huit failles fermées :

| Tentative | Résultat |
|---|---|
| Antidater le début | **Écrasé** : `new.start_time := old.start_time`. Le serveur horodate, l'intervenant déclare des événements. |
| Rattacher l'intervention à une autre mission | **Refusé** — cela réattribuerait un travail effectué. |
| Se réattribuer / réattribuer à un collègue | **Refusé** sans `intervention.view_all`. |
| Modifier statut, notes, géolocalisation de départ | **Autorisé** |

> Un relevé d'heures sert à facturer un client, à payer un salarié et à prouver qu'on est
> intervenu. **S'il est modifiable par celui qu'il engage, il ne prouve rien.**

---

## 13. Rapports (comptes rendus), photos et pièces jointes

**Tables :** `intervention_reports`, `intervention_attachments`. **Bucket Storage privé.**

### 13.1 Modèle

| Champ | Notes |
|---|---|
| `work_description` | Obligatoire pour soumettre |
| `observations` | Anomalies, réserves, préconisations |
| `materials_used`, `tools_used` | JSON — **aucun écran de saisie aujourd'hui** |
| `status` | `draft` / `submitted` / `approved` / `rejected` |
| `rejection_reason` | **≥ 5 caractères**, contrainte CHECK |
| `submitted_at`, `reviewed_at`, `reviewed_by` | |

### 13.2 Qui peut écrire

```
isEditable = isAuthor && (report === null || status === 'draft' || status === 'rejected')
```

**Un compte rendu validé est définitif pour tout le monde, son auteur compris.** Une
correction passe par un refus motivé, qui laisse une trace.

### 13.3 Photos avant / après

`AttachmentGallery`. Cinq natures : `before`, `after`, `document`, `proof`, `signature`.

**Deux boutons distincts** — « Photo "avant" » et « Photo "après" » — et non un bouton
unique suivi d'un tri. Sur un chantier, on photographie l'état initial en arrivant et le
résultat en partant ; demander de classer après coup, c'est garantir que personne ne le
fera.

Les champs de fichier portent `accept="image/*" multiple capture="environment"` :
l'appareil photo arrière s'ouvre directement sur mobile. **Ne retirez pas `capture`.**

Grille `grid-cols-2 sm:grid-cols-3`, vignettes carrées (`aspect-square`), badge de nature,
suppression en `icon-sm`.

**Le bucket est privé et les URL signées expirent en une heure.** Un échec d'affichage
n'est donc pas rare (écran resté ouvert, réseau coupé) : le repli est une icône `ImageOff`
lisible, jamais une image brisée. **Conservez ce repli.**

### 13.4 Soumission

Bouton pleine largeur, `size="lg"`, désactivé tant que `work_description` est vide.
**Le compte rendu est enregistré AVANT d'être soumis** — sans cela, la dernière frappe non
sauvegardée partirait au contrôle sans y figurer.

Avertissement affiché au-dessus : « Une fois soumis, le compte rendu part au contrôle et
n'est plus modifiable — sauf s'il vous est renvoyé avec un motif. »

### 13.5 État de la saisie

Le bouton d'enregistrement **change d'apparence selon qu'il reste ou non quelque chose à
envoyer** (primaire + « Enregistrer les modifications » / contour + « Enregistré »), avec
la mention « Modifications non enregistrées » en `text-warning`.

La comparaison porte sur le **texte serveur**, pas sur un drapeau posé à la frappe :
revenir sur sa saisie ne compte pas comme une modification.

### 13.6 Règle serveur — paternité

Le trigger force `technician_id := intervention.technician_id`. **Le rédacteur du compte
rendu EST l'intervenant**, quoi que le client envoie. C'était l'une des huit failles : le
contrôleur pouvait réécrire le compte rendu du technicien, puis l'approuver.

---

## 14. Contrôle, validation, refus motivé

**Écran :** `/controle` — `ReviewQueuePage`.
**Accès :** plan `intervention_review` + permission `intervention.review`.

### 14.1 Ordre de la file

**Du plus ancien au plus récent.** C'est celui qui attend depuis le plus longtemps qui
bloque une facturation. Un tri décroissant ferait traiter les derniers arrivés d'abord et
vieillir indéfiniment les premiers. **Ne l'inversez pas.**

### 14.2 Contenu d'une carte

Référence de mission (`Badge`) · titre · date de soumission · **auteur** · lien « Voir
l'intervention » · description des travaux (`line-clamp-4`) · deux commandes.

**Mission et auteur peuvent être `null`** (§6.4 ①). L'écran affiche alors « Mission non
consultable » / « auteur non consultable ». **Ce cas doit survivre à votre maquette.**

Les deux commandes se partagent la largeur sur téléphone
(`[&>*]:flex-1 sm:[&>*]:flex-none`) : valider ou refuser se fait souvent depuis un
véhicule, d'un pouce.

### 14.3 Refus motivé

`Modal` + `Textarea`. Motif **obligatoire, ≥ 5 caractères** (contrainte CHECK en base ;
vérifiée aussi côté client pour éviter un aller-retour). Le bouton « Refuser » reste
désactivé tant que le seuil n'est pas atteint.

Aide affichée : « C'est ce que l'intervenant lira pour corriger. »

### 14.4 Séparation des pouvoirs

Le trigger `enforce_report_review_separation` refuse qu'un intervenant valide **son propre**
compte rendu. La comparaison porte sur l'identifiant `auth.users`, pas sur le membership :
une même personne pourrait avoir plusieurs lignes de membership et se contrôler par ce
détour.

C'est **le refus le plus fréquent de cet écran**. Le message du serveur le dit
explicitement et doit rester lisible — il est affiché par le `FormError` en tête de page.

### 14.5 Le cycle complet

```
technicien                          contrôleur                    exploitation
────────────────────────────────────────────────────────────────────────────────
rédige (draft)
soumet ──────────────────▶ submitted
                                    valide ──────▶ approved ──────▶ clôture ──▶ closed
                                    refuse ──────▶ rejected
reprend ◀───────────────────────────────┘
(in_progress → completed → submitted à nouveau)
```

`sync_mission_from_report` fait suivre l'état de la mission à celui du compte rendu.

---

## 15. Tableau de bord

**Route :** `/dashboard`. Deux blocs superposés, dans cet ordre :

### 15.1 En-tête « Cockpit » + catalogue (tout utilisateur connecté)

Salutation nominative · badge « Cockpit connecté » (pastille pulsée) · lancement rapide ⌘K ·
4 `StatCard` : **Outils disponibles** · **Outils consultés** · **Outils favoris** ·
**Domaines couverts** · outils à la une · historique récent · favoris · 8 catégories.

Les compteurs affichent **`—` pendant le chargement, jamais `0`** — un zéro corrigé après
coup se lit comme une information.

### 15.2 `ProfessionalSummary` — inséré ENTRE l'en-tête et le catalogue

**N'apparaît que pour les membres d'une entreprise abonnée.** Pour un utilisateur du seul
catalogue d'outils, ce bloc n'existe pas.

| Tuile | Condition d'affichage |
|---|---|
| Missions en cours | toujours (dans une organisation avec le plan) |
| **À contrôler** | `intervention.review` uniquement — bordure `warning` si > 0 |
| Membres `n / 25` | `member.view` **et** quota défini |

Suivi des 5 missions actives (`assigned`, `accepted`, `in_progress`, `rejected`).

**C'est tout l'intérêt du bloc :** un technicien ouvre l'application pour savoir ce qu'il a
à faire aujourd'hui ; un responsable pour savoir ce qui l'attend. Leur montrer le même
écran obligerait chacun à chercher sa moitié dans celle de l'autre.

---

## 16. Journal d'audit

**Route :** `/journal` · plan `audit_log` + permission `audit.view` (**`owner` / `admin`
seulement**).

### 16.1 Ce que ce journal vaut

Il est écrit **exclusivement par des triggers PostgreSQL**, et un trigger d'immuabilité
refuse toute modification ou suppression — y compris à un rôle privilégié, ce que le
scénario de test vérifie.

> Personne, pas même le propriétaire de l'entreprise, ne peut en effacer une ligne gênante.
> **Un journal que l'on peut nettoyer ne prouve rien.**

C'est le message porté par la description de la page : « Écrit par la base de données, et
modifiable par personne. » **Ne l'affaiblissez pas.**

### 16.2 Contenu

Deux `Select` de filtre : **action** (15 valeurs) et **type d'objet** (5 valeurs).

15 actions journalisées : `mission.created` · `mission.status_changed` · `mission.assigned`
· `mission.deleted` · `report.created` · `report.submitted` · `report.approved` ·
`report.rejected` · `report.updated` · `member.added` · `member.removed` ·
`member.role_changed` · `member.status_changed` · `team.created` · `team.deleted`.

Ligne : horodatage `JJ/MM HH:MM` monospace (largeur fixe `w-36`) · libellé de l'action ·
**`actor_label`** · badge du type d'objet.

`actor_label` est **figé au moment de l'action** par le trigger : un membre retiré depuis,
ou renommé, reste identifié tel qu'il était. C'est précisément ce qu'on attend d'un journal.

Plafond de 100 lignes, avec la mention « Les cent dernières actions sont affichées.
Affinez les filtres pour remonter plus loin. »

---

## 17. Abonnements et entitlements

**Tables :** `plans`, `plan_features`, `subscriptions`.

### 17.1 Trois formules, 16 clés de fonctionnalité

`null` = illimité · `n` = quota · **absence de clé = non incluse** (distincte de `0`, qui
serait une interdiction assumée).

| Clé | free | pro | business |
|---|:--:|:--:|:--:|
| `catalog_access` | ∞ | ∞ | ∞ |
| `calculation_history` | **10** | ∞ | ∞ |
| `favorites` | **3** | ∞ | ∞ |
| `pro_tools` | — | ∞ | ∞ |
| `export_pdf` | — | ∞ | ∞ |
| `export_csv` | — | ∞ | ∞ |
| `organizations` | — | — | ∞ |
| `customers` | — | — | ∞ |
| `teams` | — | — | ∞ |
| `members` | — | — | **25** |
| `missions` | — | — | ∞ |
| `interventions` | — | — | ∞ |
| `intervention_review` | — | — | ∞ |
| `audit_log` | — | — | ∞ |
| `statistics` | — | — | ∞ |
| `attachments` | — | — | ∞ |

**Tout le module professionnel est réservé au plan `business`.** Sans lui, chaque garde
`RequirePlan` affiche un `EmptyState` renvoyant vers `/pricing`.

### 17.2 Statuts d'abonnement, et une subtilité

| Statut | Badge | Droits |
|---|---|---|
| `trialing` | `info` | conservés |
| `active` | `success` | conservés |
| **`past_due`** | **`warning`** | **CONSERVÉS** |
| `canceled` | `error` | retirés |
| `expired` | `error` | retirés |

`past_due` est un **avertissement, pas une erreur** : `app.org_has_feature` conserve
délibérément les droits dans cet état — **une équipe en intervention ne doit pas être
bloquée par un incident de carte bancaire.** Un encart d'avertissement l'explique.

### 17.3 Le message du garde `RequirePlan`

Le cas délicat n'est pas l'entreprise qui n'a jamais souscrit, mais **celle dont
l'abonnement vient d'expirer** : ses données existent toujours et disparaissent d'un coup.
Le message doit permettre de distinguer « cette offre ne l'inclut pas » de « quelque chose
est cassé ». **Conservez cette distinction.**

### 17.4 Ce qui n'existe pas encore

Aucune action de paiement. `subscriptions` est **fermée en écriture au client** — l'y
autoriser reviendrait à laisser chacun s'attribuer la formule Entreprise. L'alimentation
se fera par webhook Stripe avec le rôle `service_role`, en Phase 12.

> **Rappel historique :** avant la Phase 2, le plan de l'utilisateur était un `useState`
> qu'un bouton pouvait faire passer en Pro. C'était l'une des huit failles. **Ne
> réintroduisez aucun sélecteur de formule côté client.**

---
## 18. Composants existants — la boîte à outils

**Règle :** puisez ici avant d'inventer. Un composant réécrit est un composant dont
l'accessibilité est à refaire.

### 18.1 Primitives — `src/components/ui/` ⛔ apparence modifiable via les tokens uniquement

| Composant | Signature utile | Notes |
|---|---|---|
| `Button` | `variant`, `size`, `asChild` | 6 variantes : `primary` `secondary` `outline` `ghost` `danger` `link`. 5 tailles : `sm` (32 px) `md` (36 px) `lg` (**44 px, défaut mobile**) `icon` (36) `icon-sm` (32). `buttonVariants` exporté pour styler un lien. |
| `Card` | + `CardHeader` `CardTitle` `CardDescription` `CardContent` `CardFooter` | |
| `Badge` | `variant` | 8 : `neutral` `primary` `accent` `success` `warning` `error` `info` `outline` |
| `Input` | `label` `hint` `error` `leadingIcon` `trailingSlot` `hideLabel` | `error` bascule en invalide et masque `hint` |
| `Textarea` | `label` `hint` `error` `hideLabel` | |
| `Select` | `options` `value` `onValueChange` `label` `hint` `error` `placeholder` `hideLabel` | Radix, pas `<select>` natif. ⚠️ **`value=''` affiche le placeholder** — utilisez une sentinelle non vide. |
| `Checkbox`, `Switch` | `label` `description` | |
| `Modal` | `open` `onOpenChange` `trigger` `title` (**obligatoire**) `description` `footer` `size` (`sm`/`md`/`lg`) `hideTitle` | Radix Dialog : piège de focus, `Échap`, verrouillage du défilement, inertie ARIA. `max-h-[calc(100dvh-4rem)]` |
| `Dropdown` | + `DropdownItem` `DropdownLabel` `DropdownSeparator` `DropdownCheckboxItem` | |
| `Tabs` | + `TabsList` `TabsTrigger` `TabsContent` | |
| `Tooltip` | `content` | Utilisé pour **expliquer un contrôle désactivé** |
| `Avatar` | `src` `name` (obligatoire) `size` | Initiales générées à partir du nom |
| `StatCard` | `label` `value` (`string \| number`) `unit` `icon` `trend` `trendLabel` | `value` accepte `'—'` pendant le chargement |
| `Skeleton` | + `ListSkeleton({ rows })` `ToolCardSkeleton` | `aria-hidden`; c'est le conteneur qui porte `aria-busy` |
| `ActivityTimeline` | `items: { id, icon, title, description?, timestamp, href? }[]` | |
| `Kbd` | — | Touches de raccourci |

### 18.2 Retours utilisateur — `src/components/feedback/`

| Composant | Signature | Rôle |
|---|---|---|
| `EmptyState` | `icon` `title` `description` (**obligatoire**) `action` `size` | La description explique **pourquoi c'est vide et quoi faire ensuite** |
| `ErrorState` | `error` `onRetry` `title` | Message + bouton Réessayer |
| `FormError` | `error` | `role="alert"` — annoncé immédiatement au lecteur d'écran |
| `LoadingScreen` | `label` `variant` (`page` / `inline`) | `role="status"` + `aria-live="polite"` |
| `ErrorBoundary` / `ErrorFallback` | | Isolation des pannes |
| `PagePlaceholder` | | ⚠️ **Aucun usage.** Vestige — ne l'utilisez pas. |

### 18.3 Mise en page — `src/components/layout/` ✅ modifiable

`AppLayout` · `PublicLayout` · `RootLayout` · `Sidebar` · `MobileNav` ·
`PageHeader` (`title` `description` `actions`) · `Logo`.

`PageHeader` **porte l'unique `<h1>` de la page.** Le factoriser garantit qu'il n'y en a
qu'un et que la hiérarchie de titres reste correcte pour les lecteurs d'écran. Utilisez-le
partout.

### 18.4 Gardes — `src/components/guards/` ⛔

`RequireOrganization` (redirige vers la création) · `RequirePermission` (affiche un
`EmptyState` nommant le rôle) · `RequirePlan` (affiche un `EmptyState` renvoyant aux
formules).

### 18.5 Composants métier — `src/features/*/components/` ✅ apparence modifiable

**Clients** — `CustomerFormDialog` (`organizationId`, `customer?`, `trigger`) ·
`ContactsPanel` · `SitesPanel` (`customerId`, `organizationId`, `canEdit`) ·
`CustomerPicker` / `SitePicker` (couplés, voir §9.2).

**Équipes** — `TeamFormDialog` (`organizationId`, `team?`, `trigger`) ·
`TeamMembersPanel` (`team`, `organizationMembers`, `canAssign`) · `TeamRoleBadge` ·
`TeamManagerBadge`.

**Missions** — `MissionFormFields` (champs partagés création/édition) ·
`MissionEditDialog` (`mission`, `organizationId`) · `MissionFiltersBar`
(`organizationId`, `value`, `onChange`, `showAdvanced`) · `MissionTransitions`
(`mission`, `role`, `isAssignee`) · `AssignMissionDialog` · `MissionStatusBadge` ·
`MissionPriorityBadge`.

**Interventions** — `InterventionTimer` (`interventionId`, `organizationId`, `entries`,
`workedSeconds`, `canTrack`, `isCompleted`) · `AttachmentGallery` ·
`MissionInterventionsPanel`.

**Organisation** — `MemberRow` (11 props, dont `teams?`) · `RoleSelect`
(`canAssignOwner`) · `RoleBadge` · `MemberQuotaBar` (`current`, `max`) ·
`InviteMemberDialog` (`viewerIsOwner`, `quotaReached`) · `InvitationLink` ·
`OrganizationSwitcher`.

**Outils** — `ToolCard` · `CategoryCard` (`toolCount` — `0` affiche « bientôt
disponible ») · `ToolErrorBoundary`.

**Recherche** — `CommandBar` (⌘K).

**Un principe transversal :** `MissionFormFields`, `CustomerFormDialog`, `SiteFormDialog`
et `ContactFormDialog` servent **création et édition** avec un seul jeu de champs. Deux
formulaires jumeaux divergent toujours — l'un gagne un champ que l'autre n'aura jamais, et
l'on découvre alors qu'on ne peut pas corriger ce qu'on a pu saisir. **Ne les dédoublez
pas.**

---

## 19. Design actuel

> Résumé **opérationnel**. La justification de chaque valeur est dans
> `docs/DESIGN_SYSTEM.md` (11 sections) — **à lire avant toute refonte chromatique.**

### 19.1 Identité — le « Cockpit numérique »

Outil de travail dense, sombre par défaut sur le terrain, chiffres en monospace tabulaire,
accents lumineux bleu / cyan. Ni SaaS pastel, ni tableau de bord ludique.

### 19.2 Tokens de couleur — OKLCH, clair et sombre

Espace OKLCH : la clarté y est perceptuellement uniforme, ce qui rend les contrastes
prévisibles d'une teinte à l'autre.

| Token | Clair | Sombre |
|---|---|---|
| `--background` | `oklch(99% .002 258)` | `oklch(14% .008 258)` |
| `--surface` | `oklch(100% 0 0)` | `oklch(20% .011 258)` |
| `--surface-raised` | `oklch(100% 0 0)` | `oklch(24% .013 258)` |
| `--surface-sunken` | `oklch(97% .003 258)` | `oklch(11.5% .008 258)` |
| `--surface-hover` | `oklch(96.5% .004 258)` | `oklch(26% .014 258)` |
| `--border` | `oklch(92% .005 258)` | `oklch(30% .013 258)` |
| `--border-strong` | `oklch(85% .008 258)` | `oklch(38% .016 258)` |
| `--foreground` | `oklch(20% .015 258)` | `oklch(96% .005 258)` |
| `--muted-foreground` | `oklch(50% .012 258)` | `oklch(68% .01 258)` |
| `--subtle-foreground` | `oklch(62% .01 258)` | `oklch(55% .01 258)` |
| `--primary` (500) | `oklch(58% .19 258)` | `oklch(62% .18 258)` |
| `--primary-foreground` | `oklch(100% 0 0)` | **`oklch(100% 0 0)`** |
| `--accent` | `oklch(70% .14 195)` | `oklch(74% .13 195)` |
| `--success` | `oklch(60% .15 150)` | `oklch(70% .15 150)` |
| `--warning` | `oklch(72% .15 75)` | `oklch(78% .15 75)` |
| `--error` | `oklch(58% .2 25)` | `oklch(68% .19 25)` |
| `--info` | `oklch(62% .14 240)` | `oklch(70% .13 240)` |

Chaque sémantique a trois nuances : base, `-subtle` (fond), `-border`.
Échelle primaire complète `--primary-50` → `--primary-900`, **inversée ET éclaircie** en
sombre (un bleu saturé ne reste lisible sur fond sombre que si sa clarté remonte).

**Trois décisions à ne pas défaire sans y réfléchir :**

- **Le fond sombre est à 14 %, jamais `#000`.** Le noir pur crée un halo autour du texte
  clair et supprime toute hiérarchie par élévation.
- **`--primary-foreground` reste blanc dans les DEUX thèmes.** Inverser le texte du bouton
  principal en sombre le fait lire comme désactivé. Linear, Vercel, Stripe et Raycast
  gardent tous du blanc sur leur couleur d'action.
- **L'accent cyan n'est jamais une action principale** — données et graphes uniquement.

### 19.3 Typographie

| Famille | Usage |
|---|---|
| `Inter Variable` | Interface. **Auto-hébergée** (`@fontsource-variable`) : aucun appel CDN, donc aucune fuite vers un tiers ni dépendance réseau. |
| `JetBrains Mono Variable` | **Chiffres, références, horodatages, durées** |

| Échelle | Valeur | Usage |
|---|---|---|
| `text-2xs` | 11 px | Métadonnées, intitulés de section du menu |
| `text-xs` | 12 px | Texte secondaire, aides |
| `text-sm` | 14 px | **Défaut de l'application** |
| `text-base` | 16 px | **Landing uniquement** |

Titres : `font-weight: 600`, `letter-spacing: -0.02em`, `text-wrap: balance`.
Paragraphes : `text-wrap: pretty`. Tableaux et `.tabular` :
`font-variant-numeric: tabular-nums` — sans quoi `1.111` et `8.888` n'ont pas la même
largeur et les colonnes de résultats tremblent.

### 19.4 Espacement, rayons, élévation

Échelle base **4 px** (Tailwind par défaut).
Rayons : `sm` 4 px · `md` 6 px · `lg` 8 px · `xl` 12 px.

| Ombre | Clair | Sombre |
|---|---|---|
| `--shadow-raised` | `0 1px 2px rgb(0 0 0 / .05)` | `… / .3` |
| `--shadow-overlay` | `0 8px 24px -4px … / .12` | `… / .5` |
| `--shadow-modal` | `0 16px 48px -8px … / .18` | `… / .6` |
| `--shadow-bevel` | transparent | `inset 0 1px 0 rgb(255 255 255 / .045)` |
| `--shadow-card` | `bevel, raised` combinés | idem |

**En sombre, l'élévation passe par la clarté de surface**, pas par l'ombre : une ombre
noire sur fond sombre est invisible. Le liseré `bevel` simule une arête éclairée par le
haut — assez pour décoller la carte du fond, trop discret pour être lu comme une bordure.

### 19.5 Effets « Cockpit » — utilitaires disponibles

| Classe | Effet |
|---|---|
| `.bg-tech-grid` / `.dot-pattern` | Grille de points radiale, 24 px |
| `.glass-panel` | `backdrop-filter: blur(12px)` + surface à 82 % |
| `.border-glow` | Liseré dégradé bleu → cyan en `::after` masqué |
| `.glow-primary` / `.glow-cyan` | Halo diffus |
| `.hero-gradient-text` | Dégradé sur le texte |
| `.animate-fade-in-up` / `.animate-float-slow` / `.animate-spin-slow` | Micro-animations |
| `.safe-top` / `.safe-bottom` | Zones sûres iOS / Android |

### 19.6 Motifs UI en place

- **Densité de liste** : `divide-y divide-border`, lignes empilées, pas de tableau HTML.
- **Cartes de grille** : `grid gap-3 sm:grid-cols-2 lg:grid-cols-3`.
- **Onglets** pour les fiches à facettes (client : Fiche · Contacts · Sites · Historique).
- **Boîtes de dialogue** pour la création et l'édition ; **pages** pour la création de
  mission (formulaire long).
- **Panneaux** (`*Panel`) pour les collections filles à l'intérieur d'une fiche.
- **Badges** pour tout statut. Jamais de texte de statut sans badge.
- **Monospace tabulaire** pour toute donnée numérique ou temporelle.
- **Infobulle sur un contrôle désactivé** : un bouton grisé sans explication est une
  énigme ; une infobulle qui nomme la raison est une réponse.

### 19.7 Base CSS déjà posée — ne la retirez pas

```css
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }

@supports (-webkit-touch-callout: none) {
  input, select, textarea { font-size: 16px; }   /* Safari iOS zoome sous 16 px */
}

@media (prefers-reduced-motion: reduce) { /* animations quasi supprimées */ }
```

> « Les animations déclenchent migraines et nausées chez les personnes souffrant de
> troubles vestibulaires. **Cette règle n'est pas négociable.** »

Barres de défilement discrètes accordées au thème, `::selection` en `--primary-200`.

---

## 20. Responsive et mobile

### 20.1 Points de rupture

| Rupture | Largeur | Ce qui change |
|---|---|---|
| (base) | < 640 px | Téléphone. Colonne unique, navigation basse. |
| `sm` | ≥ 640 px | Grandes tailles de téléphone, grilles à 2 colonnes. |
| `md` | ≥ 768 px | Navigation basse **masquée**. |
| `lg` | ≥ 1024 px | **Barre latérale persistante** (208 px). |
| `xl` | ≥ 1280 px | Rembourrage élargi. |

Contenu centré, `max-w-6xl`. Écrans de terrain : `max-w-2xl` (intervention, compte rendu),
`max-w-3xl` (facturation).

### 20.2 Cibles tactiles et zones sûres

`--spacing-touch: 2.75rem` (**44 px**, WCAG 2.5.5 / Apple HIG) — appliqué via
`min-h-touch`. Bouton `size="lg"` = 44 px. Navigation basse : `min-h-touch` par entrée.

`--safe-top` / `--safe-bottom` / `--safe-left` / `--safe-right` = `env(safe-area-inset-*)`.
La barre supérieure porte `.safe-top`, la navigation basse `.safe-bottom`.

### 20.3 Les écrans de chantier, un par un

**Contexte réel :** une main occupée, parfois des gants, réseau incertain, plein soleil ou
local sombre, batterie limitée.

| Écran | Ce qui est déjà fait | Ce à quoi vous devez faire attention |
|---|---|---|
| **Chronomètre** `/interventions/:id` | Compteur `text-4xl` sur mobile, commandes pleine largeur `size="lg"`, « Terminer » séparé + confirmé | Ne rapprochez **jamais** « Terminer » de « Pause ». La confirmation n'est pas facultative. |
| **Démarrage / arrêt** | Un seul bouton visible à la fois (Démarrer **ou** Pause) | Ne présentez pas les deux simultanément : le choix ambigu sous stress produit l'erreur. |
| **Saisie de compte rendu** | `Textarea` 6 et 4 lignes, enregistrement explicite, état « non enregistré » | Le clavier virtuel occupe la moitié de l'écran. Le bouton d'enregistrement doit rester atteignable. |
| **Photos avant / après** | Deux boutons distincts, `capture="environment"`, grille 2→3 colonnes, repli `ImageOff` | Ne fusionnez pas les deux boutons. Ne retirez pas `capture`. |
| **Pièces jointes** | Vignettes carrées, badge de nature, suppression `icon-sm` | La suppression doit rester distincte de l'ouverture. |
| **File de contrôle** `/controle` | Cartes qui se nomment, commandes partagées à parts égales sur mobile | Souvent consultée depuis un véhicule, d'un pouce. |
| **Validation / refus** | Refus en modale, motif ≥ 5 caractères | Le motif est ce que l'intervenant lira : donnez-lui de la place. |
| **Infos client / site** | Consignes d'accès dans un bloc `KeyRound` distinct sur 3 écrans | **Accessible en moins de deux gestes depuis l'intervention.** C'est ce qu'on lit devant une grille fermée. |
| **Navigation entre missions** | Liste empilée (référence + statuts + date, puis titre, puis client/site/équipe) | Se lit à l'identique à toutes les largeurs. Ne revenez pas à une ligne unique qui se replie au hasard. |
| **Signatures manuscrites** | ⚪ **Rien.** Colonnes et bucket prêts, aucun composant de saisie. | Voir §21. |

### 20.4 Spécificités iOS / Android déjà traitées

- `-webkit-text-size-adjust: 100%` et `-webkit-tap-highlight-color: transparent`
- Champs à 16 px sous `@supports (-webkit-touch-callout: none)`
- `min-h-dvh` / `100dvh` plutôt que `vh` (barre d'adresse mobile)
- `env(safe-area-inset-*)` sur les éléments fixes

---
## 21. Fonctionnalités incomplètes — à ne pas maquiller en fonctionnel

**Règle absolue de cette section :** une maquette qui montre ces éléments comme
opérationnels crée une dette de promesse. Si vous les dessinez, dessinez-les dans leur
état réel — ou n'en parlez pas.

| Élément | État exact | Ce qui manque vraiment |
|---|---|---|
| **`/references`** | `PageHeader` + `EmptyState` seulement | **La table n'existe pas.** Volontairement reportée : sa forme dépend du type de contenu (texte, tableau, abaque, fichier), non arrêté. La créer maintenant garantirait de la refaire. **Rien à brancher.** |
| **`/profile`** | Champ « Nom affiché » modifiable, bouton actif si modifié — **mais il n'appelle rien** | Le hook de mise à jour n'est pas branché. La table `profiles` accepte pourtant l'écriture par son propriétaire. E-mail en lecture seule (« disponible ultérieurement »). |
| **`/settings`** | Thème fonctionnel | Deux `Switch` `disabled` (« Enregistrer l'historique », « Mémoriser les paramètres d'outils »), suppression de compte `disabled`. |
| **`/organisation/facturation`** | Formule, statut, période, quota — lecture | Aucune action de paiement (voir §17.4). |
| **Signatures manuscrites** | Colonnes en base, bucket acceptant `kind = 'signature'`, libellé « Signature » dans `AttachmentGallery` | **Aucun composant de saisie.** Ni canevas, ni capture tactile. |
| **Vue planning / calendrier** | `scheduled_start` et son index existent | Aucune vue calendrier. |
| **Stripe** | `subscriptions` fermée en écriture, colonnes `provider_*` en attente | Phase 12. |
| **E-mail d'invitation** | Lien à copier (`InvitationLink`) | Aucune Edge Function d'envoi — **et l'interface le dit**. Assumé. |
| **`materials_used` / `tools_used`** | Colonnes JSON sur `intervention_reports` | Aucun écran de saisie. |
| **Tests de composants React Query** | 171 tests, aucun ne monte un composant connecté | C'est pourquoi le défaut du `Select` à valeur vide (§23) n'a été trouvé qu'à la lecture. |

---

## 22. Fonctionnalités backend NON exposées — la section critique

> **C'est la section pour laquelle ce document existe.** Chaque ligne est une capacité qui
> existe en base, qui a une policy, un hook et parfois un test — et qu'aucun écran ne
> montre. Si elle n'est pas dans la maquette, elle n'existera jamais.

### 22.1 Sans écran aujourd'hui

| # | Capacité | Symbole disponible | Conséquence concrète | Gravité |
|---|---|---|---|---|
| B1 | **Vue des interventions en cours pour un responsable** | ⚠️ **La policy l'autorise, l'API cliente n'existe pas.** `interventions_select_scoped` sert déjà toutes les interventions de l'organisation à qui détient `intervention.view_all` — mais `listInterventions(missionId)` est **scopée à une mission**. Il manque une fonction, une route et une entrée de menu. | Un responsable ne peut voir les interventions qu'en ouvrant chaque mission une par une. **Le manque le plus visible.** | 🔴 |
| B2 | **Comparaison des formules** | `listPlans`, `getPlan`, `listPlanFeatures` | `BillingPage` affiche la formule en cours mais pas ce que les autres apportent. Le bouton renvoie vers la page marketing publique. | 🟠 |
| B3 | **Catégories servies par la base** | `getCategoryBySlug`, `listToolsByCategorySlug` | `CategoryPage` lit le registry en mémoire. Un outil publié en base sans code reste invisible au lieu d'être signalé. | 🟡 |
| B4 | **Fiche d'un membre** | `listTeamsOfMember` | Il n'existe pas de page « membre ». Les équipes d'un membre sont affichées **dans la ligne** de la liste, pas sur une fiche. | 🟡 |
| B5 | **Matériel et outillage du compte rendu** | colonnes `materials_used`, `tools_used` | Champs JSON prévus, aucun écran. | 🟡 |
| B6 | **Signature de fin d'intervention** | `attachment_kind = 'signature'` + bucket | La preuve de passage la plus demandée sur le terrain n'a pas d'écran. | 🟠 |

### 22.2 Redondances **assumées** — à ne pas « corriger »

Ces symboles sont exportés et sans appelant. **C'est délibéré.** Les brancher
artificiellement pour vider une liste serait pire que de les laisser :

| Symbole | Pourquoi il reste inutilisé |
|---|---|
| `listTeamsOfMember` | Répond pour **une** personne. La liste des membres utilise `listOrganizationTeamMemberships`, qui fait le tour en une requête — sinon trente allers-retours pour trente étiquettes. |
| `useOrganizationSites` | Le sélecteur de site part toujours du client (règle serveur, §9.2). |
| `getOpenTimeEntry` | Le chronomètre déduit le segment ouvert de la liste déjà chargée. |
| `useMyOrganizations` | `OrganizationProvider` fait sa propre requête. |
| `getOrganizationBySlug` | Aucune route par slug. |
| `PagePlaceholder` | Vestige. |

### 22.3 Capacités présentes mais **difficiles à trouver**

| Capacité | Où elle est | Problème d'exposition |
|---|---|---|
| **Réactiver un client archivé** | Fiche client, bouton visible seulement si `status === 'archived'` | Il faut d'abord penser à basculer le sélecteur de la liste sur « Archivés ». |
| **Historique d'affectation d'une mission** | Bas de `/missions/:id` | Sous trois autres blocs. Un refus motivé y est enterré. |
| **Notes de terrain** | `/interventions/:id`, entre le compte rendu et le relevé | Rien n'y attire l'œil au moment où on en a besoin (pendant l'intervention). |
| **Consignes d'accès** | 3 écrans, bloc `KeyRound` | Correct sur la fiche site, **noyé** sur la fiche mission. |
| **Composition d'équipe par un `lead`** | `/equipes/:id` | Un lead sans `team.assign_member` ne devine pas qu'il peut composer son équipe. |
| **Filtres avancés de missions** | Bouton « Filtres » | Repliés par défaut — délibéré, mais le compteur de critères actifs est la seule indication qu'ils existent. |
| **Changement d'organisation** | Menu avatar | Invisible pour qui n'ouvre jamais ce menu. |

---

## 23. Contraintes à ne pas casser

Les invariants suivants ne relèvent pas de l'esthétique. Les enfreindre casse le produit,
la sécurité, ou la confiance.

### 23.1 Les trois états, toujours

Chaque écran qui charge des données doit représenter **loading**, **error** et **empty**.
La cartographie est vérifiable dans le code : **13 des 35 fichiers de `src/pages/`**
portent les trois. Les autres n'en ont pas besoin (pages statiques, formulaires, pages
marketing).

- **loading** → `ListSkeleton` / `Skeleton` de la **forme** attendue, jamais un rectangle
  au hasard : sinon l'arrivée du contenu réel provoque un saut de mise en page.
- **error** → `ErrorState` avec `onRetry`. Un cul-de-sac est interdit.
- **empty** → `EmptyState` avec une `description` qui explique **pourquoi** et **quoi
  faire**.

### 23.2 Jamais de zéro pendant un chargement

`—` pendant le chargement, jamais `0`. **Un zéro affiché puis corrigé se lit comme une
information.** Sur un tableau de bord, « 0 mission à contrôler » suivi de « 7 » est un
mensonge bref mais réel. `StatCard.value` accepte `string | number` précisément pour cela.

### 23.3 Un état vide doit distinguer « rien à faire » de « pas le droit »

Exemples en place, à conserver :

- Technicien sans client : « Les clients apparaîtront ici dès que vous serez affecté à une
  mission chez eux. » — et non « Aucun client ».
- Technicien sans mission : « Aucune intervention ne vous est confiée pour le moment. »
- `RequirePermission` : nomme le rôle actuel et **qui contacter**.
- `RequirePlan` : distingue « cette offre ne l'inclut pas » de « votre abonnement a expiré ».

### 23.4 Ne jamais proposer une action que le serveur refusera

Trois exemples en place :

- Le formulaire d'édition de mission n'apparaît que sous `mission.update` (le trigger
  bloque l'intervenant sur **tous** les champs concernés).
- « Propriétaire » est retiré de `RoleSelect` pour un non-propriétaire.
- Le retrait et le changement de rôle du dernier propriétaire sont désactivés, **avec
  infobulle expliquant pourquoi**.

Corollaire : **un contrôle désactivé sans explication est un défaut.** Utilisez `Tooltip`.

### 23.5 Confirmation avant l'irréversible

- **Terminer une intervention** — modale de confirmation. `end_time` est posée une fois
  pour toutes.
- **Soumettre un compte rendu** — avertissement affiché au-dessus du bouton.

### 23.6 Accessibilité — non négociable

| Engagement | Où |
|---|---|
| `:focus-visible` visible partout | `index.css` — **ne jamais supprimer sans remplacer** |
| Comportement Radix (focus, `Échap`, ARIA, clavier) | Les primitives. Ne les remplacez pas par des `<div>`. |
| Cibles ≥ 44 px sur mobile | `min-h-touch`, `size="lg"` |
| Un seul `<h1>` par page | `PageHeader` |
| `role="alert"` sur les erreurs de formulaire | `FormError` |
| `role="status"` + `aria-live` sur les chargements | `LoadingScreen` |
| `prefers-reduced-motion` respecté | `index.css` |
| Champs à 16 px sur iOS | `@supports (-webkit-touch-callout: none)` |
| Lien « Aller au contenu principal » | `AppLayout` |
| Libellés masqués mais présents (`hideLabel`) | Toutes les primitives de formulaire |

### 23.7 Deux pièges techniques déjà rencontrés

**① `Select` avec `value=''`.** Radix affiche le **texte de remplacement** quand la valeur
est vide : le filtre annonçait « Sélectionner… » alors qu'il valait « En cours ». Utilisez
une sentinelle non vide (`'any'`, `'active'`…). Aucun test ne peut l'attraper — il n'y a
pas de test montant un composant connecté.

**② `exactOptionalPropertyTypes` est activé.** `{ hint: undefined }` n'est **pas** la même
chose que l'absence de la clé. Utilisez le motif en place :
`{...(x !== undefined ? { key: x } : {})}`, ou l'utilitaire `definedProps`.

### 23.8 Ce que le code interdit structurellement

- Aucune couleur en dur : **tout passe par un token sémantique**.
- Aucune URL en dur : **tout passe par `ROUTES`**.
- Aucun import direct de `@supabase/supabase-js` hors `services/`.
- Aucun import de feature autrement que par son `index.ts`.
- Aucun import statique de composant dans un `src/tools/*/index.ts` (casserait le code
  splitting).

`npm run lint` refuse chacun de ces cas.

---

## 24. Recommandations UX pour Gemini

Priorisées par **valeur métier**, pas par facilité. Chacune est faisable sans toucher au
backend.

### Priorité 1 — Donner un écran aux interventions en cours (B1)

C'est le manque le plus coûteux. Un responsable pilote une entreprise d'intervention sans
pouvoir répondre à « qui est sur le terrain en ce moment ? ».

**La base l'autorise déjà** — `interventions_select_scoped` sert toutes les interventions
de l'organisation à qui détient `intervention.view_all`. **Mais rien côté client ne va la
chercher** : `listInterventions` prend un `missionId`.

**C'est donc une demande à Claude, pas un simple écran à dessiner.** Il faut une fonction
d'API, un hook, une route et une entrée de menu — les quatre sont hors de votre périmètre.
Proposez la maquette et le comportement attendu ; je câble le reste.

### Priorité 2 — Faire remonter les consignes d'accès sur la fiche mission

Aujourd'hui elles sont dans le bloc « Lieu et client », en troisième position. Sur mobile,
c'est trois défilements après l'ouverture. **C'est l'information qui fait gagner une heure
devant une grille fermée.** Elle mérite le haut de l'écran d'intervention.

### Priorité 3 — Rendre l'historique d'affectation lisible d'un coup d'œil

Un refus motivé est enterré sous trois blocs sur `/missions/:id`. Une frise (le composant
`ActivityTimeline` existe et n'est utilisé qu'à un endroit) le rendrait immédiat.

### Priorité 4 — Deux tableaux de bord, pas un compromis

`ProfessionalSummary` distingue déjà les rôles par les tuiles affichées. Poussez plus loin :
un technicien devrait voir **sa prochaine mission en grand**, pas trois compteurs.

### Priorité 5 — Signaler l'archivage réversible

« Archiver » se lit comme « supprimer ». La confirmation devrait dire que c'est réversible,
et la fiche archivée porter une bande visible plutôt qu'un simple `Badge`.

### Priorité 6 — Densité de la liste des membres

Avec 25 membres, une ligne par personne portant nom, fonction, équipes, rôle et deux
commandes devient longue. Un regroupement par équipe, ou une vue compacte, est à étudier.

### Priorité 7 — Rendre visibles les filtres avancés de missions

Le compteur de critères actifs est la seule indication qu'ils existent. Une puce résumant
les filtres posés (« Orange · Équipe Nord · cette semaine ») serait plus parlante qu'un
chiffre.

### Ce sur quoi il ne faut PAS passer de temps

- Refaire la landing ou le marketing — **hors périmètre**.
- Refaire les primitives — **hors périmètre**, et elles fonctionnent.
- Habiller `/references` — il n'y a **aucune donnée** derrière.
- Concevoir un écran de paiement — Stripe est en Phase 12, `subscriptions` est fermée en
  écriture.

---

## 25. Checklist finale

À cocher au fur et à mesure. **Une case vide en fin de travail = une capacité oubliée.**

### 25.1 Les 34 routes ont un traitement visuel décidé

```
Public          [ ] /              [ ] /features      [ ] /pricing      [ ] /faq
Auth            [ ] /login         [ ] /register      [ ] /forgot-password
                [ ] /auth/callback
Catalogue       [ ] /tools         [ ] /tools/:slug   [ ] /categories/:slug
                [ ] /references (état vide assumé)
Compte          [ ] /dashboard     [ ] /favorites     [ ] /history
                [ ] /profile       [ ] /settings
Entrée org      [ ] /organisation/nouvelle            [ ] /invitations/:token
Clients         [ ] /clients       [ ] /clients/:id
Missions        [ ] /missions      [ ] /missions/nouvelle   [ ] /missions/:id
Interventions   [ ] /interventions/:id   [ ] /interventions/:id/rapport
Contrôle        [ ] /controle
Équipes         [ ] /equipes       [ ] /equipes/:id
Entreprise      [ ] /organisation  [ ] /organisation/membres
                [ ] /organisation/facturation          [ ] /journal
Erreur          [ ] *  (NotFoundPage)
```

### 25.2 Les 34 fonctionnalités sont représentées

```
[ ] 1  Catalogue d'outils              [ ] 18 Contacts clients
[ ] 2  Fiche outil + calculatrice      [ ] 19 Sites d'intervention
[ ] 3  Catégories                      [ ] 20 Consignes d'accès (3 écrans)
[ ] 4  Favoris (+ quota free = 3)      [ ] 21 Équipes
[ ] 5  Historique (+ quota free = 10)  [ ] 22 Composition d'équipe et lead
[ ] 6  Authentification                [ ] 23 Missions (+ 6 filtres)
[ ] 7  Retour de lien e-mail           [ ] 24 Machine à états (17 transitions)
[ ] 8  Landing / tarifs / FAQ  ⛔      [ ] 25 Affectation équipe / technicien
[ ] 9  Création d'entreprise           [ ] 26 Historique d'affectation
[ ] 10 Changement d'organisation       [ ] 27 Interventions et chronométrage
[ ] 11 Paramètres d'entreprise         [ ] 28 Compte rendu + photos av./ap.
[ ] 12 Membres et rôles                [ ] 29 Contrôle / validation / refus
[ ] 13 Invitations (lien à copier)     [ ] 30 Tableau de bord (par rôle)
[ ] 14 Acceptation d'invitation        [ ] 31 Journal d'audit
[ ] 15 Rôles et permissions            [ ] 32 Profil          🟡
[ ] 16 Abonnements / entitlements 🟡   [ ] 33 Paramètres      🟡
[ ] 17 Clients (+ archivés/réactiver)  [ ] 34 Références      ⚪
```

### 25.3 Les 6 rôles ont été parcourus mentalement

```
[ ] owner        — voit tout, y compris facturation et journal
[ ] admin        — comme owner, sans billing.manage ni organization.delete
[ ] manager      — pilote, contrôle, mais ni facturation ni journal
[ ] team_leader  — contrôle SANS mission.view_all  ← vérifier /controle
[ ] technician   — 3 permissions, accède pourtant à ses missions et à ses clients
[ ] employee     — organization.view + member.view seulement
```

### 25.4 Les états obligatoires

```
[ ] Chaque liste a loading / error / empty
[ ] Aucun 0 affiché pendant un chargement (— à la place)
[ ] Chaque état vide distingue « rien à faire » de « pas le droit »
[ ] Chaque contrôle désactivé a une infobulle expliquant pourquoi
[ ] Aucun cul-de-sac : toute erreur a un moyen d'en sortir
```

### 25.5 Mobile / terrain

```
[ ] Cibles ≥ 44 px sur tous les écrans d'intervention
[ ] « Terminer l'intervention » séparé de « Pause » ET confirmé
[ ] Photos « avant » et « après » restent deux boutons distincts
[ ] capture="environment" conservé sur les champs de fichier
[ ] Consignes d'accès atteignables en ≤ 2 gestes depuis l'intervention
[ ] Zones sûres iOS / Android respectées sur les éléments fixes
[ ] Champs à 16 px sur iOS (règle @supports conservée)
```

### 25.6 Périmètre respecté

```
[ ] Aucun fichier de supabase/ modifié
[ ] Aucun fichier de features/*/api/ ou features/*/hooks/ modifié
[ ] rbac.ts, entitlements.ts, workflow.ts intacts
[ ] components/ui/ intact
[ ] config/navigation.ts intact
[ ] LandingPage, marketing/, assets/, dashboard/ intacts
[ ] npm run typecheck : 0 erreur
[ ] npm run lint : 0 erreur, 0 avertissement
[ ] npm test : 171 tests, aucun échec
[ ] npm run build : succès
```

### 25.7 Demandes à Claude consignées

```
[ ] Toute route nouvelle est proposée, pas créée
[ ] Toute modification de navigation.ts est proposée, pas faite
[ ] Toute modification d'une primitive est proposée, pas faite
[ ] Chaque demande suit le format : Ce que je veux / Pourquoi / Impact supposé
```

---

## Annexe — repères chiffrés

| | |
|---|---|
| Migrations appliquées | **28** (`local` == `remote`, aucune dérive) |
| Tables | **26** + 3 fonctions RPC |
| Énumérations métier | **13** |
| Rôles × permissions | **6 × 28** |
| Plans × fonctionnalités | **3 × 16** |
| États de mission | **10**, dont 2 terminaux (`closed`, `cancelled`) |
| Transitions | **17** |
| Routes | **33** + `*` |
| Pages | **35** |
| Features | **13** |
| Primitives UI | **17 fichiers**, 30 exports |
| Composants métier | **30 fichiers** |
| Outils de calcul | **6** + gabarit |
| Catégories | **8** |
| Tests | **171**, 24 fichiers |
| Failles de sécurité fermées | **8** |

**État de référence :** `57d5d1b`, branche `phase-2/application-foundation`, 9 août 2026.

> **Un dernier mot.** Ce produit a été construit avec la conviction que la base de données
> est la seule autorité et que l'interface n'a jamais à la contredire. Le design que vous
> allez poser dessus doit **rendre visible** ce que le serveur autorise — ni plus, ni
> moins. Un bouton qui promet ce que le serveur refusera est pire qu'un bouton absent.





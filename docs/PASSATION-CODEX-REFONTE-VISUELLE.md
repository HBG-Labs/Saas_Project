# Passation technique — Refonte visuelle de REZO360 → Codex

Ce document confie à Codex **la conception artistique et l'implémentation
visuelle** de REZO360. Il dit ce qu'est l'application, ce qui ne doit pas
casser, ce qui a été décidé, ce qui reste ouvert, et comment travailler à deux
dans le même dépôt. Lis-le en entier avant la première action.

Interlocuteur : Harry (propriétaire du produit). Il valide chaque étape.
Claude Code coordonne, vérifie, exécute les tests et gère les migrations —
il ne fait pas de design.

---

## 1. La mission, en deux temps

### Première mission — trois directions artistiques, rien d'autre

**Aucune modification du code de production avant validation explicite.**

Concevoir **trois propositions réellement différentes** — pas trois palettes
sur la même interface. Chacune a sa propre logique de composition, sa
typographie, son langage visuel et sa hiérarchie.

Pour chaque direction, cinq écrans en données fictives réalistes :

| Écran | Contenu attendu |
|---|---|
| 1 · Tableau de bord Gestion | Indicateurs d'activité, interventions du jour, équipes, actions prioritaires. |
| 2 · Gestion des interventions | Consulter, organiser, suivre ; statuts immédiatement identifiables. |
| 3 · Finance | Tableau de factures, montants, échéances, actions contextuelles. |
| 4 · Workspace | Documents, notes, organisation de l'information. |
| 5 · Mobile | Une vraie interface de technicien sur le terrain — pas un bureau réduit. |

Livrables par direction : maquettes desktop et mobile, palette, typographies,
exemples de composants, principes de navigation, principes d'accessibilité,
explication des choix.

Les trois sont présentées séparément. Harry choisit.

### Seconde mission — après validation, par étapes

| Étape | Périmètre |
|---|---|
| A · Fondations | Design system, jetons, composants communs, navigation principale. |
| B · Gestion | Tableaux de bord, contacts, sites, équipes, planning, missions, interventions. |
| C · Workspace | Documents, notes, bibliothèque, espaces collaboratifs existants. |
| D · Finance | Devis, factures, achats, fonctionnalités financières existantes. |
| E · Transversal | Portail client, assistant IA, notifications, paramètres, écrans partagés. |
| F · Finalisation | Responsive, accessibilité, performances, cohérence, corrections. |

**Chaque étape est validée avant la suivante.** Claude Code vérifie chaque
livraison (tests, E2E, build, permissions, responsive, console).

---

## 2. Ce qui n'est plus imposé — et ce qui l'est encore

### Libre

La direction artistique précédente (« Papier », bleu `#1B44C8` comme accent,
IBM Plex Sans) **n'est plus imposée**. Les maquettes précédentes existent
(`https://claude.ai/artifact/SZVQqGR3BixkKUA22t3mq5`) : à consulter pour
l'historique, jamais comme contrainte.

Codex peut remettre en question : la palette, le bleu de marque dans
l'interface (le logo officiel, lui, ne change pas), la typographie, les
boutons, les dimensions, la composition des tableaux de bord, l'organisation
des pages, les espacements, les icônes, les micro-interactions.

Inspirations autorisées pour l'ergonomie : Notion, Tiime, autres outils
professionnels — sans reproduire leur identité. REZO360 a la sienne.

À éviter : cartes identiques empilées, dégradés décoratifs, ombres excessives,
éléments sans fonction, tout ce qui ressemble à une sortie automatique. Chaque
choix sert la lisibilité, la compréhension ou l'efficacité.

### Imposé

- **Trois univers** : Gestion, Workspace, Finance. Ils existent en code (§5).
- **Trois modes** : Atelier Jour, Atelier Nuit, Contraste élevé. Leurs couleurs
  peuvent être entièrement redéfinies ; Contraste élevé reste une réponse
  réelle aux besoins de lisibilité, pas une variante.
- **Aucune URL ne change.** Liens profonds et favoris continuent de marcher.
- **Aucune fonctionnalité ne disparaît** (§8). Si une modification fonctionnelle
  semble nécessaire, elle est présentée séparément et attend l'accord de Harry.
- **Mobile-first**, jusqu'à Capacitor (`@capacitor/core` est en place,
  scripts `cap:*` dans `package.json`).
- **Rien du mobile natif n'est supprimé.**

---

## 3. Architecture

### Pile

React 19 · Vite 8 · TypeScript 6 (strict, `exactOptionalPropertyTypes`) ·
Tailwind 4 (pas de `tailwind.config`, `@theme inline` dans
`src/styles/index.css`) · radix-ui · lucide-react · TanStack Query ·
react-hook-form + Zod · react-router v7 · Supabase (Postgres, RLS, Edge
Functions Deno) · Playwright · Vitest.

### Couches, imposées par ESLint

```
pages / components  →  features  →  services  →  lib / config / types
```

`no-restricted-imports` refuse l'import à contre-sens. Une page n'appelle pas
Supabase ; elle passe par un hook de `features/<domaine>`.

### Organisation

```
src/
  app/            router.tsx (626 lignes, toutes les routes), providers, App
  config/         routes.ts (ROUTES, ROUTE_PATTERNS), navigation.ts (sections,
                  UNIVERSES), technician-navigation.ts, industries.ts
  components/
    ui/           23 primitives (Button, Card, Input, Select, Modal, Tabs,
                  Table, Toolbar, DataView, Badge, Skeleton, MetricCard…)
    layout/       AppLayout, Sidebar, MobileNav, MobileDrawer, PageHeader,
                  PageShell, PublicLayout, RootLayout
    feedback/     EmptyState, ErrorState, LoadingScreen, Toast, ErrorBoundary
    dashboard/    OwnerDashboard, ManagerDashboard, TechnicianDashboard,
                  FirstStepsCard
    guards/       RequireOrganization, RequirePermission, RequirePlan,
                  RequirePlatformAdmin
    marketing/    site vitrine (Hero, Pricing, Faq…) — hors application
  features/       un dossier par domaine : api/ hooks/ components/ types/
                  (ai analytics auth billing client-portal customers documents
                  einvoicing equipment interventions invoices missions notes
                  notifications organizations planning portal purchases quotes
                  search settings stock teams theme tools training vehicles…)
  pages/          une page par route, groupées par domaine
  styles/         index.css — LA source des jetons (674 lignes commentées)
  types/          database.ts — miroir MANUEL du schéma Supabase
supabase/
  migrations/     166 fichiers, immuables une fois appliqués
  functions/      31 Edge Functions
  tests/          18 suites SQL, transaction annulée, base liée
e2e/              Playwright ; fixtures/supabase.ts = faux PostgREST
```

### Thèmes

`ThemeProvider` pose les variables d'un preset en ligne sur `<html>` et une
classe `dark`. Les deux thèmes signature ne déclarent **aucune** variable :
ils lisent `index.css` (`:root` et `.dark`). Seul Contraste élevé déclare les
siennes. `theme-presets.test.ts` échoue si un preset diverge du CSS.

Neuf nuances d'accent (`accent-colors.ts`), trois jeux de variables chacune
(clair, sombre, contraste), surchargent `--primary*` et `--ring`. Si la
nouvelle direction change la couleur d'accent, ce fichier est à recalculer —
il est **mesuré**, pas dessiné (voir ses commentaires).

---

## 4. Fichiers qui font foi

| Fichier | Rôle |
|---|---|
| `src/styles/index.css` | Tous les jetons. Chaque valeur est commentée avec sa raison et son ratio. |
| `src/config/navigation.ts` | Sections, entrées, univers. `useVisibleNavGroups` filtre par formule et rôle. |
| `src/config/routes.ts` | `ROUTES` et `ROUTE_PATTERNS`. Ne pas en changer une seule. |
| `src/app/router.tsx` | L'arbre complet, avec les gardes (`RequirePermission`, `RequirePlan`…). |
| `src/components/layout/Sidebar.tsx` | Barre latérale, sélecteur d'univers, accordéon. |
| `src/components/layout/MobileNav.tsx` | Barre basse mobile : 5 destinations filtrées par droits. |
| `src/features/organizations/rbac.ts` | 6 rôles × 58 permissions — miroir TS du SQL, verrouillé par test. |
| `src/features/billing/entitlements.ts` | 5 formules × 26 fonctionnalités — idem. |
| `src/types/database.ts` | Miroir manuel du schéma. Une table ajoutée en migration s'ajoute ici. |
| `eslint.config.js` | Règles de couches et règle des jetons (bloc « jetons de design »). |
| `e2e/fixtures/supabase.ts`, `donnees.ts` | Faux PostgREST et jeu de données de référence. |
| `docs/DESIGN_SYSTEM.md` | Le document de référence précédent — historique, plus de valeur normative. |

---

## 5. Routes et univers

**Les univers sont une couche de navigation.** Un univers ne possède aucune
route : il range des sections. `NavGroup.universe` vaut `'gestion'`,
`'finance'`, `'workspace'` ou est absent (transversal = visible partout).

| Univers | Sections (`SIDEBAR_GROUPS`) |
|---|---|
| Gestion | Interventions (dashboard, missions, planning, carte, clients, statistiques, rapports, archives) · Stock · Administration |
| Finance | Ventes & facturation (devis, factures) · Achats (commandes, fournisseurs) |
| Workspace | Documents & formation (bloc-notes, bibliothèque, tutoriels) |
| Transversal | Boîte à outils (catalogue, favoris, assistant IA, outils métiers) · Compte |

L'univers actif se déduit de la route courante (un lien profond vers `/devis`
ouvre Finance), sinon d'un choix manuel sur cette page, sinon du dernier choix
mémorisé (`localStorage` `rezo360-universe`).

La barre technicien (`technician-navigation.ts`) ne déclare aucun univers :
pas de sélecteur, toutes ses sections visibles. `/dashboard` est l'accueil
unique — pas d'accueil par univers (arbitrage B, validé).

**Deux exigences de Harry pour la refonte :**

1. **Le changement d'univers doit rester accessible barre repliée et sur
   mobile.** Aujourd'hui le sélecteur disparaît quand la barre est repliée
   (trop étroite pour trois libellés) et n'existe pas dans la barre basse
   mobile. C'est à concevoir dans la nouvelle direction.
2. **Un test de permissions doit sélectionner l'univers avant de vérifier
   une visibilité.** Depuis les univers, une absence peut venir du volet
   actif et non du droit. Voir `e2e/parcours/09-univers.spec.ts` pour la
   façon de sélectionner, et `01-session.spec.ts` pour la règle « prouver
   la présence attendue avant d'asserter une absence ».

Routes principales (extraits de `routes.ts`) : `/dashboard` `/missions`
`/missions/:id` `/interventions/:id` `/planning` `/carte` `/clients`
`/equipes` `/stock` `/equipements` `/achats/commandes` `/achats/fournisseurs`
`/devis` `/factures` `/factures/recues` `/bibliotheque` `/bloc-notes`
`/tutoriels` `/tools` `/metiers` `/assistant-ia` `/organisation/*`
`/portail/*` (portail client, session séparée) `/admin/prospection/*`
(administration plateforme).

---

## 6. Permissions — la règle qui gouverne tout

**Toute autorisation vit en PostgreSQL.** Le client ne décide jamais ; il
reflète. `app.can_use_pro_module(org, feature) = app.is_org_member(org) AND
app.org_has_feature(org, feature)`. Une politique RLS par commande, jamais
`FOR ALL`. Les règles « ce changement est-il permis » sont des triggers.

Côté client, trois miroirs verrouillés par des tests qui lisent les
migrations : `rbac.ts` (rôles × permissions), `entitlements.ts` (formules ×
fonctionnalités), `workflow.ts` (transitions d'état).

Dans la navigation, deux champs qui ne font pas la même chose :

- `feature` laisse l'entrée **visible, cadenassée** pour qui n'a pas la
  formule — cacher le module reviendrait à cacher le produit.
- `permission` **retire** l'entrée pour qui n'a pas le rôle — un cadenas
  promettrait une porte qui ne s'ouvrira jamais.

`ResolvedNavItem.locked` se calcule au rendu, jamais en dur.

Rôles (`ORG_ROLES`) : owner, admin, manager, team_leader, technician,
employee. Formules (`PLAN_CODES`) : free, starter, pro, business, enterprise. **Les
clients existants gardent leurs droits contractuels** : ne pose aucune
nouvelle restriction (D6).

---

## 7. Contraintes Supabase

- **Une migration appliquée est immuable.** Toute évolution = nouveau fichier
  horodaté. Ne jamais retoucher un fichier existant, même pour une coquille
  (`AGENTS.md`, `supabase/README.md`).
- **La refonte visuelle ne touche ni schéma, ni RLS, ni trigger, ni Auth.**
  Si un écran semble exiger une donnée absente, c'est un signal à remonter.
- **Aucune écriture en production.** `npm run dev` lit `.env.local` — le
  projet réel. Les E2E tournent sur un build de production servi port 5199
  avec l'origine factice `https://test-project.supabase.co`, interceptée par
  `e2e/fixtures/supabase.ts`. C'est le seul environnement où un parcours
  peut « écrire ».
- **Les secrets restent côté serveur.** Rien de plus que la clé publiable
  dans le client.
- Les migrations et `npm run test:sql` sont exécutés par Claude Code, après
  autorisation de Harry. Pas par Codex.

Migration en attente au moment de cette passation :
`20260927090000_notification_states.sql` (état lu/écarté des
notifications). Le front la précède sans risque — repli `localStorage` si
la table manque.

---

## 8. Fonctionnalités à préserver — sans exception

Organisations et utilisateurs · rôles et permissions · contacts et sites ·
équipes et personnel · planning, missions, interventions · comptes rendus et
signatures · pièces jointes et documents · stocks et matériel · devis et
factures · facturation électronique (SUPER PDP, réception) · relances ·
portail client · messagerie · assistant IA · bibliothèque technique ·
paramètres et abonnements (Stripe RÉEL) · outils universels et métiers ·
tutoriels · Prospect Radar (administration plateforme) · PWA et mobile natif.

**Ne supprime pas une fonctionnalité pour simplifier une interface.** Une
refonte visuelle n'est pas un développement fonctionnel : distingue ce qui
existe de ce qui reste à construire (espaces/pages/tâches du Workspace,
paiements de Finance sont en phases ultérieures — ne les invente pas).

---

## 9. Décisions déjà validées par Harry

| Décision | Contenu |
|---|---|
| Trois univers comme couche de navigation | Aucune URL ne change ; tout reste atteignable. |
| Achats dans Finance ; Boîte à outils transversale | Validé le 20/09/2026. |
| `/dashboard` accueil unique | Pas d'accueil par univers. |
| Notifications : état persisté, dérivation conservée | Table `notification_states`, pas de pipeline d'événements. |
| Barre basse mobile inchangée en phase 2 | Codex peut la repenser dans la nouvelle direction ; c'est alors une proposition. |
| Trois modes d'affichage | Jour, Nuit, Contraste élevé — couleurs libres, exigences d'accessibilité maintenues. |
| Pas de nouvelles restrictions d'accès | Droits contractuels préservés. |
| Mobile : PWA prioritaire, natif préservé | Compatible Android/iOS à venir. |
| Densité adaptée par univers, identité commune | Gestion reste dense — un tableau de douze lignes vaut mieux qu'une carte qui en montre trois. |

---

## 10. Vérification et commandes

```bash
npm run lint            # couches + règle des jetons
npm run typecheck       # tsc -b --force — plus strict que tsc --noEmit
npm run test            # Vitest, ~3 min
npm run test:e2e        # Playwright : build de prod + parcours, ~2 min
npm run build           # /_design doit être absent de dist/
```

Référence au moment de la passation : **1 264 tests unitaires, 102 E2E**
(4 ignorés sur mobile, par conception). Ces chiffres ne prouvent rien pour
la suite : chaque livraison est réexécutée.

Règles :

- **Ne jamais annoncer un test réussi sans l'avoir exécuté.**
- **Ne pas désactiver ni supprimer un test** pour obtenir un vert. Adapter
  uniquement ceux dont l'attente visuelle ou structurelle change
  légitimement, et le dire dans le commit.
- Un test nouveau se prouve : injecter une valeur fausse, constater l'échec,
  restaurer.
- Pour regarder un écran réel sans toucher la base : spec Playwright
  temporaire avec `installeSupabase(page, { role: 'owner' })` +
  `page.screenshot()`. Supprimer la spec après.

Contrôles que Claude Code fait après chaque étape : unitaires, E2E,
permissions (avec sélection d'univers), navigation et liens profonds,
responsive (375 px et 1280 px, `08-responsive.spec.ts`), accessibilité
(contrastes `palette.test.ts`, noms accessibles, focus visible, cibles 44 px),
console sans erreur, build de production.

---

## 11. Risques connus

1. **`DataView` n'a qu'un consommateur : la galerie `/_design`.** Son API est
   relevée sur `SuppliersTable`, jamais confrontée à un écran métier. Elle
   bougera. Codex est libre de la remplacer.
2. **23 écrans écrivent leur propre `<table>`, 29 pages leur propre coque.**
   Inventaire dans le registre `DETTE` d'`eslint.config.js` (~35 fichiers).
   Chaque fichier migré doit en sortir, et le lint passer sans lui.
3. **Le thème sombre est calibré contre `#0e1b36`** — les 27 jeux d'accent
   aussi. Changer l'un impose de recalculer l'autre.
4. **`font-mono` est employé 483 fois**, bien au-delà des identifiants.
   Signe d'un langage visuel jamais fixé : la nouvelle direction doit dire
   où le mono s'arrête.
5. **La barre latérale et la barre basse ne partagent pas leur configuration**
   (`navigation.ts` vs `MOBILE_NAV_CANDIDATES`). Une refonte de la navigation
   doit garder les deux cohérentes ; `navigation.test.ts` vérifie plusieurs
   invariants (bibliothèque atteignable des deux côtés, une seule section
   d'outils…).
6. **Les tests d'absence** deviennent trompeurs avec les univers (voir §5).
7. **`check:deploy` échoue sur des fichiers non suivis de Harry** (`demo/`,
   `playwright.demo.config.ts`, `scripts/*-commercial-demo.mjs`). Ce n'est
   pas à Codex de les traiter.
8. **Le site vitrine** (`LandingPage`, `PricingPage`, `components/marketing`)
   a sa propre typographie (Archivo, Caveat). Hors périmètre sauf demande.

---

## 12. Travailler à deux dans le même dépôt

Claude Code mène en parallèle les phases fonctionnelles (3 → 8). Territoires :

| Territoire | Propriétaire |
|---|---|
| `src/styles/**`, `src/features/theme/**`, `src/components/ui/**`, `src/components/layout/**` (visuel) | **Codex** |
| `src/pages/**`, `src/features/*/components/**` (visuel des écrans) | **Codex** |
| `src/config/navigation.ts` (structure), `src/config/routes.ts`, `src/app/router.tsx` | **Claude Code** — Codex propose, Claude applique |
| `src/features/*/api/**`, `src/features/*/hooks/**`, `src/services/**`, `src/types/**` | **Claude Code** |
| `supabase/**`, `e2e/fixtures/**` | **Claude Code** |
| `e2e/parcours/**` | Partagé : Codex adapte les sélecteurs qu'il change, Claude vérifie |

**Jamais `git add -A`.** Harry édite en parallèle ; des fichiers non suivis
lui appartiennent. Stage fichier par fichier. Un commit par écran ou par
composant, avec un message qui dit la cause, pas seulement l'effet — les
commits existants sont le modèle.

Si un fichier de l'autre colonne doit bouger : le dire à Harry avant.

---

## 13. Rendre compte

À la fin de la première mission : trois directions, présentées séparément,
avec les livrables du §1. Rien dans le code de production.

À chaque étape de la seconde mission : ce qui a été touché, ce qui a été
adapté dans les tests et pourquoi, les quatre commandes du §10 vertes, et
la liste des points laissés ouverts pour Harry.

Ce qui compte comme « terminé » : lint sans exemption, typecheck, tests,
E2E, build — exécutés, pas supposés.

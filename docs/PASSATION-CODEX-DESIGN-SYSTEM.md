# Passation — Phase 1 « Design system » → Codex

Ce document confie à Codex la **totalité de la phase 1** du plan de transformation
REZO360. Il dit ce qui a été décidé, ce qui existe, ce qui reste, et ce qui ne se
négocie pas. Lis-le en entier avant la première modification.

Interlocuteur : Harry (propriétaire du produit). Il valide les arbitrages et
tranche ce qui est jugement. Il travaille dans le dépôt en même temps que toi.

---

## 1. La mission

Prendre en charge la phase 1 de bout en bout : le système de design de
l'application, jusqu'à ce que **plus aucun écran n'écrive de couleur, de classe
de palette ou de taille de police en dehors des jetons**.

Ce qui est déjà fait est vérifié (tests, E2E, mesures de contraste). Tu peux le
revisiter — mais tout ce que tu changes doit laisser les garde-fous verts, et
toute valeur que tu poses doit être mesurée, pas choisie à l'œil.

## 2. Les décisions validées — ne pas les rouvrir

Ces arbitrages ont été pris par Harry. Ils s'appliquent tels quels.

- **Identité « Papier »** (direction B) pour les trois univers. Neutre chaud,
  encre noire, bleu REZO `#1B44C8` pour les actions principales. Densité de la
  direction A conservée pour l'univers Gestion.
- **Une seule famille dans l'application : IBM Plex Sans.** JetBrains Mono est
  réservée aux identifiants (références, codes). Archivo et Caveat ne servent
  qu'au site vitrine (`LandingPage`, `PricingPage`, `components/marketing`) —
  ne les retire pas, ne les fais pas entrer dans l'application.
- **Trois thèmes** : Atelier Jour (`default`), Atelier Nuit (`atelier-nuit`),
  Contraste élevé (`contraste-eleve`). Les anciens sont migrés par
  `THEMES_RETIRES`.
- **Neuf nuances d'accent, toutes bleues**, à iso-contraste autour du bleu REZO.
  `auto` = bleu REZO. Migration par `ACCENTS_RETIRES`. Les couleurs
  fonctionnelles (succès, avertissement, erreur, information) ne se
  personnalisent pas.
- **Aucune restructuration d'URL.** Liens profonds, favoris et routes existants
  sont préservés.
- **Rien du mobile natif n'est supprimé.** PWA prioritaire, mais compatible avec
  Android/iOS à venir (Capacitor est en place).
- **La refonte visuelle ne touche ni schéma, ni politique RLS, ni trigger.**

## 3. Ce qui existe

Quatre commits, dans l'ordre. Chacun est vérifié : lint, `tsc -b`, 1 249 tests
Vitest, 100 parcours Playwright sur un build de production.

| Commit | Contenu |
|---|---|
| `b4f3cb7` | Trois thèmes au lieu de douze. `theme-presets.ts` ne déclare des variables que pour Contraste élevé ; les deux thèmes signature lisent `index.css`. |
| `c1de617` | Neuf nuances de bleu. `accent-colors.ts` porte trois jeux par nuance (clair, sombre, contraste). |
| `461cec4` | Quatre primitives : `Table`, `Toolbar`, `DataView`, `PageShell`. Galerie `/_design` (développement seulement). |
| `20dd375` | Neutre papier dans `index.css`. `palette.test.ts` croise dix encres × six surfaces × deux thèmes. |
| `c9eb671` | Barre latérale en bleu REZO. |

### Les fichiers qui font foi

- `src/styles/index.css` — **la seule source de la palette.** Tout thème, tout
  composant en descend. Les commentaires y expliquent chaque valeur.
- `src/features/theme/accent-colors.ts` — les neuf nuances.
- `src/features/theme/theme-presets.ts` — les trois thèmes.
- `src/components/ui/` — 25 primitives, **zéro valeur en dur** (mesuré).
- `src/components/layout/PageShell.tsx`, `PageHeader.tsx` — la coque de page.
- `src/pages/dev/DesignGalleryPage.tsx` — la galerie. Route `/_design`,
  conditionnée par `import.meta.env.DEV`, absente du paquet compilé (vérifié).
- `eslint.config.js`, bloc « jetons de design » — la règle et le registre de
  dette. **C'est ton plan de travail.**

### Les tests qui te protègent

| Test | Ce qu'il garantit |
|---|---|
| `src/styles/palette.test.ts` | Chaque encre ≥ 4,5:1 sur chacune des six surfaces, `--border-strong` ≥ 3:1, dans les deux thèmes. |
| `src/features/theme/accent-colors.test.ts` | Chaque nuance lisible dans les trois thèmes ; ne touche que les six variables d'accent ; migration injective. |
| `src/features/theme/theme-presets.test.ts` | Un preset ne diverge jamais de `index.css` ; `BROWSER_BAR_COLOR` suit le fond. |
| `src/components/ui/DataView.test.tsx` | Cartes et tableau rendent les mêmes données et le même état vide. |
| `e2e/parcours/08-responsive.spec.ts` | Aucun débordement horizontal sur les écrans clés, à 375 px et 1280 px. |

Ces tests ont trouvé de vrais défauts (bordure de champ à 1,76:1, quatre
accents sous le seuil). Ils ne sont pas décoratifs ; ne les affaiblis pas pour
faire passer une valeur.

## 4. Ce qui reste — l'étape 4

Migrer les écrans, famille par famille, sur les jetons et les primitives.

### Le registre de dette

Dans `eslint.config.js`, le tableau `ignores` sous le commentaire `DETTE` liste
les fichiers exemptés de la règle. **Chaque fichier que tu migres doit sortir
du registre**, et le lint doit passer sans lui. C'est la seule preuve acceptée
qu'un fichier est propre.

Ne touche pas aux lignes sous `LÉGITIME` : la couleur y est une donnée (codes
couleur fibre et cuivre, carte, lampe torche, signature, bouton Google).

Fichiers en dette à la date de cette passation :

```
src/components/marketing/Categories.tsx        ← vitrine, Archivo autorisée
src/components/marketing/Faq.tsx               ← vitrine
src/components/marketing/Hero.tsx              ← vitrine
src/components/marketing/Pricing.tsx           ← vitrine
src/components/pricing/PricingSimulator.tsx    ← vitrine
src/features/ai/components/AiChatBox.tsx
src/features/ai/components/AiSearchHistoryDrawer.tsx
src/features/client-portal/components/CustomerMessagingPanel.tsx
src/features/interventions/components/InterventionPdfModal.tsx
src/features/metiers-tools/components/MetierToolCard.tsx
src/features/metiers-tools/components/MetierToolRunner.tsx
src/features/metiers-tools/registry.ts         ← `accentColor` par outil : décider si c'est une donnée
src/features/notifications/components/NotificationBell.tsx   ← voir §6, coordination
src/features/planning/components/PublicHolidaysTab.tsx
src/features/portal/components/PortalLayout.tsx
src/features/stock/types/stock.types.ts
src/features/tools/components/ToolReferences.tsx
src/features/tools/field/compass/**
src/features/tools/field/voice-recorder/**
src/pages/LandingPage.tsx                      ← vitrine
src/pages/PricingPage.tsx                      ← vitrine
src/pages/ProfilePage.tsx
src/pages/analytics/AnalyticsPage.tsx
src/pages/invoices/InvoiceDetailPage.tsx
src/pages/metiers/MetierToolPage.tsx
src/pages/organization/BillingPage.tsx
src/pages/planning/PlanningPage.tsx
src/pages/portal/PortalHomePage.tsx
src/pages/portal/PortalLoginPage.tsx
src/pages/portal/PortalMessagesPage.tsx
src/pages/quotes/QuoteDetailPage.tsx
src/pages/quotes/QuotesPage.tsx
src/pages/training/TutorialDetailPage.tsx
src/pages/training/TutorialsPage.tsx
```

Mesure au départ : `npx eslint . 2>&1 | grep -c "jetons"` après avoir vidé
temporairement le registre te donne le vrai décompte. Ne fais pas confiance à
une estimation.

### Les 23 tableaux

Vingt-trois fichiers écrivent leur propre `<table>` ; quatre portent la même
chaîne de classes au caractère près. Ils sont faits pour `DataView` (liste avec
version téléphone) ou `Table` (tableau seul). Commence par `SuppliersTable.tsx`
(`src/features/purchases/components/`) : c'est de lui que l'API de `DataView`
a été relevée.

### Les 29 coques de page

Vingt-neuf pages ouvrent sur `<div className="mx-auto max-w-Nxl space-y-N pb-N">`.
Remplace par `<PageShell width="Nxl">`. La largeur est un choix, le rythme
vertical ne l'est plus.

## 5. Deux jugements laissés ouverts

Ce sont des choix, pas des règles. Fais-les remonter à Harry avant de trancher.

1. **`DataView` n'a qu'un consommateur : la galerie.** Son API est relevée sur
   `SuppliersTable`, mais elle n'a pas encore rencontré un écran métier. Elle
   bougera probablement au premier — notamment sur les filtres, que chaque
   écran gère avec ses propres règles. C'est attendu.

2. **Le thème sombre est resté marine froid** (`#0e1b36`) alors que le clair est
   papier chaud. **C'est voulu** : les 27 jeux de variables d'accent sont
   calibrés contre ce marine. Réchauffer le sombre impose de recalculer les
   neuf nuances — pas seulement les surfaces. Si Harry le veut, c'est un
   chantier à part, avec sa propre vérification.

## 6. Ce qui ne se négocie pas

**Aucune écriture sur la base de production.** Les E2E tournent sur un build de
production servi sur le port 5199 avec une origine Supabase factice
(`https://test-project.supabase.co`), interceptée par `e2e/fixtures/supabase.ts`.
`npm run dev` lit `.env.local`, qui pointe sur le projet réel : ne lance jamais
un test ou un script d'écriture contre lui.

**Aucun schéma, aucune politique RLS, aucun trigger.** La phase 1 est visuelle.
Si un écran semble exiger une donnée qui n'existe pas, c'est un signal à
remonter, pas une migration à écrire.

**Jamais `git add -A`.** Harry édite en parallèle ; des fichiers non suivis lui
appartiennent (`demo/`, `playwright.demo.config.ts`, `scripts/*-commercial-demo.mjs`).
Stage fichier par fichier.

**Jamais annoncer un test réussi sans l'avoir exécuté.** Et quand un test est
nouveau, prouve qu'il se déclenche : injecte une valeur fausse, constate
l'échec, restaure.

**Aucune valeur choisie à l'œil.** Une couleur se résout pour un ratio, en
OKLCH pour rester dans la famille, et se vérifie contre les six surfaces. Les
scripts qui ont produit la palette sont décrits dans les commentaires
d'`index.css` ; refais le calcul plutôt que d'ajuster à la main.

**Ne pas recréer ce qui existe.** Avant d'écrire un composant, cherche-le :
`EmptyState`, `PageHeader`, `MetricCard`, `SegmentedControl`, `Skeleton`
existaient déjà. La galerie et `src/components/ui/index.ts` sont l'inventaire.

### Coordination avec la phase 2

Une autre session (Claude) mène en parallèle la **phase 2 — navigation,
accueil, notifications**. Pour ne pas se marcher dessus :

| Territoire | Propriétaire |
|---|---|
| `src/styles/**`, `src/features/theme/**`, `src/components/ui/**` | **Codex** |
| Migration des écrans du registre de dette | **Codex** |
| `src/config/navigation.ts`, structure de `Sidebar.tsx` et `MobileNav.tsx` | **Claude** |
| `src/features/notifications/**` (dont `NotificationBell.tsx`, pourtant en dette) | **Claude** |
| `src/pages/DashboardPage.tsx` et `src/components/dashboard/**` | **Claude** |

Si tu dois toucher un fichier de l'autre colonne, dis-le à Harry avant.

## 7. Les commandes

```bash
npm run lint            # la règle des jetons est dedans
npm run typecheck       # tsc -b --force — plus strict que tsc --noEmit
npm run test            # Vitest, ~3 min, 1 249 tests
npm run test:e2e        # Playwright, build de prod + 100 parcours, ~2 min
npm run build           # vérifie aussi que /_design n'est pas dans dist/
```

Pour prouver qu'une ligne du registre est morte : retire-la, lance
`npx eslint <fichier>`. Si c'est propre, la ligne était morte. Sinon, la règle
te dit exactement quoi corriger.

Pour regarder un écran réel sans toucher la base : une spec Playwright
temporaire avec `installeSupabase(page, { role: 'owner' })` puis
`page.screenshot()`. Le commit `20dd375` décrit le procédé. Supprime la spec
après.

## 8. Comment rendre compte

À chaque fichier sorti du registre : le commit dit ce qui a été remplacé par
quoi, et pourquoi quand ce n'est pas évident. Les messages de commit existants
sont le modèle — ils expliquent la cause, pas seulement l'effet.

À la fin : le registre `DETTE` est vide, `npm run lint` passe sans exemption,
et les quatre commandes du §7 sont vertes. Rien d'autre ne compte comme
« terminé ».

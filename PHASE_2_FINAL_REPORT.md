# NexoraTech — Rapport de fin de Phase 2

**Date :** 7 août 2026
**Périmètre :** Design System, identité visuelle, bibliothèque de composants, interfaces publiques et applicatives
**Statut :** PHASE 2 — READY FOR REVIEW

---

## 0. Décisions prises avant implémentation

Quatre choix conditionnaient tout le reste et ont été arbitrés avec toi avant la
première ligne de code.

| Sujet | Décision | Conséquence |
|---|---|---|
| Primitives accessibles | **`radix-ui` (package unique)** | Une seule dépendance couvre Modal, Dropdown, Tooltip, Select, Tabs, Switch, Checkbox, Accordion, Avatar. Coder à la main un focus trap correct représente ~1500 lignes d'accessibilité délicate. |
| Identité chromatique | **Bleu technique profond** + accent cyan | Précision et fiabilité, registre Linear/Stripe. Neutre pour un public technique mixte. |
| Mode sombre | **Système + bascule manuelle** | Les deux thèmes sont conçus simultanément, pas rétro-adaptés. |
| Pricing / témoignages | **Structure + placeholders explicites** | Aucun tarif ni avis client inventé — voir §6. |

---

## 1. Composants créés

### 1.1 Primitives — `src/components/ui/` (20 fichiers)

| Composant | Base | Points notables |
|---|---|---|
| `Button` | natif + `Slot` | 6 variantes, 5 tailles, `isLoading` avec `aria-busy`, `asChild` pour styler un `<Link>` sans imbrication invalide |
| `Input` | natif | Libellé/aide/erreur reliés par `htmlFor` et `aria-describedby`, `hideLabel` pour les cas visuellement sobres |
| `Textarea` | natif | Redimensionnement vertical seul (l'horizontal casserait la mise en page) |
| `Select` | Radix | Préféré au `<select>` natif, instylable de façon cohérente entre OS |
| `Checkbox` | Radix | Gère l'état indéterminé |
| `Switch` | Radix | Distinct de la case à cocher : effet immédiat, sans validation |
| `Badge` | — | 8 variantes sémantiques |
| `Avatar` | Radix | Initiales en repli, sans clignotement au chargement de l'image |
| `Tooltip` | Radix | Visible au focus clavier, pas seulement au survol |
| `Dropdown` | Radix | `data-highlighted` couvre survol **et** navigation clavier |
| `Modal` | Radix | Focus trap, `Échap`, verrouillage du défilement, `title` obligatoire |
| `Tabs` | Radix | Motif ARIA complet, liste défilante sur mobile |
| `Card` (+5 sous-composants) | — | Élévation par ombre en clair, par clarté de surface en sombre |
| `Skeleton` (+2 variantes) | — | Reproduit la forme du contenu attendu pour éviter le saut de mise en page |
| `Kbd` | — | Rend les raccourcis découvrables |
| `StatCard` | — | `tabular-nums` obligatoire sur les valeurs |
| `ActivityTimeline` | — | Trait vertical décoratif, masqué aux lecteurs d'écran |
| `button-variants` / `icons` | — | Fichiers séparés pour préserver Fast Refresh |

### 1.2 Composants applicatifs

| Composant | Emplacement | Rôle |
|---|---|---|
| `AppLayout` | `components/layout/` | Ossature connectée : 3 modèles de navigation selon la largeur |
| `PublicLayout` | `components/layout/` | Ossature marketing + pied de page |
| `Sidebar` | `components/layout/` | Persistante ≥ `lg`, en tiroir sur mobile |
| `MobileNav` | `components/layout/` | Navigation basse, zone d'atteinte du pouce |
| `PageHeader` | `components/layout/` | Porte l'unique `<h1>` de chaque page |
| `Logo` | `components/layout/` | Contraste typographique, pas de logotype improvisé |
| `CommandBar` | `features/search/` | Palette ⌘K sur `cmdk` + `Dialog` Radix |
| `ThemeToggle` / `ThemeProvider` | `features/theme/` | Trois états : clair, sombre, système |
| `ToolCard` / `CategoryCard` | `features/tools/components/` | Cartes de catalogue |
| `EmptyState` / `ErrorState` | `components/feedback/` | États vides et erreurs de section |
| `AuthCard` / `FormError` | `features/auth/components/` | Enveloppe commune aux 3 écrans d'auth |

### 1.3 Sections marketing — `src/components/marketing/` (8 fichiers)

`Hero`, `Categories`, `Features`, `Benefits`, `Testimonials`, `Pricing`, `Faq`,
`Section`. Chacune est autonome et réordonnable sans toucher aux autres.

---

## 2. Pages livrées

### Publiques
- **Landing** — héro avec aperçu de valeurs techniques, catégories, 6
  fonctionnalités, 3 profils métier, témoignages, tarifs, 6 questions FAQ,
  appel à l'action, pied de page.
- **Connexion** — formulaire validé, affichage/masquage du mot de passe, retour
  vers la page initialement demandée.
- **Inscription** — 4 champs, confirmation du mot de passe, écran de
  confirmation e-mail.
- **Mot de passe oublié** — formulation neutre volontaire (voir §6.3).

### Applicatives
- **Tableau de bord** — 4 indicateurs, activité récente, favoris, catégories.
- **Catalogue** — recherche (titre, description, mots-clés) + filtres par
  catégorie.
- **Détail outil** — 3 onglets, outil avant la documentation, favori,
  `ToolErrorBoundary`.
- **Catégorie**, **Favoris**, **Historique**, **Références**, **Profil**,
  **Paramètres**.

---

## 3. Décisions design notables

### 3.1 OKLCH plutôt qu'hexadécimal

Toutes les couleurs sont définies en OKLCH, espace **perceptuellement
uniforme** : deux couleurs de même clarté `L` sont perçues aussi lumineuses
quelle que soit leur teinte. Générer une variante sombre revient donc à ajuster
`L` sans que les rapports de contraste dérivent — impossible à garantir en HSL.

### 3.2 Le bleu est éclairci en thème sombre

`primary-500` passe de `oklch(58%)` en clair à `oklch(62%)` en sombre. Réutiliser
la valeur claire produirait un bleu qui « bave » sur le fond : un bleu saturé ne
reste lisible sur fond sombre que si sa clarté remonte.

### 3.3 Fond sombre à 14 %, jamais `#000`

Le noir pur crée un halo autour du texte clair (éblouissement de contraste) et
supprime toute possibilité de hiérarchie par élévation.

### 3.4 14 px dans l'application, 16 px sur la landing

Les outils professionnels denses (Linear, Stripe, Figma) utilisent 13–14 px :
l'utilisateur est proche de l'écran et concentré, et la densité est un service.
Le lecteur d'une page d'accueil est plus distant et moins engagé — la landing
remonte donc à 16 px.

### 3.5 Navigation basse sur mobile

Sur un téléphone tenu à une main, le haut de l'écran est hors d'atteinte du
pouce. Les destinations fréquentes sont en bas ; le tiroir latéral ne sert
qu'au reste.

### 3.6 L'élévation change de mécanisme selon le thème

En clair, elle passe par l'ombre. En sombre, par la **clarté de surface** : une
ombre noire sur fond sombre est invisible.

### 3.7 Champs à 16 px sur iOS

Safari iOS zoome automatiquement sur un champ dont la police est inférieure à
16 px, ce qui désoriente. C'est la seule exception assumée à la règle des 14 px,
appliquée via `@supports (-webkit-touch-callout: none)`.

### 3.8 Aucun logotype graphique

Un symbole mal dessiné nuit plus qu'il n'apporte. Le contraste typographique
entre **Nexora** et **Tech** suffit à créer une identité reconnaissable, et
laisse le champ libre à un vrai travail de marque.

---

## 4. Trois défauts trouvés et corrigés en cours de route

### 4.1 Bug de validation d'e-mail — trouvé par un test

`z.email().trim().toLowerCase()` valide la chaîne **brute** puis la nettoie. Une
adresse saisie avec un espace final — fréquent avec la saisie prédictive
mobile — était donc rejetée comme « invalide ».

Corrigé en inversant l'ordre via `.pipe()` : on normalise, puis on valide.

```ts
z.string().trim().toLowerCase().pipe(z.email({ error: '…' }))
```

C'est précisément le type de bug que les tests de schéma servent à attraper :
il n'aurait été découvert qu'en production, sur un rapport utilisateur confus.

### 4.2 Page sans `<h1>` — trouvé par un test de routing

Les pages « outil introuvable » et « catégorie introuvable » rendaient un
`EmptyState`, dont le titre est un `<p>`. Résultat : des pages entières sans
titre de niveau 1, impossibles à situer avec un lecteur d'écran.

Corrigé en composant `PageHeader` (qui porte le `<h1>`) **avec** `EmptyState`,
plutôt qu'en ajustant l'assertion du test.

### 4.3 Rendu en cascade dans le ThemeProvider — trouvé par ESLint

`resolvedTheme` était stocké dans un état synchronisé par un effet. Le
compilateur React a signalé le `setState` synchrone dans un effet. Au-delà de la
performance, cela faisait **retarder la valeur d'un cycle de rendu**.

Corrigé en calculant `resolvedTheme` pendant le rendu — c'est une valeur
dérivée. Les effets ne servent plus qu'à ce pour quoi ils sont faits :
synchroniser le DOM et s'abonner à `matchMedia`.

---

## 5. Fichiers modifiés et créés

**66 fichiers** ajoutés ou modifiés depuis le commit de Phase 1.

```
docs/DESIGN_SYSTEM.md                    ← nouveau, document de référence
PHASE_2_FINAL_REPORT.md                  ← ce document

src/styles/index.css                     ← RÉÉCRIT : tokens clair + sombre
src/main.tsx                             ← application du thème avant rendu
src/app/router.tsx                       ← RÉÉCRIT : deux ossatures distinctes
src/app/providers.tsx                    ← ajout du ThemeProvider

src/components/ui/            (20 fichiers, dont 1 test)
src/components/layout/        (7 fichiers)
src/components/marketing/     (8 fichiers)
src/components/feedback/      (+2 : EmptyState, ErrorState)

src/features/theme/           (5 fichiers, dont 1 test)
src/features/search/          (1 fichier)
src/features/auth/            (+4 : schémas, AuthCard, FormError, test)
src/features/tools/           (+3 : catalog-metadata, ToolCard, CategoryCard)

src/config/navigation.ts      ← source unique des destinations
src/lib/format.ts             ← Intl natif, aucune librairie de dates
src/lib/defined-props.ts      ← pont exactOptionalPropertyTypes ↔ Radix

src/pages/                    ← 15 pages réécrites + LandingPage
```

---

## 6. Contenus volontairement non inventés

Trois endroits où j'ai refusé de produire du contenu plausible mais faux.

### 6.1 Témoignages

Aucun avis client n'existe. Fabriquer des témoignages crédibles — noms complets,
entreprises identifiables, citations plausibles — reviendrait à produire de faux
avis, y compris sur une maquette. Les encarts sont donc :
- désignés par **métier et secteur**, sans identité ;
- au contenu explicitement marqué « emplacement réservé » ;
- précédés d'un avertissement visible dans l'interface.

### 6.2 Tarifs

Aucun modèle économique n'a été défini. Afficher des montants inventés serait un
engagement commercial que le produit ne peut pas tenir. Les trois paliers
affichent **« — à définir »** avec un avertissement explicite. La répartition
des fonctionnalités, elle, reflète ce que l'architecture permet réellement.

### 6.3 Message de réinitialisation de mot de passe

Formulation neutre volontaire : « Si un compte existe, vous recevrez un lien. »
Confirmer l'existence d'un compte permettrait d'**énumérer les adresses
inscrites**.

### 6.4 Données du tableau de bord

Les compteurs affichent **zéro** et les listes sont vides. C'est l'état réel du
produit : aucun outil n'est encore implémenté. Plutôt que de simuler une
activité, les états vides expliquent la situation et orientent vers l'action
suivante — c'est le principe §2.2 du Design System.

Les valeurs de l'aperçu du héro sont les seules illustratives, et signalées
comme telles sous le bloc.

---

## 7. Tests exécutés et résultats réels

| Vérification | Résultat |
|---|---|
| `npm run typecheck` | ✅ 0 erreur |
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm run format:check` | ✅ « All matched files use Prettier code style! » |
| `npm run test` | ✅ **49 tests / 11 fichiers** |
| `npm run build` | ✅ built in 3,76 s — **29 chunks** |
| `npm run dev` | ✅ « VITE v8.2.1 ready in 995 ms » |
| Routes `/`, `/login`, `/register`, `/tools`, `/dashboard`, `/settings` | ✅ 200 |

### 7.1 Tests ajoutés en Phase 2 (+18)

| Fichier | Tests | Ce qui est prouvé |
|---|---|---|
| `features/theme/ThemeProvider.test.tsx` | 4 | Suivi du système, persistance d'un choix explicite, **non-écrasement du choix utilisateur** par un changement système, résistance à un `localStorage` inaccessible |
| `features/auth/schemas/auth.schema.test.ts` | 7 | Normalisation d'adresse, longueur minimale, rattachement de l'erreur de confirmation au bon champ |
| `components/ui/Input.test.tsx` | 5 | Association libellé/champ, `aria-describedby`, `aria-invalid`, masquage de l'aide en cas d'erreur |
| `lib/defined-props.test.ts` | 2 | Suppression des `undefined`, **conservation des valeurs falsy légitimes** (`false`, `0`, `''`) |

Les tests portent sur l'**accessibilité et le comportement**, pas sur
l'apparence : ce sont les associations ARIA qui se cassent silencieusement lors
des refontes visuelles, pas les couleurs.

### 7.2 Conformité aux interdictions du cahier des charges

| Interdiction | Vérification | Résultat |
|---|---|---|
| ❌ Composants géants | Aucun fichier `src/**` > 200 lignes | ✅ 0 fichier |
| ❌ Couleurs hardcodées | Recherche `#RRGGBB` dans `src/**` | ✅ 0 occurrence |
| ❌ Styles inline dispersés | `style={{}}` réservé aux `env(safe-area-*)` | ✅ 3 usages justifiés |
| ❌ Duplication UI | Sections, cartes et états vides factorisés | ✅ |
| ❌ Dépendances inutiles | 4 ajouts, chacun arbitré avec toi | ✅ |

### 7.3 Dépendances ajoutées

| Paquet | Version | Justification |
|---|---|---|
| `radix-ui` | 1.6.7 | Primitives accessibles — package unique plutôt que 15 |
| `cmdk` | 1.1.1 | Filtrage flou de la palette de commandes |
| `react-hook-form` | 7.84.0 | Formulaires — reporté depuis la Phase 1, comme prévu |
| `@hookform/resolvers` | 5.7.1 | Pont Zod ↔ react-hook-form |
| `@fontsource-variable/inter` | 5.3.0 | Police d'interface **auto-hébergée** — aucun appel CDN |
| `@fontsource-variable/jetbrains-mono` | 5.3.0 | Chasse fixe pour les valeurs techniques |

**39 dépendances directes, 332 paquets, 0 conflit de peer dependencies.**

Les polices sont auto-hébergées et non chargées depuis Google Fonts : cela
supprime une dépendance réseau au chargement **et** une fuite d'adresses IP
utilisateur vers un tiers.

---

## 8. Problèmes restants

1. **Bundle initial de 588 ko (176 ko gzip).** Inchangé depuis la Phase 1
   malgré l'ajout de Radix : le découpage par route absorbe les nouveautés
   (29 chunks contre 19). La masse reste React + React Router + Supabase +
   TanStack Query, tous requis au démarrage. Un découpage vendor améliorerait
   le **cache** sans réduire le poids ; à mesurer avant de l'appliquer.

2. **Aucun projet Supabase provisionné.** Toujours le prérequis bloquant. Les
   formulaires d'authentification sont complets et validés, mais ne peuvent pas
   être testés de bout en bout sans backend réel.

3. **Aucun test E2E.** Playwright reste configuré mais non installé. Maintenant
   que de vrais parcours existent (inscription, connexion, navigation,
   recherche), c'est devenu la lacune la plus significative.

4. **Le tableau de bord n'affiche aucune donnée réelle.** Les hooks favoris et
   historique ne sont pas branchés — il n'y a rien à afficher tant qu'aucun
   outil n'existe. Le branchement se fera en remplaçant des constantes locales,
   sans toucher à la mise en page.

5. **Le bouton « Enregistrer » du profil est inerte.** L'appel
   `updateUser` n'est pas câblé, faute de backend pour le vérifier.

6. **Contrastes non mesurés instrumentalement.** La palette est construite en
   OKLCH pour garantir AA par construction, mais aucun outil n'a validé les
   ratios réels sur les 60+ combinaisons de tokens. À faire avec un audit
   automatisé.

7. **Aucune vérification sur appareil réel.** Le responsive est correct par
   construction et le build passe, mais rien n'a été ouvert sur un iPhone ou un
   Android physique — les zones sûres et le comportement du clavier virtuel
   méritent une vérification manuelle.

---

## 9. Recommandations pour la Phase 3

**Prérequis bloquant** — provisionner Supabase et appliquer les 4 migrations.
Rien ne peut être validé de bout en bout sans cela.

Ordre suggéré :

1. **Brancher l'authentification réelle** et vérifier les parcours complets :
   inscription → e-mail de confirmation → connexion → route protégée →
   déconnexion. C'est le premier chemin critique du produit.

2. **Activer Playwright** sur ces parcours. Les fondations sont écrites depuis
   la Phase 1 ; il ne manque que `npm i -D @playwright/test`.

3. **Premier outil réel** — copier `src/tools/_template/`. La loi d'Ohm est le
   meilleur candidat : calcul simple, entièrement testable dans `compute.ts`, et
   suffisant pour éprouver la chaîne complète registry → catalogue →
   réconciliation avec la table `tools` → carte d'outil → page de détail.

4. **Brancher favoris et historique** une fois qu'un outil existe. Les tables,
   la RLS et les états vides sont prêts.

5. **Audit d'accessibilité automatisé** (`axe-core` dans les tests Vitest) pour
   valider instrumentalement les contrastes et les rôles ARIA sur chaque page.

6. **Intégration continue** — un workflow exécutant `typecheck` + `lint` +
   `test` + `build` figerait toutes les garanties accumulées sur les deux
   phases. Non fait faute de remote Git.

---

**PHASE 2 — READY FOR REVIEW**

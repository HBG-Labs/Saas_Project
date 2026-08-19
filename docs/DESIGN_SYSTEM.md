# REZO360 — Design System

**Version 1.0** — Phase 2
Document de référence pour toute décision visuelle et d'interaction.

---

## 1. Vision design

REZO360 est un **instrument de travail**, pas une vitrine. Un technicien
l'ouvre sur un chantier, en atelier ou en salle de cours, souvent dans l'urgence,
parfois sur un téléphone avec des gants. L'interface doit disparaître derrière le
résultat.

Trois convictions structurent le système :

**L'interface est un instrument de mesure.**
Un résultat de calcul doit être lisible d'un coup d'œil, sans ambiguïté sur
l'unité ni sur la précision. Les chiffres priment sur la décoration. Les valeurs
numériques utilisent des chiffres tabulaires pour que les colonnes s'alignent et
que les décimales se comparent.

**La densité est un service, pas un défaut.**
Nos utilisateurs sont des professionnels. Un tableau dense qui montre douze
lignes vaut mieux qu'une carte aérée qui en montre trois. Nous refusons le
« design de démo » généreux en blanc mais pauvre en information.

**Le sombre n'est pas une option cosmétique.**
Un local technique, un chantier de nuit, un data center : nos deux thèmes sont
conçus simultanément, avec les mêmes exigences de contraste.

### Positionnement visuel

| Référence | Ce qu'on retient | Ce qu'on écarte |
|---|---|---|
| **Linear** | Densité maîtrisée, hiérarchie typographique nette, raccourcis clavier partout | Son esthétique très marquée, difficile à faire vieillir |
| **Stripe Dashboard** | Traitement exemplaire des données chiffrées et des tableaux | Sa complexité de navigation |
| **Vercel** | Sobriété, neutres impeccables, un seul accent | Son minimalisme parfois trop froid |
| **Raycast** | La palette de commandes comme accélérateur | Son orientation power-user exclusive |
| **Notion** | Lisibilité des contenus longs | Sa lenteur perçue |

---

## 2. Principes UX

### 2.1 Le résultat d'abord

Un outil de calcul affiche son résultat **au-dessus du pli**, avant la
documentation et les références. L'utilisateur qui connaît l'outil ne doit jamais
faire défiler pour voir ce qu'il est venu chercher.

### 2.2 Zéro état vide muet

Tout état vide explique **pourquoi** il est vide et **quoi faire ensuite**. « Aucun
favori » est un échec de conception ; « Aucun favori — parcourez le catalogue et
cliquez sur l'étoile pour retrouver vos outils ici » est une aide.

### 2.3 Le clavier est un citoyen de première classe

`⌘K` / `Ctrl+K` ouvre la palette de commandes depuis n'importe où. Tout élément
interactif est atteignable au `Tab` avec un anneau de focus visible. Aucune
action n'est exclusivement accessible au survol.

### 2.4 Feedback immédiat et honnête

Toute action produit une réponse en moins de 100 ms — même si ce n'est qu'un
squelette de chargement. Les squelettes reproduisent la forme du contenu attendu
pour éviter le saut de mise en page.

### 2.5 Pas de cul-de-sac

Toute erreur propose une sortie : réessayer, revenir, ou contacter. Un crash
d'outil n'emporte jamais la navigation (garanti par `ToolErrorBoundary`,
Phase 1).

### 2.6 Progressivité

Un débutant voit l'essentiel ; un expert accède aux options avancées sans que
celles-ci encombrent l'interface par défaut. Les paramètres avancés vivent dans
des sections repliées, jamais dans un écran séparé.

---

## 3. Identité visuelle

### 3.1 Direction chromatique retenue — bleu technique profond

Un bleu-indigo dense, choisi pour ce qu'il communique : **précision, fiabilité,
ingénierie**. Neutre pour un public technique mixte, il supporte des sessions de
travail longues sans fatigue, et offre un excellent contraste dans les deux
thèmes.

Un accent **cyan** intervient avec parcimonie : indicateurs de données, graphes,
états actifs. Il évoque le signal optique, cœur de métier REZO360.

### 3.2 Espace colorimétrique — OKLCH

Toutes les couleurs sont définies en OKLCH plutôt qu'en hexadécimal. Ce n'est pas
un raffinement gratuit : OKLCH est **perceptuellement uniforme**. Deux couleurs
de même clarté `L` sont perçues comme aussi lumineuses, quelle que soit leur
teinte. Conséquence pratique : générer une variante sombre revient à ajuster `L`
sans que les rapports de contraste dérivent, ce qui est impossible à garantir en
HSL.

### 3.3 Logo et marque

Le nom s'écrit **REZO**360, la première partie en `--foreground`, la seconde en
`--primary`. Pas de logotype graphique en Phase 2 : un faux logo mal dessiné nuit
plus qu'il n'apporte.

---

## 4. Palette

### 4.1 Échelle primaire

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `primary-50` | `oklch(97% 0.015 258)` | `oklch(22% 0.04 258)` | Fonds de sélection très légers |
| `primary-100` | `oklch(93% 0.035 258)` | `oklch(27% 0.06 258)` | Survol de ligne active |
| `primary-200` | `oklch(87% 0.065 258)` | `oklch(33% 0.09 258)` | Bordures d'accent |
| `primary-300` | `oklch(78% 0.105 258)` | `oklch(42% 0.13 258)` | Éléments décoratifs |
| `primary-400` | `oklch(68% 0.155 258)` | `oklch(52% 0.17 258)` | Icônes secondaires |
| **`primary-500`** | **`oklch(58% 0.19 258)`** | **`oklch(62% 0.18 258)`** | **Couleur de marque** |
| `primary-600` | `oklch(52% 0.19 258)` | `oklch(56% 0.18 258)` | Survol des actions |
| `primary-700` | `oklch(45% 0.17 258)` | `oklch(48% 0.16 258)` | Pression / actif |
| `primary-800` | `oklch(37% 0.14 258)` | `oklch(40% 0.13 258)` | Textes sur fond clair |
| `primary-900` | `oklch(29% 0.10 258)` | `oklch(32% 0.10 258)` | Contrastes maximaux |

> En thème sombre, `primary-500` est **éclairci** (58 % → 62 %). Un bleu saturé
> conserve sa lisibilité sur fond sombre uniquement si sa clarté remonte ;
> réutiliser la valeur claire produirait un bleu qui « bave » sur le fond.

### 4.2 Accent

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `accent-500` | `oklch(70% 0.14 195)` | `oklch(74% 0.13 195)` | Données, graphes, badge « nouveau » |
| `accent-subtle` | `oklch(95% 0.03 195)` | `oklch(26% 0.05 195)` | Fond de badge |

**Règle stricte :** l'accent ne sert jamais à une action principale. Deux
couleurs d'action concurrentes détruisent la hiérarchie.

### 4.3 Neutres — les couleurs les plus importantes du système

95 % de l'interface est neutre. Ces valeurs comptent plus que la couleur de
marque.

| Token sémantique | Clair | Sombre | Rôle |
|---|---|---|---|
| `background` | `oklch(99% 0.002 258)` | `oklch(14% 0.008 258)` | Fond de page |
| `surface` | `oklch(100% 0 0)` | `oklch(17.5% 0.01 258)` | Cartes, panneaux |
| `surface-raised` | `oklch(100% 0 0)` | `oklch(21% 0.012 258)` | Modales, menus déroulants |
| `surface-sunken` | `oklch(97% 0.003 258)` | `oklch(11.5% 0.008 258)` | Zones en creux, code |
| `border` | `oklch(92% 0.005 258)` | `oklch(27% 0.012 258)` | Séparateurs standards |
| `border-strong` | `oklch(85% 0.008 258)` | `oklch(35% 0.015 258)` | Champs de formulaire |
| `foreground` | `oklch(20% 0.015 258)` | `oklch(96% 0.005 258)` | Texte principal |
| `muted-foreground` | `oklch(50% 0.012 258)` | `oklch(68% 0.01 258)` | Texte secondaire |
| `subtle-foreground` | `oklch(62% 0.01 258)` | `oklch(55% 0.01 258)` | Libellés, métadonnées |

> Les neutres portent une trace de bleu (`chroma 0.002–0.015`) plutôt que d'être
> parfaitement gris. Un gris pur à côté d'un bleu saturé paraît sale ; un gris
> légèrement teinté vers la couleur de marque paraît intentionnel.

> Le fond sombre est `oklch(14%)`, jamais `#000`. Le noir pur crée un halo
> autour du texte clair (éblouissement de contraste) et supprime toute
> possibilité de hiérarchie par élévation.

### 4.4 Couleurs sémantiques

Chacune existe en trois déclinaisons : `-subtle` (fond), `-border`, et pleine
(texte / icône).

| Rôle | Clair | Sombre | Emploi |
|---|---|---|---|
| `success` | `oklch(60% 0.15 150)` | `oklch(70% 0.15 150)` | Calcul validé, sauvegarde réussie |
| `warning` | `oklch(72% 0.15 75)` | `oklch(78% 0.15 75)` | Valeur hors plage recommandée |
| `error` | `oklch(58% 0.20 25)` | `oklch(68% 0.19 25)` | Entrée invalide, échec |
| `info` | `oklch(62% 0.14 240)` | `oklch(70% 0.13 240)` | Note explicative, astuce |

### 4.5 Règle d'accessibilité non négociable

| Contenu | Ratio minimal |
|---|---|
| Texte courant | **4.5:1** (WCAG AA) |
| Texte ≥ 18,66 px gras ou ≥ 24 px | 3:1 |
| Bordures de champs, icônes porteuses de sens | **3:1** |
| Anneau de focus vs fond adjacent | **3:1** |

**Aucune information n'est portée par la seule couleur.** Un champ en erreur
porte une bordure rouge *et* une icône *et* un message. Un daltonien
(8 % des hommes) doit pouvoir utiliser la plateforme intégralement.

---

## 5. Typographie

### 5.1 Familles

| Usage | Police | Justification |
|---|---|---|
| Interface | **Inter Variable** | Dessinée pour les écrans, excellente lisibilité aux petites tailles, chiffres tabulaires natifs. Auto-hébergée via `@fontsource-variable/inter` — **aucun appel CDN**, donc pas de dépendance externe ni de fuite de données utilisateur. |
| Valeurs techniques | **JetBrains Mono Variable** | Chasse fixe pour les résultats de calcul, adresses IP, masques de sous-réseau. Distingue sans ambiguïté `0`/`O` et `1`/`l`/`I` — critique quand une erreur de lecture fausse un calcul de liaison optique. |

```css
--font-sans: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'JetBrains Mono Variable', ui-monospace, 'SF Mono', monospace;
```

### 5.2 Échelle

Progression de ratio ~1.2 (tierce mineure), resserrée aux petites tailles où la
lisibilité prime sur le rythme.

| Token | Taille | Interligne | Graisse | Emploi |
|---|---|---|---|---|
| `text-2xs` | 11 px | 16 px | 500 | Badges, indices |
| `text-xs` | 12 px | 16 px | 400–500 | Métadonnées, libellés de champs |
| `text-sm` | 14 px | 20 px | 400 | **Taille par défaut de l'interface** |
| `text-base` | 16 px | 24 px | 400 | Corps de texte long, documentation |
| `text-lg` | 18 px | 28 px | 500 | Sous-titres |
| `text-xl` | 20 px | 28 px | 600 | Titres de carte |
| `text-2xl` | 24 px | 32 px | 600 | Titres de page |
| `text-3xl` | 30 px | 36 px | 700 | Titres de section (landing) |
| `text-4xl` | 36 px | 40 px | 700 | Héro secondaire |
| `text-5xl` | 48 px | 52 px | 800 | Héro principal |
| `text-6xl` | 60 px | 62 px | 800 | Héro grand écran |

> **14 px est la taille par défaut de l'application**, pas 16 px. Les outils
> professionnels denses (Linear, Stripe, Figma) utilisent tous 13–14 px : cela
> permet d'afficher davantage d'information sans réduire la lisibilité, car
> l'utilisateur est proche de l'écran et concentré. La **landing page**, elle,
> utilise 16 px : le lecteur est plus distant et moins engagé.

### 5.3 Graisses

Uniquement **400 / 500 / 600 / 700 / 800**. Interdire les graisses intermédiaires
évite les hiérarchies floues où deux niveaux se distinguent à peine.

### 5.4 Interlettrage

| Contexte | Valeur |
|---|---|
| Titres ≥ 30 px | `-0.02em` — les grandes tailles paraissent trop espacées sans resserrement |
| Corps | `0` |
| Majuscules (`text-2xs` en capitales) | `+0.05em` — les capitales ont besoin d'air |

### 5.5 Règles d'usage

- **Une seule graisse ≥ 700 par écran.** Deux titres également gras ne créent
  aucune hiérarchie.
- **Longueur de ligne 60–75 caractères** pour tout texte long (`max-w-prose`).
- **Chiffres tabulaires obligatoires** (`font-variant-numeric: tabular-nums`) sur
  tout résultat de calcul, tableau ou statistique. Sans cela, `1.111` et `8.888`
  n'ont pas la même largeur et les colonnes tremblent.
- **Jamais de texte justifié** : crée des rivières blanches, illisible en
  colonne étroite.

---

## 6. Espacement

### 6.1 Échelle — base 4 px

`0 · 1 (4) · 2 (8) · 3 (12) · 4 (16) · 5 (20) · 6 (24) · 8 (32) · 10 (40) ·
12 (48) · 16 (64) · 20 (80) · 24 (96)`

Une base 4 px plutôt que 8 px : à 14 px de police, un pas de 8 px est trop
grossier pour ajuster finement les espaces internes d'un champ ou d'un badge.

### 6.2 Application

| Contexte | Espacement |
|---|---|
| Intérieur d'un badge | `2` / `0.5` (8 × 2 px) |
| Intérieur d'un bouton `sm` | `3` horizontal |
| Intérieur d'un bouton `md` | `4` horizontal |
| Intérieur d'une carte | `4` (mobile) → `6` (desktop) |
| Entre éléments liés | `2` à `3` |
| Entre groupes | `6` |
| Entre sections de page | `10` (mobile) → `16` (desktop) |
| Sections de landing | `20` (mobile) → `24` (desktop) |

### 6.3 Principe de proximité

L'espace **entre** deux groupes doit toujours dépasser l'espace **à l'intérieur**
d'un groupe. Un libellé collé à son champ (`gap-1.5`) et séparé du champ suivant
(`gap-5`) se lit sans effort ; l'inverse produit une bouillie visuelle.

---

## 7. Système de composants

### 7.1 Rayons

| Token | Valeur | Emploi |
|---|---|---|
| `radius-sm` | 4 px | Badges, petites puces |
| `radius-md` | 6 px | **Boutons, champs — valeur par défaut** |
| `radius-lg` | 8 px | Cartes, panneaux |
| `radius-xl` | 12 px | Modales, grandes surfaces |
| `radius-full` | 9999 px | Avatars, pastilles |

Rayons volontairement contenus. Au-delà de 12 px, l'interface glisse vers un
registre grand public qui contredit le positionnement professionnel.

### 7.2 Élévation

En thème **clair**, l'élévation passe par l'ombre.
En thème **sombre**, elle passe par la **clarté de surface** — une ombre noire sur
fond sombre est invisible.

| Niveau | Clair | Sombre |
|---|---|---|
| `flat` | aucune | `surface` |
| `raised` | `0 1px 2px rgb(0 0 0 / 0.05)` | `surface-raised` |
| `overlay` | `0 8px 24px rgb(0 0 0 / 0.12)` | `surface-raised` + bordure |
| `modal` | `0 16px 48px rgb(0 0 0 / 0.18)` | `surface-raised` + bordure marquée |

### 7.3 Tailles de contrôle

| Taille | Hauteur | Emploi |
|---|---|---|
| `sm` | 32 px | Barres d'outils denses, actions de tableau |
| `md` | 36 px | **Défaut desktop** |
| `lg` | 44 px | Actions principales, **minimum sur mobile** |

> **Sur écran tactile, tout élément interactif fait au moins 44 × 44 px**
> (recommandation Apple HIG et WCAG 2.5.5). Un bouton `sm` reste autorisé sur
> desktop mais bascule automatiquement en `lg` sous le point de rupture `md`.

### 7.4 Variantes de bouton

| Variante | Emploi | Nombre par écran |
|---|---|---|
| `primary` | L'action principale | **Une seule** |
| `secondary` | Actions alternatives | Plusieurs |
| `outline` | Actions tertiaires | Plusieurs |
| `ghost` | Barres d'outils, icônes | Plusieurs |
| `danger` | Suppression, action irréversible | Une seule |
| `link` | Navigation inline | Plusieurs |

### 7.5 États obligatoires

Tout composant interactif implémente les six états :

| État | Traitement |
|---|---|
| `default` | — |
| `hover` | Assombrissement d'un pas dans l'échelle |
| `focus-visible` | Anneau 2 px `--ring` + décalage 2 px. **Jamais supprimé.** |
| `active` | Deux pas plus sombre |
| `disabled` | `opacity: 0.5`, `pointer-events: none`, `aria-disabled` |
| `loading` | Indicateur + `aria-busy`, **largeur préservée** pour éviter le saut |

### 7.6 Mouvement

| Durée | Emploi |
|---|---|
| 120 ms | Survol, changement de couleur |
| 180 ms | Apparition de menu, infobulle |
| 240 ms | Modale, panneau latéral |

Courbe : `cubic-bezier(0.16, 1, 0.3, 1)` — démarrage rapide, arrivée douce.

**`prefers-reduced-motion` neutralise toute animation** (déjà en place depuis la
Phase 1). Ce n'est pas une préférence esthétique : les animations déclenchent des
migraines et des nausées chez les personnes souffrant de troubles vestibulaires.

---

## 8. Responsive

### 8.1 Points de rupture

| Nom | Largeur | Cible |
|---|---|---|
| — | < 640 px | Téléphone (iPhone SE → Pro Max, Android) |
| `sm` | ≥ 640 px | Grand téléphone paysage |
| `md` | ≥ 768 px | Tablette portrait |
| `lg` | ≥ 1024 px | Tablette paysage, petit portable |
| `xl` | ≥ 1280 px | Portable standard |
| `2xl` | ≥ 1536 px | Grand écran |

Largeur de contenu plafonnée à **1280 px** dans l'application et **1152 px** sur
la landing. Au-delà, l'œil perd la ligne en balayage horizontal.

### 8.2 Navigation selon la taille

| Taille | Modèle |
|---|---|
| < 768 px | Barre supérieure + **navigation basse fixe** (5 entrées max) + tiroir latéral pour le reste |
| 768–1023 px | Barre latérale rétractée en icônes seules |
| ≥ 1024 px | Barre latérale complète, persistante |

La navigation basse plutôt qu'un simple menu hamburger : sur un téléphone tenu à
une main, le haut de l'écran est hors d'atteinte du pouce. Les destinations
fréquentes doivent être en bas.

### 8.3 Spécificités iOS

- `viewport-fit=cover` + `env(safe-area-inset-*)` — déjà en place (Phase 1).
  La navigation basse ajoute `padding-bottom: env(safe-area-inset-bottom)` pour
  ne pas passer sous l'indicateur d'accueil.
- **Taille de police des champs ≥ 16 px** : en dessous, Safari iOS zoome
  automatiquement à la mise au point, ce qui désoriente. C'est la seule exception
  à la règle des 14 px.
- `-webkit-tap-highlight-color: transparent` pour supprimer le halo gris.

### 8.4 Spécificités Android

- Barre de navigation gestuelle : mêmes marges de sécurité qu'iOS.
- `theme-color` adapté au thème actif pour colorer la barre système.

### 8.5 Règles transversales

- **Mobile first** : les classes sans préfixe visent le téléphone, les préfixes
  `md:` / `lg:` élargissent.
- **Aucun défilement horizontal.** Les tableaux et blocs de code larges défilent
  dans leur propre conteneur `overflow-x-auto`.
- **Aucune information exclusivement au survol** : inexistant sur tactile.
- Les grilles passent de 1 colonne (mobile) à 2 (`md`) à 3–4 (`lg`).

---

## 9. Accessibilité — engagements vérifiables

| Engagement | Mécanisme |
|---|---|
| Navigation clavier intégrale | Primitives Radix UI + `eslint-plugin-jsx-a11y` |
| Focus toujours visible | `:focus-visible` global, jamais `outline: none` |
| Structure sémantique | `header` / `nav` / `main` / `footer`, un seul `h1` par page |
| Lien d'évitement | Présent depuis la Phase 1, testé |
| Contraste AA | Palette construite en OKLCH pour le garantir |
| Mouvement réduit | `prefers-reduced-motion` respecté |
| Libellés de formulaire | `Label` associé par `htmlFor`, jamais un `placeholder` seul |
| Annonces dynamiques | `role="status"` / `aria-live` sur chargements et erreurs |

---

## 10. Ce que le système interdit

| Interdit | Raison |
|---|---|
| Couleur en dur (`#3B5BDB`, `bg-blue-500`) | Casse le thème sombre. **Toujours** un token sémantique. |
| `style={{ }}` pour de la mise en forme | Échappe au système. Toléré uniquement pour une valeur calculée à l'exécution. |
| Composant > 200 lignes | Signale une responsabilité mal découpée. À scinder. |
| Deux actions `primary` sur un même écran | Détruit la hiérarchie. |
| `outline: none` sans remplacement | Rend la navigation clavier impossible. |
| Texte < 12 px | Illisible pour une part significative des utilisateurs. |
| Icône seule sans `aria-label` | Invisible pour un lecteur d'écran. |
| Animation > 300 ms | Perçue comme de la lenteur. |

---

## 11. Références d'implémentation

| Sujet | Fichier |
|---|---|
| Tokens (source de vérité) | `src/styles/index.css` |
| Bascule de thème | `src/features/theme/` |
| Primitives | `src/components/ui/` |
| Ossature applicative | `src/components/layout/` |
| Sections marketing | `src/components/marketing/` |
| Frontières d'architecture | `ARCHITECTURE.md` |

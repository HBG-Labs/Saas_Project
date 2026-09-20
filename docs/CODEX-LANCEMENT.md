# Prompt de lancement — Codex, première mission

> À coller tel quel dans Codex, à la racine du dépôt REZO360.

---

Tu prends en charge la conception artistique et l'implémentation visuelle de
REZO360, une plateforme professionnelle de gestion d'entreprise pour les
métiers de terrain (artisans, techniciens, responsables d'équipe, dirigeants),
organisée en trois univers : **Gestion**, **Workspace**, **Finance**.

**Commence par lire `docs/PASSATION-CODEX-REFONTE-VISUELLE.md` en entier.**
Il décrit l'architecture, ce qui ne doit pas casser, ce qui a déjà été décidé,
les risques connus et la façon de travailler dans ce dépôt à deux agents.
Rien de ce qui suit ne le remplace.

## Ta première mission — et seulement elle

Concevoir **trois directions artistiques réellement différentes** pour
REZO360, et les présenter séparément. Harry, le propriétaire du produit, en
choisira une. **Tu ne modifies aucun fichier de `src/` avant sa validation
explicite.**

Trois palettes posées sur la même interface ne sont pas trois directions.
Chaque proposition a sa propre logique de composition, sa typographie, son
langage visuel, sa hiérarchie de l'information.

### Ce que chaque direction doit montrer

Cinq écrans, en données fictives réalistes et représentatives des
fonctionnalités existantes (regarde `e2e/fixtures/donnees.ts` pour le
vocabulaire et les formes réelles : missions, interventions, devis, factures,
fournisseurs, congés…) :

1. **Tableau de bord Gestion** — indicateurs d'activité, interventions du jour,
   équipes, actions prioritaires. Un vrai tableau de bord de dirigeant, pas une
   rangée de tuiles.
2. **Gestion des interventions** — consulter, organiser, suivre ; des statuts
   qu'on identifie sans lire.
3. **Finance** — une page de facturation : tableau de factures, montants,
   échéances, actions contextuelles.
4. **Workspace** — documents, notes, organisation de l'information.
5. **Mobile** — l'interface d'un technicien sur le terrain, avec des gants, au
   soleil. Pas un écran de bureau réduit.

### Livrables, par direction

- Maquettes desktop et mobile, assez détaillées pour juger l'apparence dans
  des conditions proches d'une application réelle.
- Palette de couleurs, avec les ratios de contraste des couples texte/fond.
- Typographies, avec l'échelle de tailles.
- Exemples de composants : boutons et leurs états, champs, tableau, badge de
  statut, navigation, état vide, modale.
- Principes de navigation — y compris **comment on change d'univers barre
  latérale repliée et sur mobile**, ce que l'interface actuelle ne permet pas.
- Principes d'accessibilité, pour les trois modes : Atelier Jour, Atelier Nuit,
  Contraste élevé.
- Une explication courte des choix artistiques et ergonomiques : ce que chaque
  choix sert.

### Ce qui est libre

La direction artistique précédente **n'est plus imposée**. Tu peux remettre
en question la palette, le bleu de marque dans l'interface (le logo officiel
ne change pas), la typographie, les formes, les dimensions, la composition des
tableaux de bord, les espacements, les icônes, les micro-interactions.

Inspire-toi de l'ergonomie de Notion, de Tiime, d'autres outils
professionnels — sans reproduire leur identité. REZO360 doit avoir la sienne.

### Ce qui ne l'est pas

- Les trois univers, les trois modes d'affichage, les URL existantes.
- L'intégralité des fonctionnalités (liste au §8 de la passation).
- Rien de fonctionnel n'est inventé : la refonte visuelle n'est pas un
  développement de fonctionnalités. Si tu penses qu'une modification
  fonctionnelle est nécessaire, présente-la à part.

### Ce qu'on ne veut pas

Une interface générique qui a l'air produite automatiquement. Concrètement :
des cartes identiques empilées, des dégradés décoratifs, des ombres partout,
des éléments sans fonction, des chiffres géants qui ne sont pas le sujet de
la page. Chaque choix graphique sert la lisibilité, la compréhension ou
l'efficacité — sinon il n'a pas sa place.

L'application est un instrument de travail : dense quand il faut (un tableau
de douze lignes vaut mieux qu'une carte qui en montre trois), lisible dehors,
rapide au quotidien.

## Comment rendre compte

Présente les trois directions **séparément**, chacune avec ses livrables,
sous une forme qu'Harry peut regarder et comparer (pages HTML statiques dans
un dossier `design/propositions/<direction>/` par exemple, ou tout autre
support qu'il peut ouvrir directement). Termine par un tableau qui compare les
trois sur : lisibilité terrain, densité, distinctivité, coût d'implémentation.

Ne commence pas l'implémentation. Attends le choix.

# REZO360 Atelier — livraison C : Workspace

20 septembre 2026. Branche `codex/atelier-workspace`, base `43f156f`.

## Résultat

Les pages collaboratives, le bloc-notes, la bibliothèque et la formation utilisent les fondations Atelier validées : Nunito, boutons en pilule, sélections colorées, contours fins et surfaces sobres. Les neuf nuances historiques et les trois modes restent disponibles sans modification de leurs réglages.

Trois illustrations SVG originales accompagnent les premiers usages : page, carnet et dossier. Elles pèsent 3 056 octets au total, sans dépendance réseau. Le texte et les actions adjacents portent leur sens ; elles sont décoratives pour les lecteurs d’écran. Leur apparition dure 180 ms, sans boucle, et disparaît avec `prefers-reduced-motion: reduce`. Les illustrations Devis, Factures et Clients déjà présentées séparément restent à intégrer dans leurs lots respectifs.

## Adéquation avec la passation

`docs/PASSATION-CODEX-REFONTE-VISUELLE.md` décrit un Workspace dont les pages étaient encore à venir. La base actuelle contient déjà espaces personnels, pages hiérarchisées, favoris, récents, modèles, recherche, assistant sur une page et enregistrement vocal. La livraison habille ces capacités existantes.

Le lot C part de `43f156f` pour inclure les travaux fonctionnels récents de Claude. Le lot B Gestion reste séparé sur `codex/atelier-gestion` (`661ba04`), déjà poussé. C ne contient pas B : l’intégration des deux branches doit être revue ensemble, notamment les composants partagés. Aucun fichier en cours de modification dans le dépôt principal n’a été repris ou écrasé.

## Écrans

| Écran | Adaptation livrée | Capacités conservées |
|---|---|---|
| Pages | Colonne de navigation de 240–256 px, sections séparées par des traits, sélection lavande, accueil illustré. Navigation repliable sur téléphone/tablette pour libérer la rédaction. | Espaces, arbre, récents, favoris, recherche, création, modèles, liens profonds. |
| Éditeur | Texte en Nunito 16 px, zone redimensionnable moins haute, actions regroupées, messages de sauvegarde annoncés. | Titre/icône, contenu, contrôle de version à la sauvegarde, modèle, suppression, assistant, audio et consentement. |
| Notes | Liste et rédaction distinctes ; titre lisible sur mobile ; filtres et actions accessibles au toucher. | Recherche, catégories, épinglage, renommage, copie, téléchargement, suppression et sauvegarde temporisée existante. |
| Bibliothèque | Liste continue sur téléphone/tablette, tableau compact à partir de 1024 px, dossiers sobres, filtres qui reviennent à la ligne. | Recherche, dossiers imbriqués, filtres, dépôt, prévisualisation, téléchargement, modification, partage, suppression et pagination. |
| Formation | En-têtes compacts, liste de cours lisible, sommaire, progression et chapitres guidés. | Tous les cours et leurs contenus, liens vers l’application, progression connectée/locale, reprise et remise à zéro. |

Le sélecteur d’univers place désormais les icônes au-dessus des libellés pour supprimer leur chevauchement dans la barre étroite. Le choix d’univers, les routes et les permissions restent identiques. Une option vide invalide du sélecteur Radix des modèles a été remplacée par son véritable placeholder ; les modèles et leur appel de création sont inchangés.

## Vérifications exécutées

| Contrôle | Résultat |
|---|---|
| `npm run lint` | Réussi. Les deux exemptions historiques des pages de formation ont été retirées. Le test de navigation adapté ensuite a aussi été relinté. |
| `npm run typecheck` | Réussi. |
| `npm run test -- --maxWorkers=2 --reporter=dot` | 184 fichiers, 1 291 tests réussis. |
| `npm run test:e2e -- --workers=2 --reporter=line` | 126 réussis, 4 ignorés par la configuration mobile existante. |
| Build de production déclenché par Playwright | `npm run build -- --outDir dist-e2e` réussi, avec URL et clé publiques factices. |
| Revue visuelle | 43 vues en 375, 768 et 1440 px, plus un téléphone de 375 × 667 ; états remplis/vides, modèles, dépôt, Jour/Nuit/Contraste élevé. |
| Mesures navigateur | Aucun débordement horizontal du document ou du contenu principal, aucune image cassée, Nunito chargée, aucune erreur JavaScript pendant les captures. |
| Mouvement réduit | Animation des illustrations mesurée à `none`. |
| Tablette tactile | Bouton « Nouvelle note » mesuré à 44 px avec `(pointer: coarse)` actif. |

Toutes les écritures de test utilisent les interceptions de `https://test-project.supabase.co`, jamais la base réelle. Les captures bloquent également les autres origines réseau. Les tests unitaires émettent encore des avertissements React `act(...)` ; leur résultat est vert, ces avertissements ne sont pas présentés comme un contrôle de production.

### Tests adaptés et ajoutés

- Le test de route publique de la formation attend son nouveau titre « Tutoriels & Formation ».
- Le test d’univers vérifie le texte **affiché** avec `useInnerText`, plutôt que le `textContent` qui compte aussi un libellé masqué. La recherche par nom accessible exact et le parcours vers Factures restent vérifiés.
- Cinq scénarios Workspace, exécutés sur ordinateur et mobile, contrôlent : contenu/version de sauvegarde et consentement audio ; modèle/espace transmis ; saisie/sauvegarde des notes ; distinction vide/filtré et fermeture du dépôt ; progression/relecture d’un chapitre.
- La fixture dédiée reste dans `e2e/parcours` ; les fixtures communes appartenant à Claude ne sont pas modifiées. La persistance de progression est simulée explicitement, car le faux PostgREST général ne mémorise pas les écritures.
- Preuve négative : une copie temporaire des cinq tests a reçu cinq attentes volontairement fausses. Les cinq ont échoué, puis cette copie a été supprimée. La suite complète finale a été exécutée sur les attentes correctes.

## Limites et revue d’intégration

- L’éditeur actuel reste un éditeur **texte** avec conversion minimale vers le format des pages. Il ne devient pas un éditeur riche dans cette livraison. Les contenus avancés demandent un chantier fonctionnel avec Claude ; la limite est indiquée dans l’écran.
- Le parcours audio contrôle l’affichage du quota et le consentement. Il ne valide pas ici un microphone physique, le worker de transcription ou le service distant.
- Les E2E simulés ne constituent pas une nouvelle validation des politiques RLS ou des services en production. Aucun changement de migration, API, hook métier, service, route ou permission n’est livré.
- La revue visuelle concerne le navigateur Chromium/Edge ; une recette sur appareils iOS/Android et dans le conteneur Capacitor reste nécessaire avant diffusion native.
- Aucun merge vers `main`, push du lot C ou déploiement n’est effectué. Après revue/validation du lot, la prochaine étape est Finance, avec les illustrations Devis/Factures déjà proposées.

Les captures, la galerie `APERCU.html`, les journaux de validation et le patch du lot sont joints dans le dossier de livraison `outputs/lot-c` de la tâche Codex.

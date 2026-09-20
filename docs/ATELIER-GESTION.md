# REZO360 Atelier — lot B Gestion

## Statut

Lot préparé sur `codex/atelier-gestion`, à partir du lot A validé et intégré dans `main` (`4079595`). Il reste à faire valider visuellement par Harry avant intégration et passage au lot Workspace. Aucun déploiement, push ou changement de la copie principale n’est effectué par ce lot.

## Composition livrée

- Tableaux de bord propriétaire et responsable : indicateurs réunis dans une bande, jusqu’à douze missions récentes, activité récente à sa hauteur naturelle. Les chiffres proviennent toujours des mêmes requêtes. Le guide des premiers pas affiche la prochaine action et garde ses cinq étapes dans un volet dépliable ; sa règle de disparition est conservée.
- Tableau de bord terrain : priorité à la mission affectée et aux outils, sans grille de cartes décoratives. La sélection et l’ordre des missions restent ceux du fonctionnement existant.
- Clients : tableau sur grand écran, liste adaptée au téléphone, contact téléphonique accessible. Le nom n’est plus répété lorsque la raison sociale est identique. Fiche générale organisée en sections, identité avant les alertes, contacts et sites allégés. Les onglets et les actions existants sont conservés.
- Équipes et membres : listes séparées par des filets, couleur d’équipe conservée comme donnée, suppression des effets de soulèvement. Affectation, rôles, invitations, archivage et suppression conservent leurs conditions et confirmations.
- Missions : liste continue, titre et contexte à gauche, statut/date puis commandes à droite à partir de 1280 px. Les commandes compactes gardent un nom accessible et une indication au survol. Sur téléphone, leurs libellés restent visibles. Archives, fiche mission, intervention et compte rendu utilisent des sections plus sobres.
- Planning : boutons arrondis, sélection lavande en accent automatique, champs et cibles tactiles cohérents, priorités affichées en français. La première vue est Agenda sous 640 px ; Mois et Semaine restent sélectionnables. Les en-têtes s’empilent jusqu’à 1280 px pour préserver la largeur des titres sur tablette.
- Formulaires client, contact, site, équipe, modification/affectation de mission, événement et congé : panneau de 480 px au maximum, pleine largeur sur téléphone. Le formulaire reste monté dans le même composant ; titres et commandes des formulaires sont hors du corps défilant. Radix conserve son piège de focus, Échap et le retour du focus. Aucune confirmation métier n’a été transformée en formulaire latéral.

## Architecture et limites

`Modal.presentation="drawer"`, `MetricCard.layout="strip"` et `Card.variant="section"` sont des variantes explicites. Les autres usages gardent leur rendu par défaut. Les neuf choix d’accent, les trois modes, Nunito et le logo officiel restent ceux du lot A.

La modification du paramètre de présentation `limit` des deux tableaux de bord (6/5 vers 12) utilise les mêmes hooks et API. Aucun hook métier, service, type de donnée, règle de permission, route, configuration de navigation, schéma ou fichier Supabase n’a changé. Le retrait de l’exemption ESLint de `PlanningPage` accompagne la disparition de ses tailles de texte arbitraires.

La branche principale comporte des travaux non commités de Claude, dont le planning. Ils ne sont ni repris ni écrasés ici. La revue et la coordination de leur future intégration restent nécessaires, conformément à la passation. Une migration non commitée n’a pas à être embarquée dans une livraison visuelle.

Ce lot porte sur le cœur Gestion décrit ci-dessus. La carte géographique, le stock, les équipements, les véhicules et les statistiques n’ont pas reçu de recomposition spécifique dans ce lot. Workspace, Finance et le transversal conservent leurs prochaines étapes. La messagerie et les générateurs PDF restent fonctionnellement inchangés.

## Vérifications effectuées

- Lint complet et TypeScript : réussite.
- Suite unitaire : 182 fichiers, 1 281 tests réussis. Après les derniers ajustements du guide et des formulaires : 10 fichiers Gestion, 57 tests réussis.
- Suite E2E : 124 réussites, 4 tests déjà ignorés. Les huit nouveaux cas exécutés sur ordinateur/téléphone couvrent la liste client, les onglets, le panneau client, son pied fixe et son retour de focus, l’agenda mobile et une liste de douze missions.
- Le test de position du panneau a détecté le défaut de centrage initial (bord droit à 1 040 px au lieu de 1 280 px). Il passe après suppression des classes de centrage dans la variante latérale.
- Build de production local dans `dist-e2e`, origine de données fictive. Après l’ajustement final des en-têtes tablette, le build et les captures sont renouvelés.
- Captures desktop 1 440 px, tablette tactile 768 px et mobile tactile 375 px, plus tableaux de bord responsable et technicien, nuit et contraste élevé. Vérification des débordements du document ET du contenu principal, police réellement chargée, erreurs JavaScript et géométrie des panneaux.

Les captures utilisent exclusivement des données fictives interceptées. Elles vérifient l’interface et ne remplacent pas un essai terrain sur appareil physique, ni les tests serveur des policies RLS. Aucune suite SQL ni migration n’a été exécutée. Les résultats et images de livraison sont regroupés dans la galerie du lot B.

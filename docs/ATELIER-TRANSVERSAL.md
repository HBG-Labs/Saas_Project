# REZO360 Atelier — lot E Transversal

20 septembre 2026. Intégré après le lot Finance sur `main`.

## Résultat

Le portail client adopte la même grammaire que l’espace entreprise sans perdre son identité : en-tête de marque uni, navigation active discrète, rayons resserrés et page d’accueil structurée par une bande de priorités continue. Les dégradés décoratifs et les halos du portail et de sa connexion ont disparu. Les interventions, devis, factures, documents, messages et routes existants restent inchangés.

La messagerie gagne en lisibilité sur les deux côtés du portail. Les métadonnées ne descendent plus sous le plancher typographique, les fils conservent leurs zones tactiles et les panneaux utilisent des surfaces simples plutôt que des ombres ou des cartes imbriquées.

L’assistant IA conserve son fonctionnement, ses suggestions, son historique, son quota et ses états dégradés. Sa zone de saisie est désormais ancrée sur une surface bordée, sans fondu décoratif. L’historique et le centre de notifications emploient les mêmes rayons et la même échelle typographique. L’animation insistante du compteur de notifications a été retirée, sans masquer le nombre d’éléments non lus.

Le profil, les paramètres et la facturation ont été alignés sur ces principes : surfaces plus calmes, sélection locale en teinte subtile, absence de déplacement au survol et libellés courts toujours lisibles. Les préférences, permissions, changements de formule, avatar et mot de passe n’ont pas été modifiés.

## Dette supprimée

Dix exemptions ont été retirées du contrôle ESLint des couleurs et tailles arbitraires : assistant, historique IA, messagerie client, notifications, ossature du portail, accueil, connexion, messages, profil et facturation. Ces fichiers utilisent maintenant uniquement les jetons sémantiques et l’échelle typographique du produit.

## Vérifications

- `npm run lint -- --quiet` : réussi.
- `npm run typecheck` : réussi.
- `npm run build` : réussi, 2 746 modules transformés.
- `npm test -- --maxWorkers=2 --reporter=dot` : 185 fichiers et 1 295 tests réussis.
- `npm run test:e2e -- --workers=2 --reporter=line` : 150 réussis, 4 ignorés par la configuration mobile existante.
- Revue visuelle en 1 440 × 1 000 et 375 × 812 px : portail, assistant et paramètres, sans débordement horizontal.

Huit nouveaux parcours couvrent le portail, l’assistant, le profil, les notifications, les paramètres et la facturation sur ordinateur et téléphone. Ils vérifient aussi l’absence de débordement horizontal et de dégradé sur l’entrée du portail.

Ce lot ne modifie ni schéma, ni migration, ni RLS, ni fonction serveur, ni hook métier, ni permission, ni route.

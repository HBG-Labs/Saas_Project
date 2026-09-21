# REZO360 Atelier — lot D Finance

20 septembre 2026. Intégré après les lots Gestion et Workspace sur `main`.

## Résultat

Le parcours Finance distingue désormais clairement les ventes des achats. La navigation locale des ventes relie le chiffrage, l’historique des devis et les factures sans modifier leurs URL. Les onglets Achats ne mélangent plus les commandes fournisseurs avec les devis clients.

Les listes de devis et de factures utilisent une présentation dense en tableau sur écran large et des fiches tactiles sur téléphone. Les références, clients, statuts, dates et montants restent visibles sans carte décorative par ligne. Deux illustrations SVG originales accompagnent les premiers usages sans dépendance réseau.

Le chiffrage conserve le client, le catalogue, les lignes, la TVA, l’enregistrement et l’aperçu PDF existants. Sa composition est plus calme : sections séparées par des filets, synthèse fixe sans dégradé, libellés courts et client/site sélectionnés repris correctement dans la synthèse comme dans l’aperçu.

Les achats réunissent leurs quatre indicateurs dans une bande compacte. Sur téléphone, les filtres de commandes sont empilés et gardent leurs libellés complets. Les commandes, fournisseurs, formulaires, réceptions, exports et confirmations existants sont conservés.

## Documents client

Les aperçus imprimables des devis, factures et avoirs restent volontairement noirs sur feuille blanche, y compris en mode Atelier Nuit. Leurs couleurs fixes vivent désormais dans les styles dédiés `.financial-paper*`, plutôt que dans trois pages exemptées du contrôle des jetons. Les trois exemptions ESLint correspondantes ont été retirées.

Les tableaux imprimables utilisent la primitive `Table` : leur débordement horizontal reste contenu et la zone demeure accessible au clavier.

## Vérifications exécutées

- `npm run lint -- --quiet` : réussi.
- `npm run typecheck` : réussi.
- `npm run build` : réussi, 2 746 modules transformés.
- `npm test -- --maxWorkers=2 --reporter=dot` : 185 fichiers et 1 295 tests réussis.
- `npm run test:e2e -- --workers=2 --reporter=line` : 142 réussis, 4 ignorés par la configuration mobile existante.
- Revue visuelle en 1 440 × 1 000 et 375 × 812 px : factures, devis et achats, sans débordement horizontal.
- Mode nuit : fond blanc et encre sombre de la facture imprimable mesurés dans le navigateur.

Huit nouveaux parcours, exécutés sur ordinateur et téléphone, protègent la navigation Ventes, la séparation Achats/Ventes, les deux présentations de la liste de factures, l’absence de débordement et la feuille client en mode nuit. Le test historique des factures cible désormais la référence réellement visible, comme il le faisait déjà pour le montant, car `DataView` monte les variantes tableau et mobile ensemble.

## Limites

Ce lot ne crée aucun suivi de paiement et ne déduit jamais qu’une échéance dépassée est impayée. Il ne modifie ni schéma, ni migration, ni RLS, ni API, ni hook métier, ni permission, ni route. La transmission réglementaire, les avoirs, les relances et les factures reçues conservent leurs comportements existants.

Les essais navigateur emploient exclusivement le faux PostgREST Playwright. Ils ne remplacent pas les tests serveur, ni une recette d’impression sur chaque pilote PDF ou appareil natif.

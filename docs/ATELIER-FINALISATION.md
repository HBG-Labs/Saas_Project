# REZO360 Atelier — lot F Finalisation

20 septembre 2026. Dernier lot de la refonte visuelle Atelier, intégré après les lots Fondations, Gestion, Workspace, Finance et Transversal.

## Résultat

La dernière passe aligne les outils métiers, le planning, l’assistant et les derniers composants transversaux sur la grammaire Atelier : surfaces simples, rayons resserrés, jetons sémantiques et échelle typographique commune. Les couleurs métier restent des informations, mais ne pilotent plus des dégradés décoratifs ni des styles parallèles. Les cartes et calculateurs conservent leurs contenus, leurs formules, leurs liens profonds et leurs actions.

La revue mobile a corrigé les défauts que l’audit a réellement mis en évidence : la commande d’ajout du planning porte maintenant un nom accessible et une cible tactile suffisante ; les commandes d’historique et de nouvelle discussion, les retours utiles/inutiles, les suggestions et la saisie de l’assistant atteignent le même plancher tactile.

Les exemptions ESLint restantes ont été reclassées. Les canevas, visualiseurs, sorties imprimables, exports autonomes et palettes de données sont documentés comme usages légitimes. La seule dette visuelle encore listée concerne le site vitrine (`LandingPage`, `PricingPage`, `components/marketing` et le simulateur tarifaire), explicitement hors du périmètre applicatif de cette refonte.

## Audit final automatisé

Le parcours `16-finalisation-atelier.spec.ts` ouvre 18 routes majeures à 1 280 × 900 px et 360 × 800 px. Sur chacune, il vérifie :

- la présence du repère principal ;
- l’absence de débordement horizontal ;
- le nom accessible des liens, boutons et champs visibles ;
- une cible d’au moins 40 px sur mobile, extension CSS comprise ;
- l’absence d’erreur de page ou de console, hors échec DNS Realtime attendu sur le faux domaine E2E.

Le contrôle a d’abord été exécuté en échec, a exposé les cibles trop petites et la commande non nommée, puis a été rejoué après correction. Il couvre 36 rendus au total et passe sur les deux projets Playwright.

Une revue visuelle complémentaire des métiers, du calculateur béton et du planning a été effectuée aux mêmes largeurs. Les compositions restent lisibles, sans coupe ni collision.

## Budget de performance

`npm run audit:bundle` mesure le gzip des fichiers réellement produits dans `dist/assets`. Le déploiement l’exécute désormais après le build. Les plafonds sont de 75 Kio par chunk JavaScript, 45 Kio par feuille CSS, 1 100 Kio de JavaScript cumulé et 50 Kio de CSS cumulé.

Le build final contient 205 chunks JavaScript et 2 feuilles CSS : 962,6 Kio de JavaScript cumulé, avec un plus gros chunk à 67,4 Kio, et 38,2 Kio de CSS cumulé, avec une plus grosse feuille à 32,0 Kio. Un essai avec un plafond artificiel de 1 Kio a confirmé que le script échoue bien en cas de dépassement avant le passage avec les budgets normaux.

## Vérifications exécutées

- `npm run lint -- --quiet` : réussi.
- `npm run typecheck` : réussi.
- Tests ciblés assistant, jours fériés et registres : 5 fichiers et 27 tests réussis.
- `npm test -- --maxWorkers=2 --reporter=dot` : 185 fichiers et 1 295 tests réussis.
- `npm run build` : réussi, 2 746 modules transformés.
- `npm run audit:bundle` : réussi avec les mesures ci-dessus.
- `npm run test:e2e -- --workers=2 --reporter=line` : 152 réussis, 4 ignorés par la configuration mobile existante.
- Revue visuelle en 1 280 × 900 et 360 × 800 px : métiers, calculateur béton et planning.

L’avertissement React `act(...)` déjà connu dans `OrganizationProvider.test.tsx` reste visible pendant Vitest sans faire échouer la suite ; il n’est ni masqué ni modifié par ce lot.

Ce lot ne modifie ni schéma, ni migration, ni RLS, ni fonction serveur, ni hook métier, ni permission, ni route.

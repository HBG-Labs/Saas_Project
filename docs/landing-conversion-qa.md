# Landing REZO360 — passe conversion du 24 septembre 2026

## Périmètre

Implémentation des recommandations UX/CRO validées : produit dans le hero,
parcours produit à commandes explicites et aperçu agrandi, regroupement des
univers, suppression des sections redondantes, clarification Free / essai,
inclusions des formules, liens de réassurance vérifiables, continuité visuelle
vers l'inscription, focus et SEO de base. Les deux films Higgsfield approuvés
sont conservés. Aucun nouvel asset ni crédit consommé.

Les prix, droits des formules, routes d'authentification et logique métier ne
sont pas modifiés. Les formulations de certification non étayées ont été
retirées de la configuration d'affichage des offres et du comparateur.

## Vérifications exécutées

- Production : `npm run build`, succès.
- Tests : `npm run test -- --maxWorkers=2 --reporter=dot`, **217 fichiers / 1 431 tests réussis**.
- ESLint ciblé sur les composants, configurations, tests et scénarios modifiés : succès.
- Prettier ciblé : succès. `git diff --check` : succès.
- `npm run audit:bundle` : dans les limites existantes, sans relever les seuils.
  Démarrage JS : 358,0 Kio gzip / 52 requêtes. CSS cumulé : 52,1 Kio gzip.
  Feuille landing : environ 9,5 Kio gzip.
- Vérification réelle dans le navigateur intégré sur le build de production local.
- Largeurs contrôlées : 320, 360, 375, 390, 412, 430, 768, 1024, 1280, 1440 et 1920 px.
  Aucun débordement horizontal de document ni ancre locale manquante observé.
- Hero desktop / mobile, étapes produit, trois univers, agrandissement et fermeture
  avec Échap, restitution du focus, menu mobile, FAQ et liens vers les offres.
- Passage « Choisir Pro » vers `/register?plan=pro` et retour vers le simulateur.
  Aucun compte créé et aucun formulaire d'authentification soumis.
- Installation : ouverture / fermeture des instructions existantes, sans installer l'appareil.
- Lien d'évitement visible au-dessus du header, activation vers le contenu principal.
- Vidéos muettes, sans lecture automatique : changement de frame et commandes de
  progression ; film final testé dans les deux sens du défilement.
- Transcription : pause / reprise / rejeu disponibles.
- Images affichées chargées, deux vidéos avec `readyState = 4`, aucune erreur média.
- Aucune erreur ou alerte console observée pendant le parcours landing.
- Un seul H1, titre descriptif, canonical existant, sitemap et déclaration robots.

## Limites et points restant à confirmer

- Ce sont des contrôles responsive dans un navigateur desktop, pas des essais
  sur des appareils Android / iPhone physiques.
- Le mode reduced-motion et le repli sans IntersectionObserver sont couverts
  par les tests unitaires ; les préférences système de l'utilisateur n'ont pas été changées.
- Les scénarios Playwright du dépôt ont été mis à jour, mais cette passe a utilisé
  le navigateur intégré pour la QA et n'a pas exécuté la suite Playwright.
- Aucun résultat de Core Web Vitals terrain ou d'INP n'est revendiqué. Le contrôle
  du bundle n'est pas une mesure de rapidité sur un réseau mobile réel.
- Un avertissement React `act(...)` subsiste dans le test préexistant
  `FeedbackStates.test.tsx`, hors landing, sans échec de test.
- Mention HT / TTC en attente de confirmation commerciale. Le texte existant
  des conditions générales, « hors taxes le cas échéant », est conservé.
- Prérendu SEO, persistance de l'intention tarifaire après authentification et
  expériences A/B restent des chantiers séparés ; aucun changement implicite du
  démarrage d'essai ou du paiement n'a été introduit.
- Aucun push / déploiement effectué dans cette passe.

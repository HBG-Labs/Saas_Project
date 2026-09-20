# REZO360 Atelier — lot A

La direction a été validée explicitement par Harry le 20 septembre 2026, après les quatre maquettes (tableau de bord, fiche client, facturation, paramètres) et leurs adaptations mobiles. Ses précisions sont intégrées : Nunito comme Tiime, boutons en pilule, actions vertes et navigation plus colorée, proportions affinées. Cette validation remplace la demande historique de trois directions dans la passation.

Harry a également validé explicitement le rétablissement des neuf couleurs historiques après présentation du commit `d030566` et des captures ordinateur/mobile. Cette version constitue la référence du lot A pour l’intégration locale.

## Périmètre de ce lot

- Nunito variable auto-hébergée pour l'interface et les titres. IBM Plex Sans reste la police du logotype. La vitrine garde ses familles IBM Plex / Archivo et sa palette claire verrouillée.
- En mode Automatique : actions principales vertes, sélection lavande, repères ambre pour les devis et corail pour les achats, Workspace azur, compte ardoise. Les huit choix manuels retrouvent les familles historiques marine, bleu, violet, vert, rouge, ambre, rose et cyan. Le choix colore les boutons, les liens, le focus et les sélections de navigation ; les statuts métier gardent leurs propres couleurs.
- Boutons partagés en pilule : 34 px par défaut au pointeur, 44 px au doigt. Champs : 36 / 44 px. Le minimum tactile s'applique aussi aux tablettes et au mode compact ; la saisie tactile reste à 16 px.
- Barre latérale 212 px, barre repliée 68 px, en-tête 60 px. Les sections, les destinations et leur filtrage sont conservés. Le choix d'univers reste accessible dans la barre repliée et dans le menu mobile ; les libellés du sélecteur mobile restent visibles.
- Cartes partagées moins arrondies, sans ombre systématique. Actions du `PageHeader` à largeur de libellé sur mobile.
- Transitions courtes, ouverture latérale effective, respect de `prefers-reduced-motion`, y compris à la fermeture par balayage.

Les compositions métier, les tableaux écrits directement dans les pages, leurs boutons locaux et les réglages complets restent à reprendre dans les lots B à E. Ce lot n'affirme donc pas que toutes les pages reproduisent déjà les maquettes.

## Typographie et couleurs

La feuille de styles publique de `https://apps.tiime.fr/` consultée pendant la conception déclare `body { font-family: Nunito, Helvetica Neue, sans-serif }`. Le fichier latin variable utilisé est celui déclaré par cette feuille. La licence SIL OFL 1.1 accompagne le fichier dans `src/assets/fonts/Nunito-OFL.txt` ; aucun appel CDN n'est nécessaire au rendu.

- Source CSS observée : `https://apps.tiime.fr/releases/e0800fbb23528b11204744eeb0a794dd13ad4c76/styles-V3QLLALK.css`
- Police : `https://fonts.gstatic.com/s/nunito/v32/XRXV3I6Li01BKofINeaB.woff2`
- Licence : `https://github.com/google/fonts/blob/main/ofl/nunito/OFL.txt`

L'encre sombre sur les aplats verts/lavande est volontaire : le blanc des références ne tient pas le contraste des petits libellés. Les états normal, survol et appui sont mesurés à 4,5:1 minimum, et à 7:1 dans le mode Contraste élevé. Les pastilles manuelles reprennent les valeurs historiques exactes ; les tons des textes et commandes sont ajustés lorsque nécessaire pour leur lisibilité. Le fond nuit existant est conservé et les trois jeux d’accent sont vérifiés contre leurs surfaces.

## Architecture et coordination

Base de travail initiale : `05cac07`. Après validation, la branche `codex/atelier-foundations` intègre les commits Workspace de `main` jusqu’à `89f8bea`, sans conflit ni modification de leur contenu. Les changements fonctionnels non commités de la copie principale restent indépendants. Le diff visuel par rapport à `89f8bea` ne modifie ni router, ni configuration des routes et de la navigation, ni hooks métier, API, permissions, données ou fichiers Supabase. Aucune migration n’est exécutée.

La passation décrit encore React Router 7 et 166 migrations : le dépôt de départ utilise React Router 8.3 et contient le travail Finance ultérieur. Ces écarts documentaires ne justifient aucun retour arrière.

La revue de Claude attendue par la passation porte sur le diff du lot A par rapport à `89f8bea`. La validation de Harry autorise son intégration locale après les contrôles. Elle ne déclenche pas de déploiement en ligne.

## Vérification

Les tests de palette couvrent les six surfaces existantes et les nouveaux couples d'aplats/encre des trois thèmes. Les tests de navigation couvrent le choix replié, la restitution du focus et l'absence d'univers dans la navigation technicien. Deux mutations temporaires (encre identique à l'aplat, suppression du sélecteur replié) ont bien provoqué un échec avant restauration.

`e2e/parcours/10-atelier.spec.ts` vérifie dans le navigateur la police chargée, les dimensions, les thèmes, le formulaire client et son retour de focus, les univers sur ordinateur/mobile et la réduction du mouvement. Les parcours existants restent exécutés avec les fixtures et l'origine factice de la configuration Playwright. Les résultats de la livraison et les captures sont consignés dans le compte rendu associé.

`e2e/parcours/11-couleurs.spec.ts` vérifie les neuf choix, leur effet visible sur les commandes, les cibles tactiles, la persistance, les sélections de navigation, le passage en mode nuit et la réinitialisation.

La revue visuelle d’intégration a révélé une grille de Paramètres trop large sur téléphone. Une colonne mobile explicite et une largeur minimale nulle sur la navigation évitent que les commandes soient coupées. Le test mesure désormais les bornes de chacun des neuf boutons, car la largeur du document seule masquait le défaut. Il a échoué sur le build précédent (bouton Cobalt à 521 px pour un écran de 375 px) avant correction.

Après revue du lot A : B Gestion ; C Workspace ; D Finance ; E transversal ; F vérification finale. Chaque lot garde ses propres tests, contrôle visuel ordinateur/mobile et validation avant le suivant.

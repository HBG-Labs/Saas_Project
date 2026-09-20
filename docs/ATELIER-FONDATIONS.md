# REZO360 Atelier — lot A

La direction a été validée explicitement par Harry le 20 septembre 2026, après les quatre maquettes (tableau de bord, fiche client, facturation, paramètres) et leurs adaptations mobiles. Ses précisions sont intégrées : Nunito comme Tiime, boutons en pilule, actions vertes et navigation plus colorée, proportions affinées. Cette validation remplace la demande historique de trois directions dans la passation.

## Périmètre de ce lot

- Nunito variable auto-hébergée pour l'interface et les titres. IBM Plex Sans reste la police du logotype. La vitrine garde ses familles IBM Plex / Archivo et sa palette claire verrouillée.
- Actions principales vertes, sélection lavande, repères ambre pour les devis et corail pour les achats, Workspace azur, compte ardoise. Les liens, le focus et les neuf préférences d'accent restent bleus : les aplats d'action utilisent des jetons distincts de `--primary`.
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

L'encre sombre sur les aplats verts/lavande est volontaire : le blanc des références ne tient pas le contraste des petits libellés. Les états normal, survol et appui sont mesurés à 4,5:1 minimum, et à 7:1 dans le mode Contraste élevé. Le fond nuit existant reste calibré avec les neuf accents ; ce lot ne recalcule pas cette rampe.

## Architecture et coordination

Base de travail : `05cac07`. La copie principale contenait des changements fonctionnels non commités ; ils ne sont pas inclus ni modifiés dans la branche `codex/atelier-foundations`. Le router, la configuration des routes et de la navigation, les hooks métier, API, permissions, données et fichiers Supabase sont inchangés.

La passation décrit encore React Router 7 et 166 migrations : le dépôt de départ utilise React Router 8.3 et contient le travail Finance ultérieur. Ces écarts documentaires ne justifient aucun retour arrière.

La revue de Claude attendue par la passation doit porter sur le diff de ce lot, puis sur l'intégration avec ses travaux fonctionnels. Aucun déploiement ni fusion dans la branche principale n'est effectué par ce lot.

## Vérification

Les tests de palette couvrent les six surfaces existantes et les nouveaux couples d'aplats/encre des trois thèmes. Les tests de navigation couvrent le choix replié, la restitution du focus et l'absence d'univers dans la navigation technicien. Deux mutations temporaires (encre identique à l'aplat, suppression du sélecteur replié) ont bien provoqué un échec avant restauration.

`e2e/parcours/10-atelier.spec.ts` vérifie dans le navigateur la police chargée, les dimensions, les thèmes, le formulaire client et son retour de focus, les univers sur ordinateur/mobile et la réduction du mouvement. Les parcours existants restent exécutés avec les fixtures et l'origine factice de la configuration Playwright. Les résultats de la livraison et les captures sont consignés dans le compte rendu associé.

Après revue du lot A : B Gestion ; C Workspace ; D Finance ; E transversal ; F vérification finale. Chaque lot garde ses propres tests, contrôle visuel ordinateur/mobile et validation avant le suivant.

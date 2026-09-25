# REZO ALIVE — direction 5

Direction choisie par l’utilisateur le 25 septembre 2026 à partir de sa planche de cinq propositions.

## Langage visuel

- Bleu nuit `#09131E`, surfaces `#0F1D2C`, texte clair, bleu d’action `#1B44C8`.
- Archivo Variable, poids 550–560 pour les grands titres ; hiérarchie hero / sections / détails, sans multiplier les polices.
- Grille de 1 280 px maximum, marges desktop de 48 px minimum, marges mobile de 24 px.
- Photographies de début et de fin de journée ; interfaces réelles au centre du récit. Les scènes photographiques sont des illustrations générées, pas des clients ou témoignages.
- Angles de 4–8 px pour les surfaces ; cadre de téléphone arrondi uniquement pour évoquer le matériel.
- Chronologie discrète, séparateurs fins, aucun halo néon ni effet de verre décoratif.

## Parcours

Hero terrain → parcours planning / intervention / compte rendu / facture / paiement → usage mobile → note vocale et document → Gestion / Workspace / Finance → éléments concrets à explorer → offres → FAQ → fin de journée et inscription.

Les prix et liens proviennent toujours de `src/config/pricing.ts`. Les quatre offres payantes et Free sont conservées. Le compte Free concerne les outils techniques ; l’essai d’une offre payante nécessite une activation séparée avec carte. Aucun témoignage, logo client ou chiffre de performance n’a été inventé.

## Mouvement et responsive

Sur les écrans d’au moins 1 100 × 760 px, le défilement sélectionne successivement les cinq écrans dans un cadre sticky. Aucune interception de la molette ni aucun déplacement imposé. Une sélection manuelle suspend la synchronisation ; un bouton permet de la reprendre.

Sur mobile et en mouvement réduit, le parcours est statique et pilotable par boutons. La démonstration vocale est finie, se suspend hors écran et dispose de commandes pause/reprise/rejeu. Sur téléphone, deux vues permettent de consulter la note puis le compte rendu sans empiler les deux panneaux. Le mode réduit présente le contenu terminé. Les photos remplacent les anciens films MP4 sur la landing.

La palette reste limitée à `.landing-shell` et au menu associé ; elle ne modifie pas le thème enregistré de l’application ni la palette du formulaire d’inscription.

## Vérification

- Inspection du rendu dans le navigateur à 1 440 × 900 et 390 × 844, du hero au footer.
- TypeScript et build Vite validés via le serveur de test isolé ; ESLint ciblé et `git diff --check` sans erreur.
- 14 tests unitaires ciblés validés : landing, tarifs, shell public et composants de films conservés.
- 24 scénarios E2E desktop/mobile validés au fil des exécutions ; le contrôle de capture mobile a été corrigé pour attendre le chargement natif des images lazy. La dernière exécution des 8 scénarios mobile affectés passe intégralement.
- Absence de débordement vérifiée de 320 à 1 920 px. Navigation, liens commerciaux, clavier, zoom, défilement dans les deux sens, priorité au choix manuel, changement de préférence de mouvement, pause/reprise/rejeu et retour à la palette d’inscription couverts.
- Aucun déploiement réalisé.

## Assets créés

Mode : outil ImageGen intégré (pas d’appel CLI ni de clé API). Génération de deux photographies de 1 536 × 1 024 px. Encodage WebP et redimensionnement avec Pillow, sans retouche du contenu généré.

| Usage | Fichier | Poids |
| --- | --- | --- |
| Hero desktop | `public/images/landing/alive-dawn-1536.webp` | 156 714 octets |
| Hero mobile | `public/images/landing/alive-dawn-800.webp` | 47 900 octets |
| Conclusion desktop | `public/images/landing/alive-dusk-1536.webp` | 142 074 octets |
| Conclusion mobile | `public/images/landing/alive-dusk-800.webp` | 54 224 octets |

Les originaux PNG restent dans `C:/Users/HBZ/.codex/generated_images/01a0d6f7-a4aa-77b0-bc03-5bf6ef227154/` : `exec-6c44a6b4-defe-43d5-a75d-c72ff90b0c26.png` et `exec-46b118e8-6180-4cd7-ad50-85d07f81d482.png`.

### Prompt du hero

> Use case: photorealistic-natural. Asset type: cinematic background photograph for the REZO360 website, an established field-service software brand. Generate a wide 3:2 editorial photograph, high quality, no text, no typography, no logos, no website UI. Scene: a quiet French countryside access road at dawn, a dark navy blue professional utility van parked on the RIGHT THIRD seen from behind at a gentle three-quarter angle, realistic European work van, unbranded. A field technician in work clothes stands naturally beside the van, small in the composition, looking towards the next work site. Grounded everyday professional atmosphere. Dark blue early morning sky and distant tree silhouettes, a restrained warm amber sunrise near the horizon on the right. LEFT HALF is subdued dark open sky and landscape with clean negative space for a large white website headline. Camera eye level, 35mm lens, exceptionally natural photographic textures, subtle atmospheric depth, refined restrained cinematic color grading. Composition must work as a wide desktop crop and a centered-right mobile crop. Avoid luxury car advertising, fantasy landscapes, cyberpunk, neon, blue glow, overdramatic lighting, sci-fi, CGI look, visible brand marks, letters or numbers. The image should feel like the beginning of a real working day.

### Prompt de conclusion

> Use case: photorealistic-natural. Asset: closing editorial photograph for REZO360, a professional field-service software website. Wide landscape 3:2 photograph. Natural rear three-quarter view of a male field technician in a dark navy work jacket, carrying a modest work bag, standing on the RIGHT THIRD near a quiet work site in the French countryside at sunset. Subject medium scale, photographed from behind, face not visible. Low sun warm amber on distant horizon, subdued tree line and ordinary countryside, grounded daily professional life. The LEFT HALF of the image is low-detail dark navy shadow and open landscape, generous negative space for white website typography. Restrained filmic color grading, realistic 35mm photography, natural anatomy, practical worn workwear, subtle warm rim light. It should feel like a job well done and the calm end of a real working day. No text, no lettering, no numbers, no brand logos, no site UI, no sci-fi, no neon, no glowing graphic lines, no luxury advertising, no illustration, no artificial CGI look.

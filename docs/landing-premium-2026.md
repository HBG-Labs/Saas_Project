# REZO360 — landing premium, septembre 2026

## Audit avant intervention

État de départ : refonte interrompue déjà présente dans le worktree. Route `/` chargée paresseusement sous `PublicLayout`. React 19, Vite, Tailwind 4, CSS isolée. Police globale Nunito, marque IBM Plex. Captures existantes authentiques mais anciennes (`public/images/product`), navigation ne montrant pas les trois univers actuels.

Défauts identifiés : trop de sections semblables, maquettes HTML Workspace/Finance, tableau de bord peu lisible sur mobile, typographie et métadonnées très petites, onglets incomplets au clavier, animation waveform permanente, cartes tarifaires masquées derrière un carrousel mobile, allégation « Le plus choisi » non prouvée. Le menu mobile devait conserver un accès direct à la connexion.

Contrats conservés : `/register`, `/register?plan=…`, `/login`, `/dashboard`, `/features`, `/tools`, `/tutoriels`, `/pricing`, `/faq`, liens légaux, installation PWA, Meta Pixel centralisé et soumis au consentement. Aucun formulaire métier dans la landing. Aucun changement de backend, authentification, RLS ou migration.

Tarifs vérifiés dans `src/config/pricing.ts` : Free 0 € (1 utilisateur), Starter 19 € (2), Pro 39 € (5), Business 69 € (10), Enterprise 99 € (20). Utilisateur supplémentaire : 5 €/mois sur les offres payantes. Mensuel uniquement. L’inscription crée Free ; l’essai de 14 jours d’une offre payante s’active ensuite dans l’espace avec carte.

## Direction et architecture

Archivo auto-hébergée sur la landing, grands titres, blanc chaud, anthracite et bleu `#1B44C8`. Bordures fines, angles sobres, ombres physiques. Les captures réelles constituent les visuels principaux. Les données de capture sont fictives et signalées comme démonstration.

Ordre actuel : promesse et CTA → film du technicien au scroll → grande composition dashboard/mobile → produit au fil du scroll → terrain → Gestion / Workspace / Finance → fil du dossier → Workspace → voix et document → desktop vers mobile → finance → preuves vérifiables → tarifs → FAQ → vidéo de conclusion et final bleu.

Référence de finition consultée : https://www.tiime.fr/ — titres affirmés, promesse directe, rythme entre contenu et produit, CTA cohérents. Aucun asset ou dessin Tiime repris.

## Interfaces réelles

Nouvelles captures générées avec les composants applicatifs et les fixtures Playwright, sur une origine backend fictive. Aucune connexion à la base de production.

Sources : DashboardPage, PlanningPage, MissionsListPage, ReportEditorPage, WorkspacePagesPage, DocumentLibraryPage, QuoteHistoryPage, InvoiceDetailPage et InterventionPage mobile. Les interfaces ne sont pas réinventées par génération d’image.

## Registre Higgsfield

Enveloppe autorisée : 150 crédits. Première production ≤110. Réserve ≥40.
Solde réel initial retourné par Higgsfield : 185,66 crédits ; les 35,66 crédits supplémentaires restent hors enveloppe.

| Asset | Job | Modèle | Réglages | Coût exact | Décision |
|---|---|---|---|---:|---|
| Décor lumineux Hero | 88e18530-dd54-4eb2-bb2b-91059198d13b | GPT Image 2.5 | Flare, high, 2K, 16:9, 1 image | 2,75 | Conserver |
| Professionnelle sur le terrain | 3924c9c7-6e19-406c-b68b-a7748f1ae884 | GPT Image 2.5 | Flare, high, 2K, 3:2, 1 image | 2,75 | Conserver |

### Enrichissement visuel et propositions de personnages

| Asset | Job | Modèle | Coût | Décision |
|---|---|---|---:|---|
| Décor architectural de pied de page | Génération antérieure à cette passe | Higgsfield | 15 | Intégration et fichiers retirés à la demande de l’utilisateur ; coût comptabilisé |
| Première candidate pour le film | 557d933c-4307-47bc-8c6e-317896d859f6 | GPT Image 2.5, Flare, xhigh, 4K | 7 | Non retenue après demande d’un homme antillais ou métis |
| Technicien principal | 219dcaa0-3488-4a9d-aaea-33a8dad205e0 | GPT Image 2.5, Flare, xhigh, 4K | 7 | Conserver, affiche du film |
| Film de terrain, 5 secondes sans son | 99ff3733-9042-48e0-adb0-16a070d084a1 | Kling 3.0 Pro | 8,75 | Conserver, progression liée au scroll |
| Collaboration Workspace | 0530db89-550d-4667-b780-4a9cc157b710 | GPT Image 2.5, Flare, xhigh, 4K | 7 | Conserver |
| Technicien mobile, extérieur | 8422d76c-2d5e-45b6-9baa-1cc6b69f82ec | GPT Image 2.5, Flare, xhigh, 4K | 7 | Retiré de la landing pour éviter le doublon de dictée vocale ; asset conservé sur disque |
| Autre personnage demandé | ac3029b6-fc59-4a98-99a4-854a21fef380 | GPT Image 2.5, Flare, xhigh, 4K | 7 | Proposition archivée ; l’utilisateur a confirmé que le film existant est déjà validé |
| Photo transcription, première proposition masculine | a942c1b4-7f6a-447b-b541-b3e357e684ec | GPT Image 2.5, Flare, xhigh, 4K | 7 | Archivée ; demande d’une femme reçue alors que la génération était en cours, sans outil d’annulation disponible |
| Technicienne dictant une note vocale | 29436e29-a05e-430a-b852-952fa11d2f4d | GPT Image 2.5, Flare, xhigh, 4K | 7 | Conserver, intégrée uniquement à la section transcription |
| Le dernier geste — outils rangés | 6a1aabeb-1991-4ae5-bc71-22c785e4e10c | GPT Image 2.5, Flare, xhigh, 4K | 7 | Conserver comme image de départ et affiche du film de conclusion |
| Film de conclusion — mallette refermée, 5 secondes sans son | 88e07ee2-c453-424c-adab-7e4e35984ded | Kling 3.0 Pro | 8,75 | Conserver, véritable geste animé piloté au scroll |

Total dépensé confirmé : **94 crédits**, y compris les propositions non retenues et l’ancien décor retiré. Enveloppe restante : **56** ; première production encore disponible : **16** ; réserve de **40** intacte. Solde réel vérifié après le film de conclusion : **91,66**.

Chaque génération a fait l’objet d’un préflight de coût. Les visuels intégrés ont été inspectés. Pas de variantes automatiques : la photo vocale féminine répond à la nouvelle préférence reçue pendant la génération masculine. Le Hero est un décor sans interface. La scène terrain présente un écran vierge sur lequel la vraie capture mobile est superposée en CSS. Les animations Voix et Finance restent réalisées en code. Après le retrait de l’ancien décor, l’utilisateur a demandé une nouvelle image Higgsfield animée au scroll pour le final : la photographie « Le dernier geste » répond à cette nouvelle demande.

Les originaux sont dans `artifacts/higgsfield`. Les images intégrées sont servies en WebP optimisé depuis `public/images/landing` (Hero ~50 Ko, terrain initial 1800px ~95 Ko, affiche du film 1800px ~156 Kio, équipe 1800px ~205 Kio). Le film est réencodé en H.264 sans audio, avec images clés rapprochées et faststart ; une version mobile est distincte. Il est chargé à proximité de la section, et jamais en mode reduced-motion. La nouvelle proposition de personnage reste séparée des visuels intégrés.

## Mouvement et accessibilité

Révélations uniques via IntersectionObserver ; observer déconnecté après apparition. Séquence produit sticky seulement sur grands écrans assez hauts ; contrôles directs ailleurs. Aucun détournement de la molette. Séquences voix/finance finies avec pause/relecture, suspendues hors écran et onglet masqué. `prefers-reduced-motion` montre le contenu terminé.

Focus bleu solide, contrôles tactiles de 44px minimum, menu Radix avec titre/description, FAQ bouton/panneau associés. Titres sémantiques et descriptions d’images. Aucune note client, statistique commerciale ou logo client inventé.

## Vérification

La matrice landing couvre 320, 360, 375, 390, 412, 430, 768, 1024, 1280, 1440 et 1920px, sur Chromium et émulation Android. Les contrôles portent sur les conversions, navigation, menu, séquences, images, erreurs navigateur, débordements, réduction du mouvement et SEO.

Les mesures de laboratoire doivent être distinguées des Core Web Vitals réels, qui nécessitent des données après déploiement. Aucun déploiement n’est effectué par cette mission.

### Résultats de la passe finale

- Build production `npm run build` : réussi (TypeScript + Vite).
- ESLint ciblé : aucune erreur ni warning applicatif.
- Tests unitaires PublicLayout / Pricing / router : 26 réussis.
- Playwright landing + motion + smoke : 41 réussis, 1 exclusion intentionnelle (scroll desktop sur projet Android). Les 11 largeurs demandées sont testées sur les deux projets navigateur. Après correction des ancres natives du header et du menu, les 17 tests landing/motion ont été relancés et réussis, y compris leur position d’arrivée sous le header.
- Console de la landing : aucune erreur ni warning applicatif pendant le parcours de conversion.
- Animations : progression scroll, visibilité de la vraie capture, pause/reprise/rejeu voix et finance, transition mobile et reduced-motion vérifiés.
- Dernier chargement local initial, production, sans throttling : LCP desktop 960 ms / Android émulé 768 ms ; CLS observé 0,00447 / 0,00141. Ces valeurs ne remplacent ni les données terrain au 75e percentile, ni un test sur téléphone physique, ni une mesure INP.
- Budget bundle production : démarrage 356,9 Kio gzip ; styles marketing isolés ~9,2 Kio gzip ; CSS toutes routes 51,4 Kio. Plafond global CSS documenté de 50 à 52 Kio, avec un nouveau garde-fou spécifique landing de 10 Kio. Aucun seuil JavaScript relevé, aucune bibliothèque d’animation ajoutée.
- Aperçu social : JPEG 1200 × 630, 75 Ko, véritable dashboard.

Polish : proportions Hero, vrais écrans récents, incrustation mobile dans la photographie, blancs du pricing, focus blanc sur carte sombre, contrastes secondaires, dimensions d’images, états CSS actifs, libellés d’essai et qualification des démonstrations. La mention commerciale « certifiés » n’est pas reprise, faute de preuve de certification dans le périmètre audité.

Les fichiers `dist-captures` et les originaux marketing sont ignorés par Git. Les builds E2E utilisent une origine fictive et ne doivent jamais être déployés. Seul `dist` est le build de production normal. Les autres modifications de l’espace de travail sont laissées intactes.

### Vérification de l’enrichissement visuel

Build production et ESLint ciblé réussis. Audit bundle réussi : démarrage 356,8 Kio gzip, CSS cumulé 52,3 Kio gzip. Plafonds CSS portés à 53 Kio global et 11 Kio marketing pour les scènes photographiques et le film ; aucun plafond JavaScript relevé et aucune bibliothèque ajoutée. Les résultats de la passe précédente ci-dessus ne constituent pas une validation automatique des nouveaux médias. La validation navigateur de cette passe est suivie séparément.

Tests de cette passe : 17 tests landing/motion réussis, 1 exclusion intentionnelle Android. Après correction de la sélection du média, du contrôle Home/End et de la classe CSS reduced-motion, les 4 tests du film réussissent sur Chromium et Android émulé : défilement aller/retour, clavier, absence d’autoplay et absence de téléchargement vidéo avec mouvement réduit. Nouveau build production réussi. Les avertissements observés dans le terminal concernent les variables de couleur du lanceur et les timings des plugins Vite, pas une erreur de console applicative. Aucun remplacement vidéo n’a été généré avec le personnage alternatif.

### Photo de transcription audio

Image dédiée de technicienne dictant sur un smartphone : WebP 800px ~36 Kio et 1800px ~130 Kio, dimensions réservées, srcset et chargement différé. Prompt archivé dans `docs/landing-voice-image-prompt.md`. Aucun texte ni écran applicatif généré dans la photographie. La séquence existante reste explicitement une démonstration illustrée ; elle démarre lorsque le panneau animé devient visible, pas dès l’entrée de la photographie dans l’écran. La vidéo au scroll validée n’a pas été modifiée.

Validation de cette intégration : build et ESLint ciblé réussis ; bundle dans les plafonds existants (CSS 52,5 Kio gzip). 17 tests landing/motion réussis et 1 exclusion prévue, dont les 11 largeurs responsive ; puis 4 tests voix/finance et reduced-motion relancés après le déplacement de l’observation sur le panneau animé, tous réussis. Captures desktop et mobile inspectées visuellement. Pas d’erreur ou warning applicatif remonté par les parcours de console contrôlés. Aucun déploiement effectué.

### Suppression de la redondance photographique

Le geste de dictée au téléphone est réservé à la photographie de transcription. La section mobile présente maintenant uniquement les véritables interfaces ordinateur et smartphone avec leur transition existante. La photo masculine mobile et ses styles de superposition sont retirés de l’affichage, sans supprimer les fichiers source. La vidéo au scroll validée et la technicienne de la section transcription restent inchangées. Aucun crédit supplémentaire consommé.

Build, ESLint ciblé et audit bundle réussis. 16 tests fonctionnels landing/motion réussis, 1 exclusion prévue ; la capture mobile pleine page a rencontré une erreur Chromium puis a réussi à l’échelle CSS. Captures de la section mobile inspectées sur desktop et mobile. Le nouveau test vérifie que les deux images de cette section proviennent exclusivement des captures produit. Une proposition de final photographique animé est discutée séparément, sans génération ni modification du final à ce stade.

### Final Higgsfield — Le dernier geste

Photographie générée et inspectée, sans téléphone ni interface artificielle. Originaux dans `artifacts/higgsfield/closing-workday.png` ; WebP 800px ~55 Kio et 1800px ~185 Kio. Prompt et référence du job : `docs/landing-closing-image-prompt.md`.

Première proposition : `ClosingScene` ouvrait le cadre et réduisait légèrement l’échelle de l’image selon la position du scroll. L’utilisateur a précisé attendre une véritable vidéo, et non une image transformée ; cette implémentation est remplacée par le film décrit ci-dessous. Le véritable éditeur de compte rendu reste intégré séparément.

Validation : build production, ESLint ciblé et audit bundle réussis sans relever les plafonds (JS cumulé 1150,0 Kio gzip ; CSS cumulé 52,5 Kio). 14 tests Playwright réussis sur Chromium et Android émulé : animation réversible, bascule reduced-motion, CTA, clavier, navigation, images et 11 largeurs de 320 à 1920px. Captures du final desktop/mobile inspectées. Les empreintes SHA-256 du composant FieldFilm et des deux fichiers vidéo sont inchangées. Aucun déploiement effectué.

### Réorganisation validée et vidéo finale dégagée

L’utilisateur a validé l’inversion des visuels d’ouverture : titre et CTA restent en tête, puis viennent le film terrain, le dashboard avec mobile et la démonstration détaillée. `Hero` et `ProductIntro` sont maintenant distincts. La durée de défilement du film est raccourcie de 175 à 155svh sur desktop et de 155 à 145svh sur mobile ; aucun fichier vidéo n’est modifié. Les captures produit passent en lazy loading et leur entrée est déclenchée à leur apparition, plutôt qu’au chargement de la page.

La capture de compte rendu superposée au film de conclusion est retirée, ainsi que son CSS dédié ; son fichier reste disponible pour les autres sections. Vidéo, contrôle de progression, mode réduit et CTA final conservés. Aucun crédit Higgsfield supplémentaire : total 94, réserve 40 intacte.

Validation : build production, ESLint ciblé, audit bundle et 20 tests Playwright desktop/Android réussis. Ordre DOM, CTA en tête, absence de capture superposée, deux films au scroll, clavier, modes dégradés et 11 largeurs vérifiés. Captures desktop/mobile inspectées. JS cumulé 1150,2 Kio gzip ; CSS 52,5 Kio. Aucun déploiement.

### Correction précédente — véritable vidéo de conclusion au scroll

À la demande explicite de l’utilisateur, la photographie transformée est remplacée par une vidéo Higgsfield Kling 3.0 Pro de 5 secondes : le professionnel range la clé puis referme réellement la mallette. Prompt et identifiant du job dans `docs/landing-closing-video-prompt.md`. Planche de contrôle inspectée avant intégration ; décision : conserver.

`ClosingScene` pilote `video.currentTime` depuis la position naturelle de la page, en avant et en arrière. Le cadre reste sticky pendant une courte distance de 75svh, sans intercepter la molette ni lancer une lecture automatique. Un contrôle clavier permet également Home/End et les flèches. Le film est muet ; aucun décodeur, lecteur ou framework d’animation supplémentaire. Version desktop H.264 1440×810 : 2 635 072 octets ; mobile 960×540 : 1 363 760 octets ; 24 images/seconde, images clés tous les 6 frames, faststart. Chargement seulement à proximité du final. Le mode reduced-motion évite le téléchargement vidéo et garde la photo ; une erreur média revient aussi à une composition statique sans espace de scroll vide. Le premier film validé est indépendant et inchangé.

Validation de cette correction : build production, ESLint ciblé et audit bundle réussis (JS cumulé 1150,2 Kio gzip, CSS 52,6 Kio, sans relever les plafonds). **20 tests Playwright réussis** sur Chromium et Android émulé : progression avant/arrière avec vérification de véritables pixels vidéo différents, position sticky, clavier, absence d’autoplay, mode réduit et changement de préférence, erreur média, première vidéo, conversions, navigation, images, SEO et 11 largeurs de 320 à 1920px. Captures vidéo ouverte/fermée inspectées sur desktop et mobile. Aucune erreur de console applicative dans les parcours contrôlés. Empreintes SHA-256 de `FieldFilm.tsx` et des deux fichiers `technician-scroll*.mp4` vérifiées inchangées. Aucun déploiement effectué.

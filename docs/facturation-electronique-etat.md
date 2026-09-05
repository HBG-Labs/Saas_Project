# Facturation électronique — état au 4 septembre 2026 (UTC)

## Parcours disponible

- Nouvelle page `/organisation/facturation-electronique` : identité légale, adresse, régime de TVA et coordonnées bancaires. Les informations sont partagées avec l’organisation, avec respect des droits de modification.
- La progression mesure les informations renseignées. Elle ne certifie ni leur exactitude juridique ni un raccordement à une plateforme agréée.
- Type de client explicite : entreprise, particulier ou organisme public. L’émission exige que le type soit renseigné.
- Conversion d’un devis accepté en brouillon. Correction du destinataire, de l’échéance, des conditions de règlement et des prestations ; reprise explicite de la fiche client.
- Enregistrement du brouillon par une seule transaction. Les modifications concurrentes de l’en-tête ou des lignes invalident sa version et empêchent d’écraser une autre correction.
- Émission contrôlée : numéro et date attribués par la base, identité de l’émetteur figée. Le document émis reste immuable ; les coordonnées actuelles de l’entreprise ne remplacent jamais son instantané.
- Impression lisible de la facture. Le PDF issu de l’impression navigateur n’est pas un fichier Factur-X.
- Les mentions « envoyée » et « payée » restent des déclarations manuelles, sans transmission ni encaissement automatique.

## Nouvelle étape : premier export UBL

- Le brouillon contient la date effective de prestation/livraison, la nature de l’opération, la référence acheteur, le bon de commande, une éventuelle adresse de livraison distincte, l’escompte, les pénalités de retard et l’option TVA sur les débits.
- Les principales mentions commerciales sont contrôlées à l’émission dans l’interface et dans la base. Elles sont ensuite figées avec la facture. Une adresse de livraison partielle est signalée.
- Les mentions de règlement sont partagées entre l’impression et l’export. L’indemnité forfaitaire de recouvrement de 40 € concerne les destinataires professionnels ; elle n’est pas ajoutée aux factures des particuliers.
- Les dates affichées respectent la date du document, quel que soit le fuseau horaire du lecteur. La date d’émission et la série suivent l’horloge UTC de la base.
- Le panneau « Fichier électronique » vérifie les informations du brouillon. Le bouton « Télécharger le fichier UBL » devient disponible sur une facture émise, envoyée ou payée dont les données entrent dans le périmètre pris en charge.
- L’export utilise exclusivement les instantanés figés de la facture émise. Il produit un XML UBL 2.1 au profil de base EN 16931, sans changer le statut et sans transmission externe.
- Le modèle canonique utilise des calculs décimaux exacts et des centimes entiers. Il rapproche les totaux de la base, groupe la TVA par catégorie/taux et refuse les unités inconnues, les incohérences de TVA ou les montants hors précision sûre.
- La page de préparation de l’organisation explique le parcours et propose un accès direct aux factures.

## PDF Factur-X et conservation privée

- Le même modèle canonique produit le CII au profil EN 16931 de Factur-X 1.09.2. L’ordre des éléments est contrôlé par le XSD du profil, en complément des Schematron Factur-X et EN 16931 `validation-1.3.16`. Les contrôles négatifs rejettent un ordre XML incorrect et un total payable faussé.
- Le bouton « Télécharger le PDF Factur-X » appelle la fonction serveur `generate-facturx`, installée sur le projet Supabase lié. Le serveur vérifie la session et les droits actuels, relit l’instantané et les lignes, contrôle les totaux, puis génère un PDF/A-3b avec `factur-x.xml` intégré, relation `Alternative` et métadonnées XMP Factur-X.
- Le document est conservé dans un bucket privé avec ses empreintes SHA-256, sa taille et la version du générateur. Les clients n’ont aucun droit d’insertion, remplacement ou suppression. Les téléchargements utilisent un lien signé de 60 secondes et vérifient l’empreinte reçue. Un document déjà enregistré est réutilisé sans nouvelle génération.
- Une collision d’envoi ou une reprise après interruption ne remplace jamais un fichier. Un fichier déjà téléversé sans métadonnées ne peut être enregistré par la reprise que si son empreinte correspond exactement. Une divergence nécessite une intervention ; elle est signalée sans écrasement.
- Le CII et Factur-X exigent l’IBAN lorsque le mode structuré est un virement. Les motifs de blocage sont affichés automatiquement sur une facture émise. Les exports XML UBL et CII restent disponibles séparément.
- Les cinq PDF synthétiques passent veraPDF 1.30.2 en PDF/A-3b, les contrôles d’attachement exact, de métadonnées et de pagination, sous Node et Deno. Le modèle court tient sur une page ; le jeu long contient 60 lignes et plusieurs pages. Voir [la procédure Factur-X](facturx-validation.md).

La validation complète XSD/Schematron/veraPDF est exécutée sur les fixtures à chaque changement du générateur, pas dans chaque requête serveur. Le stockage protège les documents dans l’application ; il ne constitue pas un système d’archivage électronique certifié.

Le premier export couvre les factures et les avoirs totaux ou partiels nationaux en EUR adressés à une entreprise ou un organisme public, avec les catégories de TVA S, Z, E et AE. Les particuliers, l’international, les acomptes et les profils propres à une plateforme restent à traiter. Les identifiants sont contrôlés sur leur présence et leur format ; aucune vérification dans un registre d’entreprises n’est effectuée.

La réussite des contrôles techniques sur les cas testés ne constitue pas une certification de conformité française exhaustive ni une validation par une plateforme agréée. Les mentions françaises supplémentaires sont conservées dans les données et le texte du document ; le profil français étendu et les règles du futur partenaire devront être intégrés et testés séparément.

## Base et validation

Les migrations suivantes ont été appliquées à la base Supabase liée au projet :

- `20260903070000_invoices.sql`
- `20260903080000_identites_legales.sql`
- `20260903090000_invoice_draft_workflow.sql`
- `20260904011039_invoice_electronic_export_fields.sql`
- `20260904025716_invoice_electronic_documents.sql`

La suite `supabase/tests/06_invoicing_scenario.sql` passe avant et après application. Elle vérifie les permissions entre organisations et rôles, les instantanés, l’immutabilité, la numérotation à l’émission, les versions périmées et l’annulation complète d’un enregistrement invalide. Les données SQL de test sont annulées par transaction.

À cette étape, les 63 tests ciblés de facturation électronique passent, ainsi que la compilation de production et le lint des fichiers concernés. Le lint global reste en échec sur des fichiers hors de cette modification ; aucune réussite globale n’est revendiquée. Les scénarios SQL passent après migration et vérifient aussi les documents privés, l’interdiction d’écritures clientes, l’immutabilité et l’isolation entre organisations et rôles.

Le service déployé répond correctement aux prévols CORS et refuse les méthodes non prises en charge, les requêtes sans session et les sessions invalides. Aucun téléchargement positif de facture réelle n’a été exécuté : la facture actuellement ouverte contient des identifiants client invalides. Aucun document réel n’a été émis, modifié ou envoyé pendant cette étape.

Cinq exports synthétiques passent le schéma XSD officiel OASIS UBL 2.1 et les assertions EN 16931 officielles, version `validation-1.3.16` : TVA standard, franchise en base sans numéro de TVA, taux zéro, autoliquidation et plusieurs taux avec livraison distincte. Un fichier volontairement faussé est rejeté par la règle `BR-CO-16`. Voir [la procédure de validation](ubl-validation.md).

Le contrôle de sécurité Supabase après migration ne signale pas de nouvelle alerte sur les objets de facturation. L’information préexistante concernant `invoice_counters` sans policy est intentionnelle : l’accès direct aux compteurs reste fermé, la numérotation passe par la fonction dédiée. [Explication du contrôle RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Les essais en navigateur sur le compte de démonstration Business ont validé la correction et la relecture du brouillon, les montants, la persistance des nouveaux champs, l’affichage des dates avec un fuseau américain, le blocage du téléchargement définitif pour un brouillon et l’absence d’indemnité de recouvrement ajoutée au particulier. Les pages et le formulaire ont été contrôlés sur ordinateur et sur mobile, sans débordement horizontal ni erreur JavaScript. Les brouillons temporaires ont été supprimés ; aucune facture n’a été émise ni envoyée durant ces essais.

## Contrôle des identifiants avant émission — 4 septembre 2026

Les fiches clients et l’éditeur de brouillon signalent désormais les SIREN/SIRET et numéros de TVA français mal formés directement sous les champs. Les alertes se mettent à jour après correction, changement de pays ou de type de client. Une fiche ou un brouillon incomplet reste enregistrable ; l’émission est bloquée pour un identifiant professionnel français mal formé.

Le contrôle est partagé par la préparation à l’émission et les exports UBL/CII/Factur-X. Le serveur applique également cette garde à la transition du brouillon vers une facture émise, via `20260904104908_invoice_identifier_validation.sql`, appliquée au projet lié. Le générateur Factur-X a été redéployé avec les règles partagées. Les factures déjà émises restent fondées sur leur instantané ; corriger la fiche client ne change pas une facture payée.

Les contrôles portent sur le format, pas sur l’existence dans Sirene ou la validité fiscale dans VIES. Les espaces de présentation et les minuscules du préfixe TVA sont acceptés. Les identifiants étrangers ne sont pas soumis au format français ; le numéro de TVA client absent conserve son avertissement, sans devenir systématiquement obligatoire. Formats de référence : [SIREN — Insee](https://www.insee.fr/fr/metadonnees/definition/c2047), [SIRET — Insee](https://www.insee.fr/fr/metadonnees/definition/c1841), [TVA intracommunautaire — ministère de l’Économie](https://www.economie.gouv.fr/cedef/numero-tva-intracommunautaire).

Vérification : 86 tests ciblés passent, compilation de production et lint des fichiers modifiés réussis, contrôle de types Deno réussi. Le scénario SQL passe avant et après installation dans des transactions annulées : refus via RPC et UPDATE direct, brouillon et version inchangés, aucun numéro consommé lors des refus, émission après correction, cas étranger et TVA client facultative. Aucun document réel n’a été émis pendant ces vérifications.

## Mode test depuis un brouillon — 4 septembre 2026

Le bloc « Fichier électronique » propose désormais « Mode test » et le bouton « Simuler l’émission » sur les brouillons professionnels pris en charge. Il télécharge un PDF Factur-X marqué TEST sur chaque page, avec une référence et une note de simulation dans le XML. Les téléchargements définitifs restent disponibles après émission réelle.

Le serveur utilise les données enregistrées et les mêmes contrôles de contenu que l’export définitif. Il refuse notamment un brouillon devenu obsolète ou modifié pendant sa lecture. Le test ne modifie ni le brouillon ni la numérotation et ne conserve aucun document dans le stockage des factures. Il ne transmet rien à une plateforme.

Les 79 tests du module de facturation électronique et les 10 tests Deno du service passent, ainsi que la compilation de production et le lint des fichiers frontend concernés. Les deux PDF TEST, sur une et cinq pages, passent les contrôles PDF/A-3b, XML et mise en page. Après déploiement du service, un essai depuis l’aperçu local a téléchargé le PDF du brouillon de démonstration. La lecture de la base confirme ensuite le même statut, la même version, la même référence provisoire, zéro document définitif et un compteur de factures inchangé à 2. Le brouillon fictif reste disponible pour les essais demandés par l’utilisateur ; aucune facture réelle n’a été émise.

## Avoir total ou partiel depuis une facture émise — 4 septembre 2026

La fiche d’une facture émise, envoyée ou payée propose « Correction par avoir → Préparer un avoir ». Le formulaire sélectionne toutes les quantités disponibles par défaut, ce qui prépare un avoir total. L’utilisateur peut décocher une ligne ou réduire sa quantité pour obtenir un avoir partiel ; le montant HT/TVA/TTC estimé est recalculé. La création produit uniquement un brouillon. Le serveur recopie les lignes choisies, leurs prix, leurs taux et motifs de TVA, la devise et le destinataire de la facture d’origine ; le numéro et la date de celle-ci sont conservés dans des champs dédiés.

Un éditeur dédié permet de préciser le motif, la date prévue et les modalités de remboursement ou d’imputation. La sélection comptable est fixée lors de la création du brouillon ; supprimer ce brouillon permet de recommencer la sélection avant émission. L’émission explicite utilise la série `AV` existante et fige le document ; elle ne déclenche ni remboursement, ni envoi, ni changement du statut de la facture d’origine. Le document imprimable présente le motif, la référence d’origine et un total « À créditer », sans ajouter de pénalités de retard ou d’indemnité de recouvrement. Le suivi manuel d’un avoir utilise le libellé « Remboursé / imputé ».

Les migrations `20260904165242_invoice_full_credit_notes.sql` et `20260904183000_invoice_partial_credit_notes.sql` sont installées sur le projet lié. Les RPC restent en `SECURITY INVOKER` avec contrôle des permissions existantes et RLS. La création verrouille la facture source et retrouve le brouillon actif en cas de répétition. Plusieurs avoirs émis peuvent corriger la même facture, mais un seul brouillon peut être préparé à la fois. Chaque ligne conserve l’identifiant de sa ligne d’origine. À l’émission, la base verrouille aussi la facture source et refuse tout cumul supérieur aux quantités facturées, y compris lors de deux demandes concurrentes. Supprimer un brouillon reste possible ; un avoir émis demeure immuable et non supprimable.

Validation : 98 tests ciblés des modules factures et facturation électronique, contrôle de types, compilation de production et lint des fichiers frontend modifiés. Les scénarios SQL passent avant et après migration, dans des transactions annulées : deux taux, copie fidèle, nouvelle tentative, version périmée, modification des montants ou du destinataire, permissions, immutabilité et numérotation. Le formulaire de création est vérifié dans le navigateur sur une facture payée, sans le soumettre. Les trois documents existants, leurs versions et leurs statuts sont inchangés ; compteur des factures toujours à 2, aucun numéro d’avoir consommé et aucun document électronique conservé. Les contrôles Supabase ne signalent aucune nouvelle alerte sur les objets de facturation.

```powershell
node scripts/prepare-credit-note-tests.mjs
# Avant installation uniquement : migration et tests annulés dans la même transaction.
npx supabase db query --linked --file test-results/credit-note-before-migration.sql
# Après installation : tests annulés, schéma conservé.
npx supabase db query --linked --file test-results/credit-note-after-migration.sql
```

Les avoirs totaux et partiels émis sont exportables en Factur-X/CII et en UBL CreditNote. Les formats portent le code 381, des montants positifs, le numéro et la date de la facture corrigée, la portée et le motif de correction. Le PDF affiche « AVOIR », « Avoir partiel » le cas échéant, « Total à créditer » et les modalités de remboursement ou d’imputation. Une simulation marquée TEST est disponible sur le brouillon sans écriture ni consommation de numéro. La compensation comptable et le remboursement bancaire automatique ne sont pas implémentés. Les contrôles d’identité existants restent applicables : un identifiant invalide dans l’instantané d’origine peut bloquer l’émission de l’avoir.

Référence utilisée pour les liens à la facture d’origine et les montants HT/TVA : [BOFiP — factures rectificatives et notes d’avoir](https://bofip.impots.gouv.fr/bofip/142-PGP.html/identifiant%3DBOI-TVA-DECLA-30-20-20-20-20220119).

## Suite prévue

1. Ajouter les webhooks du partenaire pour recevoir les statuts sans synchronisation manuelle.
2. Ajouter la réception et l’e-reporting, puis traiter les factures d’acompte selon le périmètre commercial retenu.
3. Traiter séparément l’offre commerciale dédiée à 9,90 €/mois ; aucun tarif ni abonnement n’a été modifié dans cette étape.

Le dépôt B2B et la synchronisation à la demande sont maintenant implémentés. Les identifiants de l’application SUPER PDP sont installés et l’entreprise de démonstration a autorisé le raccordement en bac à sable. La réception, l’e-reporting et la certification réglementaire ne sont pas encore implémentés. Le code frontend est disponible dans l’aperçu local sur le port 5174 ; aucun déploiement du site en production n’a été effectué pendant cette étape.

## Exports électroniques des avoirs — 4 septembre 2026

Le contrat canonique distingue désormais une facture d’un avoir total ou partiel. CII et Factur-X utilisent le type `381` et `InvoiceReferencedDocument`. UBL produit un véritable document `CreditNote` avec `CreditNoteLine`, `CreditedQuantity`, `BillingReference` et la date d’échéance placée dans `PaymentMeans`. Les valeurs sont positives : elles expriment le montant à créditer. Le code de moyen de paiement `1` indique que l’instrument de remboursement n’est pas encore défini ; l’IBAN du vendeur n’est jamais présenté comme destination du remboursement.

Le PDF lisible porte « AVOIR », la référence et la date de la facture corrigée, le motif, « Total à créditer » et les modalités de remboursement ou d’imputation. Les simulations ajoutent « TEST » et « NE PAS COMPTABILISER » sur chaque page et ne sont ni stockées ni numérotées.

Vérification : les 115 tests ciblés de facturation et les 17 tests Deno du générateur passent, ainsi que le typecheck, le lint ciblé et la compilation de production. Dix avoirs synthétiques, cinq totaux et cinq partiels, couvrent TVA standard, franchise, taux zéro, autoliquidation et document long à taux multiples. Ils passent le XSD officiel UBL CreditNote, le XSD et les Schematron Factur-X/EN 16931. Les PDF produits sous Node et Deno, les parcours serveur conservés et les simulations passent veraPDF PDF/A-3b, l’égalité exacte de la pièce jointe XML, les métadonnées, les marges et le contrôle du texte métier. Les exemplaires TEST total et partiel d’une page ont été inspectés visuellement.

Le générateur `rezo360-fx-4` est déployé sur le projet Supabase lié. Après les scénarios transactionnels annulés, la base contient toujours zéro avoir, zéro brouillon d’avoir, zéro document électronique et aucun numéro d’avoir consommé ; le compteur des factures reste à 2. Aucune facture ou avoir réel n’a été créé, modifié ou envoyé pendant cette vérification. Le contrôle Supabase ne signale aucune nouvelle alerte de sécurité ou de performance liée aux objets ajoutés. Le site public n’a pas été redéployé.

## Socle du cycle de transmission — 4 septembre 2026

Les migrations `20260904191003_invoice_transmission_lifecycle.sql` et `20260904192824_invoice_transmission_event_indexes.sql` sont installées sur le projet Supabase lié. Elles ajoutent un état de transport séparé du statut comptable de la facture, une clé d’idempotence stable, le nombre de tentatives, les jalons temporels, l’identifiant attribué par le futur partenaire et un journal immuable des événements. Les codes bruts de plateforme restent conservables sans les confondre avec l’état normalisé présenté dans REZO360.

Le navigateur dispose uniquement d’un droit de lecture sous RLS et avec `invoice.view`. Seul le rôle serveur peut créer ou faire évoluer une transmission. Une facture brouillon est refusée, un état terminal ne régresse pas, l’identifiant du partenaire ne peut pas être remplacé et un même événement externe ne peut pas être enregistré deux fois. Les réponses brutes susceptibles de contenir des données personnelles ne sont pas stockées dans le journal ; une empreinte SHA-256 peut en attester la réception.

La fiche d’une facture émise contient désormais le bloc « Transmission électronique ». Avant le premier dépôt, il affiche « Pas encore transmise » et confirme que les fichiers sont prêts. Le bloc présente ensuite la plateforme, l’état courant, les erreurs, le nombre de tentatives et les 25 derniers événements. L’état de la facture n’est ainsi plus confondu avec l’état de raccordement de l’organisation.

Les scénarios SQL passent avant et après migration dans des transactions annulées. Les 117 tests ciblés des features factures et facturation électronique sont validés, ainsi que le typecheck, le lint ciblé et la compilation de production. Le conseiller Supabase ne signale aucune nouvelle alerte de sécurité ou de performance de niveau avertissement sur ces tables ; les deux index de clés étrangères suggérés au premier passage ont été ajoutés. Aucune ligne de transmission réelle n’a été créée et aucun document n’a été envoyé. Le prochain livrable reste le connecteur sandbox de la plateforme choisie.

## Raccordement SUPER PDP — 4 septembre 2026

SUPER PDP a été retenue pour le premier connecteur. Elle figure dans la liste officielle des plateformes agréées publiée par la DGFiP, documente publiquement son API, propose OAuth 2 pour les logiciels multi-entreprises, un bac à sable et une tarification éditeur affichée. Le raccordement est conçu en marque grise : chaque organisation autorise REZO360 sur le site du partenaire et ne saisit jamais ses identifiants de plateforme dans l’application.

Les migrations `20260904195516_superpdp_provider_connection.sql` et `20260904202755_superpdp_advisor_hardening.sql` sont installées. Elles conservent uniquement les métadonnées de connexion lisibles par l’organisation. Les jetons d’accès et de renouvellement sont chiffrés en AES-GCM avec une clé serveur propre au projet, associés à l’organisation, et interdits de lecture au navigateur. Les états OAuth sont hachés, utilisables une seule fois et expirent en moins de quinze minutes. Les fonctions de permission restent en `SECURITY INVOKER` et les clés étrangères du nouveau périmètre sont indexées.

Trois fonctions sont actives sur le projet Supabase lié : préparation et vérification de la connexion, retour OAuth à usage unique, et dépôt ou synchronisation d’une facture. Le dépôt est limité à une facture B2B émise, envoyée ou payée, à un responsable disposant du module et du droit de gestion, et à une connexion vérifiée dans l’environnement attendu. Avant une nouvelle tentative, le service recherche l’identifiant externe stable de la facture chez le partenaire afin de récupérer un dépôt dont la réponse aurait été perdue. Les événements du partenaire et de l’administration sont dédupliqués, normalisés et ajoutés au journal immuable.

L’interface présente SUPER PDP sur la page de préparation, son environnement, la vérification de l’entreprise et les actions de connexion ou déconnexion. Sur une facture prise en charge, le premier dépôt exige une confirmation explicite ; les reprises techniques et la synchronisation de statut sont ensuite disponibles dans le bloc de transmission. Les particuliers et organismes publics restent orientés vers leurs parcours dédiés au lieu d’activer un envoi inadapté.

Le mode `sandbox`, la clé de chiffrement, le `client ID` et le `client secret` sont configurés. Le parcours OAuth positif est terminé pour l’entreprise de démonstration : REZO360 affiche la connexion comme active, l’environnement comme « Bac à sable » et la vérification de l’entreprise comme validée. Le contrôle à la demande interroge correctement SUPER PDP et renouvelle le jeton côté serveur si nécessaire. L’URL déclarée chez le partenaire est `https://wtsiaisfwtthmcxygeei.supabase.co/functions/v1/superpdp-oauth-callback`. Les contrôles HTTP confirment aussi que les fonctions de connexion et de dépôt refusent les requêtes anonymes avec `401`, et que le retour sans état OAuth est refusé avec `400`.

Validation : migration testée avant et après installation dans des transactions annulées, audit Supabase sans nouvelle alerte liée au connecteur, lint ciblé réussi, compilation de production réussie et suite complète de **112 fichiers / 834 tests** validée avant le parcours OAuth. Une connexion bac à sable est maintenant active et son contrôle positif a été rejoué depuis l’interface. Le lint global signale encore des erreurs historiques dans des fichiers hors de ce raccordement.

### Premier parcours de dépôt en bac à sable

Deux factures strictement synthétiques ont servi au parcours. `FAC-2026-00003` a confirmé que l’instantané vendeur d’une facture réelle ne doit pas être substitué par l’entreprise fictive du bac à sable. `FAC-2026-00004`, d’un euro sans TVA, a ensuite été émise avec Burger Queen (`000000002`) vers Tricatel (`000000001`), les deux entreprises fictives fournies par SUPER PDP. Aucun document réel n’a été envoyé.

Le dépôt utilise UBL pour l’interopérabilité du destinataire. L’export téléchargeable reste au cœur EN 16931 ; le transport ajoute le profil `M1` observé dans le document de référence du partenaire. Les adresses de routage `0225` sont résolues dans l’annuaire en production et reprises du document synthétique officiel dans le bac à sable. Le connecteur vérifie désormais que le SIREN de l’instantané vendeur correspond à l’entreprise du jeton OAuth avant tout dépôt.

SUPER PDP a attribué l’identifiant `448618` à `FAC-2026-00004`, puis a émis `api:uploaded` et le statut terminal `fr:213` (« Rejetée »). L’identifiant externe de la facture et l’identifiant du partenaire rendent les relances idempotentes : une synchronisation ne redépose pas le document. La migration `20260904234000_rejected_transmission_message.sql` corrige la conservation de la raison d’un rejet dans l’état courant et a réparé cette transmission à partir de son journal immuable. La synchronisation relit aussi le détail de la facture chez le partenaire afin d’exposer les raisons, notes et données signalées sans stocker la réponse brute.

Le rejet `BR-FR-05` demandait les trois notes françaises obligatoires de BG-3 : frais de recouvrement `PMT`, pénalités de retard `PMD` et escompte `AAB`. Le modèle canonique porte désormais des notes structurées et les sérialise séparément en UBL et en CII. La nature de l’opération `REG`, l’option TVA sur les débits `TXD` et les informations libres `AAI` utilisent le même mécanisme sans dupliquer les mentions.

Après correction et redéploiement, la facture synthétique `FAC-2026-00005`, un euro sans TVA de Burger Queen (`000000002`) vers Tricatel (`000000001`), a réussi le parcours en une tentative. SUPER PDP l’a téléversée, validée, émise par la plateforme et reçue par la plateforme destinataire ; REZO360 affiche « Remise au destinataire ». L’identité courante de l’organisation a ensuite été restaurée à HBG Labs (`10919844000017`). La vérification du raccordement place volontairement la connexion fictive en « Action requise » afin qu’aucune facture HBG Labs ne puisse partir avec le jeton Burger Queen.

Les tentatives de validation précédentes restent visibles comme événements techniques, ce qui documente les écarts CII, profil et routage résolus avant le dépôt accepté. Le client réutilise un jeton valide et ne le renouvelle qu’à moins de deux minutes de son expiration, ce qui évite la course entre plusieurs onglets. Les fonctions de dépôt et de vérification d’entreprise sont déployées avec les contrôles d’identité, les tests ciblés passent et la compilation de production réussit.

Références du partenaire : [DGFiP — liste des plateformes agréées](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/listes_plateformes_agreees/liste_pa_attente_rapport_audit.pdf), [documentation OAuth et API SUPER PDP](https://www.superpdp.tech/documentation/4/), [contrat OpenAPI](https://api.superpdp.tech/openapi/superpdp.json), [tarifs éditeurs](https://www.superpdp.tech/tarifs/).

Références de syntaxe : [Peppol — arborescence UBL CreditNote](https://docs.peppol.eu/poacc/billing/3.0/syntax/ubl-creditnote/), [Peppol — référence de facture précédente](https://docs.peppol.eu/poacc/billing/3.0/syntax/ubl-creditnote/cac-BillingReference/cac-InvoiceDocumentReference/), [Peppol — codes de paiement UNCL 4461](https://docs.peppol.eu/poacc/billing/3.0/codelist/UNCL4461/), [Peppol — codification du sujet des notes UBL](https://docs.peppol.eu/poacc/billing/3.0/2024-Q4/rules/ubl-tc434/BR-CL-08/).

Références : [DGFiP — plateformes agréées](https://www.impots.gouv.fr/facturation-electronique-et-plateformes-agreees), [Service Public — mentions des factures](https://www.service-public.gouv.fr/entreprendre/vosdroits/F31808?profil=societe), [DGFiP — spécifications externes B2B et documents AFNOR applicables](https://www.impots.gouv.fr/specifications-externes-b2b).

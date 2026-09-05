# Validation du PDF Factur-X — 4 septembre 2026

Le générateur `rezo360-fx-4` utilise PDFKit **0.17.2**, Noto Sans embarqué sous OFL 1.1 et le contrat canonique commun au CII/UBL. Cette version ajoute les adresses électroniques françaises du vendeur et de l’acheteur avec le schéma `0225`, exigées pour le routage en facturation électronique. La génération reste côté serveur. Les paquets JavaScript du serveur sont épinglés dans `supabase/functions/generate-facturx/deno.lock` ; les polices et leur licence sont conservées dans `assets/`.

## Contrôles indépendants

- **XML** : XSD et Schematron Factur-X 1.09.2 EN16931, redistribués dans la bibliothèque `factur-x==6.8` ; Schematron européen EN 16931 `validation-1.3.16`. Contrôles négatifs : ordre XML erroné et total faussé.
- **PDF** : veraPDF **1.30.2**, profil PDF/A-3b. Aucune facture n’est envoyée à un validateur externe.
- **Document hybride** : un seul attachement `factur-x.xml`, identique octet pour octet au CII contrôlé ; relation `Alternative`, extension XMP Factur-X, version XMP `1.0`, niveau `EN 16931`.
- **Présentation** : page courte sur un feuillet, pieds de page numérotés, absence de texte hors marges et de pages vides. Contrôle visuel de l’exemple et contrôle automatique des coordonnées de chaque caractère.
- **Serveur** : Deno génère les cinq cas et reproduit exactement une génération répétée dans le même environnement. Un caractère absent de la police provoque un refus explicite. Node et Deno peuvent avoir des octets de compression différents ; les fichiers des deux environnements sont contrôlés séparément.
- **Accès** : suite SQL annulée par transaction, exécutée avant et après application de la migration. Lecture selon les droits de la facture ; ni écriture cliente, ni remplacement, ni lecture depuis une autre organisation ou un rôle sans accès aux factures. Les policies restrictives du bucket empêchent qu’une autre policy générale l’ouvre accidentellement.

Les cinq cas sont : TVA standard, franchise sans numéro de TVA vendeur, taux zéro, autoliquidation, et facture longue de 60 lignes avec plusieurs taux et notes sur plusieurs pages. Les données sont fictives.

## Reproduire

Depuis la racine, avec Python et les outils de contrôle installés (`lxml`, `pypdf`, `pdfplumber`, `saxonche==12.10.0`, `factur-x==6.8`) :

```powershell
node scripts/generate-facturx-fixtures.mjs
node scripts/generate-facturx-fixtures.mjs --credit-notes
node scripts/generate-facturx-fixtures.mjs --partial-credit-notes
python scripts/validate-cii.py --fetch
npx deno test --allow-read --allow-write=test-results/facturx-deno-fixtures --config supabase/functions/generate-facturx/deno.json supabase/functions/generate-facturx/render.test.ts
python scripts/validate-facturx-pdf.py --java CHEMIN_JAVA --verapdf-jar CHEMIN_VERAPDF_CLI_JAR
python scripts/validate-facturx-pdf.py --folder test-results/facturx-deno-fixtures --java CHEMIN_JAVA --verapdf-jar CHEMIN_VERAPDF_CLI_JAR
python scripts/validate-ubl.py --folder test-results/credit-note-ubl-fixtures
python scripts/validate-cii.py --folder test-results/credit-note-cii-fixtures
python scripts/validate-facturx-pdf.py --folder test-results/credit-note-deno-fixtures --java CHEMIN_JAVA --verapdf-jar CHEMIN_VERAPDF_CLI_JAR
python scripts/validate-ubl.py --folder test-results/partial-credit-note-ubl-fixtures
python scripts/validate-cii.py --folder test-results/partial-credit-note-cii-fixtures
python scripts/validate-facturx-pdf.py --folder test-results/partial-credit-note-deno-fixtures --java CHEMIN_JAVA --verapdf-jar CHEMIN_VERAPDF_CLI_JAR
npm run test -- src/features/einvoicing
npx supabase db query --linked --file supabase/tests/06_invoicing_scenario.sql
```

Les outils Python peuvent être installés sous `test-results/einvoice-tools`. Les rapports de contrôle et les exemples restent dans `test-results/`, ignoré par Git. `validate-cii.py --fetch` ne télécharge que les règles publiques ; les exécutions suivantes peuvent omettre `--fetch`.

## Parcours intégré sur données fictives — 4 septembre 2026

Un essai relie désormais l’instantané issu de la base au traitement complet du service de documents :

1. `scripts/prepare-facturx-journey.mjs` réutilise le scénario SQL transactionnel. Il crée un brouillon fictif, appelle `save_invoice_draft`, puis `issue_invoice`, et exporte l’instantané émis avant le `ROLLBACK` final. Les deux lignes et deux taux donnent 392,85 € TTC, calculés par les vues de la base.
2. `journey.test.ts` exécute le même gestionnaire HTTP, le vrai SDK Supabase et le vrai générateur PDF. Un transport de test remplace Auth, REST et Storage ; le processus Deno n’a aucune permission réseau. Les tests de droits sur la véritable base restent ceux de la suite SQL.
3. Six cas passent : premier téléchargement avec vérification SHA-256 puis réutilisation du document ; requêtes concurrentes ; reprise après interruption des métadonnées ; refus de remplacement d’un fichier orphelin différent ; vérification des droits avant accès à un PDF déjà conservé ; refus d’un brouillon ou d’identifiants invalides.
4. Le fichier effectivement téléchargé par le test passe veraPDF PDF/A-3b, XSD Factur-X, Schematron Factur-X et EN 16931. L’attachement XML est identique, les contrôles négatifs sont rejetés, et la page a été inspectée visuellement.

```powershell
node scripts/prepare-facturx-journey.mjs
npx deno test --allow-read --allow-write=test-results/facturx-journey,test-results/facturx-test-mode --config supabase/functions/generate-facturx/deno.json supabase/functions/generate-facturx/journey.test.ts
python scripts/validate-cii.py --file test-results/facturx-journey/downloaded.xml
python scripts/validate-facturx-pdf.py --folder test-results/facturx-journey --expected-count 1 --java CHEMIN_JAVA --verapdf-jar CHEMIN_VERAPDF_CLI_JAR
```

Les rapports sont dans `test-results/facturx-journey/` et l’exemplaire présenté à l’utilisateur dans `output/pdf/facturx-demonstration.pdf`. Ce parcours valide l’intégration des traitements avec un stockage simulé ; il ne remplace pas un premier essai autorisé sur une facture éligible et le stockage du projet déployé. Les données de ce scénario SQL sont annulées par transaction.

## Simulation depuis un brouillon — 4 septembre 2026

Le bouton « Simuler l’émission » appelle le même service avec `mode: "test"` et la version du brouillon. Le service utilise uniquement le client soumis aux droits de l’utilisateur : il relit le brouillon, les lignes, les totaux et l’entreprise, puis revérifie le statut et la version. Cette branche retourne avant toute création de client privilégié ou tout accès au stockage et aux métadonnées des documents.

Une copie en mémoire reçoit une référence `TEST-<uuid>`, une date de simulation et une mention explicite. Le PDF porte « FACTURE - TEST » et « NE PAS COMPTABILISER » sur chaque page ; le XML contient également la référence et la note de test. La réponse est directement un PDF avec `Cache-Control: no-store`. Aucun appel à l’émission, aucun compteur et aucune donnée persistée ne sont modifiés.

Vérification : 79 tests du module frontend, compilation de production et lint des fichiers frontend modifiés réussis ; 10 tests Deno du service, dont les simulations courte et longue et les refus de versions périmées, de modification concurrente, de statut inadapté, d’accès absent ou de données invalides. Le transport des simulations refuse tout appel autre que GET et toute utilisation de Storage ou des métadonnées. Les PDF TEST d’une et de cinq pages passent veraPDF PDF/A-3b, XSD/Schematron Factur-X et EN 16931, attachement exact, marges et présence des mentions TEST sur chaque page. L’exemple court a été inspecté visuellement.

```powershell
python scripts/validate-cii.py --file test-results/facturx-test-mode/standard.xml
python scripts/validate-cii.py --file test-results/facturx-test-mode/long.xml
python scripts/validate-facturx-pdf.py --folder test-results/facturx-test-mode --expected-count 2 --test-mode --java CHEMIN_JAVA --verapdf-jar CHEMIN_VERAPDF_CLI_JAR
```

Le service a été déployé et la simulation déclenchée depuis l’aperçu local sur le brouillon fictif créé à la demande de l’utilisateur. Le navigateur a reçu le PDF et affiché la confirmation. Lecture de la base avant et après : statut brouillon, référence provisoire et version inchangés, aucune date d’émission, zéro document définitif, compteur toujours à 2. Ce contrôle valide le téléchargement direct du mode test déployé ; le stockage définitif reste couvert par les essais isolés décrits plus haut.

## Limites et exploitation

Ces contrôles portent sur le profil EN 16931 et les cas pris en charge, pas sur une certification réglementaire française exhaustive ou l’acceptation d’un partenaire. Les contrôles complets externes sont des vérifications du générateur ; une requête normale ne lance pas veraPDF ni Saxon. Le serveur revalide l’instantané, les montants et les contraintes du format.

Un document enregistré est réutilisé quelle que soit la version ultérieure du générateur. Si un téléversement a réussi avant une interruption de l’enregistrement des métadonnées, une reprise n’accepte le fichier présent que si son empreinte correspond. Sinon elle échoue sans remplacement. Ce stockage privé n’est pas un SAE certifié ; sauvegardes, rétention réglementaire et intégration à une plateforme agréée restent des chantiers distincts.

La fonction déployée a été contrôlée pour CORS et les refus d’accès. Le téléchargement positif d’une facture réelle reste à essayer avec une facture éligible : la facture ouverte pendant cette étape contient un SIRET et un numéro de TVA client de format invalide. Son instantané payé n’a pas été modifié.

Sources : [PDFKit — PDF/A](https://pdfkit.org/docs/getting_started.html), [PDFKit — pièces jointes](https://pdfkit.org/docs/attachments.html), [FNFE-MPE — Factur-X](https://fnfe-mpe.org/factur-x/), [Akretion — outils Factur-X](https://github.com/akretion/factur-x), [veraPDF — validation](https://docs.verapdf.org/cli/validation/).

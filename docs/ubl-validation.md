# Validation du premier export UBL

Le code produit un fichier UBL 2.1 au cœur EN 16931 :

- `CustomizationID` source : `urn:cen.eu:en16931:2017`
- aucun `ProfileID` n’est inventé dans l’export téléchargeable

Pour l’envoi, la fonction serveur ajoute `ProfileID = M1`, valeur observée dans la facture UBL de référence générée par SUPER PDP pour le parcours Burger Queen vers Tricatel. SUPER PDP applique ensuite la CIUS française au document destiné au réseau. Les identifiants OAuth ne sont jamais intégrés au fichier.

## Cas validés le 4 septembre 2026 (UTC)

| Fichier synthétique | Cas |
| --- | --- |
| `S.xml` | TVA standard, caractères XML à échapper |
| `E.xml` | Franchise en base, vendeur sans numéro de TVA |
| `Z.xml` | Taux zéro |
| `AE.xml` | Autoliquidation avec identifiants TVA et motif |
| `mixed-delivery.xml` | Taux 20 % et 8,5 %, quantité décimale et livraison distincte |

Les cinq fichiers passent le XSD officiel UBL 2.1 et les assertions officielles EN 16931, version `validation-1.3.16`. Le contrôle négatif modifie le montant payable d’un fichier : la règle `BR-CO-16` détecte l’écart.

## Notes françaises structurées

Le profil français exige que certaines mentions soient portées dans des notes BG-3 avec un code BT-21. Le contrat canonique produit une note distincte pour les frais de recouvrement (`PMT`), les pénalités de retard (`PMD`) et l’escompte ou son absence (`AAB`). Il code aussi la nature de l’opération (`REG`), l’option TVA sur les débits lorsqu’elle s’applique (`TXD`) et les informations générales (`AAI`).

En UBL, chaque note suit la forme `#CODE#contenu` attendue pour `cbc:Note`. En CII, le contenu et le code sont séparés dans `ram:Content` et `ram:SubjectCode`. Les tests vérifient la présence unique des codes obligatoires et la validation indépendante confirme que les documents restent conformes aux XSD, à Factur-X et au cœur EN 16931.

Le test partenaire du 4 septembre 2026 confirme la CIUS française : `FAC-2026-00005` a été téléversée, validée et remise au destinataire fictif par SUPER PDP en une tentative. La facture précédente, qui portait les mêmes textes sans leurs codes, avait été rejetée par `BR-FR-05`.

Le vendeur en franchise sans numéro de TVA reprend son SIREN en BT-32, avec un `TaxScheme/ID` différent de `VAT`, conformément aux [spécifications externes B2B et documents AFNOR publiés par la DGFiP](https://www.impots.gouv.fr/specifications-externes-b2b). La forme `#CODE#` des notes UBL suit la [règle Peppol BR-CL-08](https://docs.peppol.eu/poacc/billing/3.0/2024-Q4/rules/ubl-tc434/BR-CL-08/).

## Reproduire les contrôles

Depuis la racine du projet, avec Python, `lxml` et `saxonche==12.10.0` installés :

```powershell
$env:EXPORT_UBL_FIXTURES = '1'
npx.cmd --no-install vitest run src/features/einvoicing/canonical/mapper.test.ts
Remove-Item Env:EXPORT_UBL_FIXTURES
python scripts/validate-ubl.py --fetch
```

Le script télécharge uniquement les schémas publics OASIS et les règles publiques EN 16931. Il conserve les fichiers de validation, leur licence et son rapport sous `test-results/einvoice-validation`. Les factures synthétiques restent locales. Les exécutions suivantes peuvent omettre `--fetch`.

La dépendance Saxon est un outil de validation local ; elle n’est pas incluse dans l’application. Si nécessaire, les outils Python peuvent être installés dans le dossier ignoré `test-results/einvoice-tools`, que le script ajoute à son chemin de recherche.

Le XSLT EN 16931 est épinglé à la version `validation-1.3.16` et au SHA-256 suivant :

```text
39f9d282867f1a49e7708d9e29a53da89643e1ee56f10cec1ebcf1277595fcbd
```

Sources de validation : [OASIS UBL 2.1 — schéma Invoice](https://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/maindoc/UBL-Invoice-2.1.xsd), [Commission européenne — règles EN 16931 version 1.3.16](https://github.com/ConnectingEurope/eInvoicing-EN16931/releases/tag/validation-1.3.16).

## CII, contenu structuré de Factur-X

Le générateur `serializeCii` produit le CII au profil EN 16931 intégré au PDF Factur-X. Les outils locaux `factur-x==6.8`, `saxonche==12.10.0` et `lxml` sont requis. Son contrôle indépendant se reproduit ainsi :

```powershell
node scripts/generate-facturx-fixtures.mjs
python scripts/validate-cii.py --fetch
```

Le XSLT CII officiel EN 16931 `validation-1.3.16` est épinglé à l’empreinte SHA-256 suivante :

```text
0b234dea2bbfee739b7761e607a992c17fab88773014ef56355b6158cfb1cc53
```

La validation comprend le XSD et le Schematron Factur-X 1.09.2 redistribués dans `factur-x==6.8`, ainsi que les règles métier EN 16931. Un total payable volontairement erroné est rejeté par `BR-CO-16` ; un élément déplacé est rejeté par le XSD. Les contrôles du PDF/A-3b, des métadonnées et de l’attachement exact sont décrits dans [la validation Factur-X](facturx-validation.md).

## Portée

Ces contrôles indépendants complètent les tests applicatifs : calcul exact des arrondis, total rapproché avec la base, unités connues, catégories de TVA prises en charge, champs requis, rejet des caractères XML invalides et absence de document définitif pour un brouillon.

Le premier périmètre reste limité aux factures nationales FR en EUR. Les instructions de paiement sont structurées lorsque leur mode est reconnu ; les mentions métier restent aussi présentes dans le texte. Pour les entreprises, la fonction serveur résout les adresses électroniques `0225`, vérifie l’identité de l’émetteur et ajoute le profil de transport attendu par SUPER PDP. Les organismes publics restent réservés à leur parcours dédié. La validation locale est complétée par des essais synthétiques de bout en bout avec le partenaire.

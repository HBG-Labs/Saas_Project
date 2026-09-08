<#
.SYNOPSIS
    Sauvegarde la base Supabase de REZO360 dans des fichiers SQL datés.

.DESCRIPTION
    ─────────────────────────────────────────────────────────────────────────────
    POURQUOI CE SCRIPT EXISTE ENCORE

    Il a été écrit quand le projet était en Free, plan qui ne fournit AUCUNE
    sauvegarde automatique : il en était alors la seule protection. Depuis le
    07/09/2026 le projet est en Pro, et Supabase sauvegarde quotidiennement.
    Ce script n'est donc plus un filet de survie — il reste utile pour trois
    choses que la sauvegarde automatique ne couvre pas :

      - une copie SOUS VOTRE CONTRÔLE, sur votre disque, indépendante du
        fournisseur et de l'état de votre abonnement ;
      - un instantané AVANT une opération risquée — une migration lourde, une
        correction de données en masse — sans attendre le cycle quotidien ;
      - un fichier lisible et rejouable table par table, là où la restauration
        Supabase ramène tout ou rien.

    À l'inverse, il ne remplace pas la sauvegarde automatique : personne ne
    pense à le lancer tous les jours.

    CE QU'IL SAUVEGARDE, ET CE QU'IL NE SAUVEGARDE PAS

    Le SCHÉMA est déjà sauvegardé — il vit dans `supabase/migrations/`, versionné
    dans Git, et se rejoue avec `supabase db push`. C'est la source de vérité.
    Le fichier de schéma produit ici n'est qu'un filet de sécurité, utile pour
    constater un écart, pas pour restaurer.

    Ce qui n'existe QUE dans la base, c'est LA DONNÉE : les comptes de
    `auth.users`, les organisations, les missions, les comptes rendus signés.
    C'est elle que ce script protège, et elle est irremplaçable.

    POURQUOI PAS `supabase db dump`

    La commande du CLI exécute pg_dump dans un conteneur : elle exige Docker
    Desktop. Ce script appelle pg_dump directement, ce qui évite d'installer un
    moteur de conteneurs pour copier quelques mégaoctets.

    POURQUOI LE PORT 5432 ET NON 6543

    Le pooler expose deux modes. Le 6543 est en mode TRANSACTION : il ne tient
    pas d'état entre deux requêtes, et pg_dump — qui ouvre une transaction longue
    et pose des paramètres de session — y échoue. Le 5432 est le mode SESSION,
    le seul utilisable ici.
    ─────────────────────────────────────────────────────────────────────────────

.PARAMETER OutDir
    Dossier de destination. Par défaut `%USERPROFILE%\REZO360-backups`, donc
    HORS du dépôt : une sauvegarde commitée par mégarde publierait les données
    personnelles de tous les comptes.

.PARAMETER Keep
    Nombre de sauvegardes à conserver. Les plus anciennes sont supprimées.

.EXAMPLE
    $env:SUPABASE_DB_PASSWORD = '<mot de passe base>'
    .\scripts\backup-supabase.ps1

.NOTES
    Le mot de passe de la base se trouve dans le tableau de bord Supabase :
    Project Settings → Database → Database password. Ce n'est NI le jeton
    d'accès, NI la clé publiable. En cas d'oubli, il se réinitialise au même
    endroit.
#>

[CmdletBinding()]
param(
    [string]$OutDir = (Join-Path $env:USERPROFILE 'REZO360-backups'),
    [int]$Keep = 14
)

$ErrorActionPreference = 'Stop'

# Coordonnées du projet « Saas Tech », relevées via l'API de gestion.
$ProjectRef = 'wtsiaisfwtthmcxygeei'
$PoolerHost = 'aws-0-ca-central-1.pooler.supabase.com'
$PoolerPort = 5432
$DbUser     = "postgres.$ProjectRef"
$DbName     = 'postgres'

# -----------------------------------------------------------------------------
# Prérequis
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Localiser pg_dump
# -----------------------------------------------------------------------------
#
# ─────────────────────────────────────────────────────────────────────────────
# LE PATH NE SUFFIT PAS, ET LE DIRE NE SUFFIT PAS NON PLUS
#
# La version précédente s'arrêtait sur « pg_dump est introuvable » dès que
# `Get-Command` échouait, et conseillait d'installer PostgreSQL — alors qu'il
# était déjà installé. Deux raisons, toutes deux hors de portée de
# l'utilisateur :
#
#   1. l'installateur PostgreSQL de Windows n'ajoute JAMAIS son dossier `bin`
#      au PATH ;
#   2. un terminal intégré d'IDE hérite de l'environnement figé au lancement de
#      l'IDE : ajouter le dossier au PATH utilisateur ne l'y fait pas
#      apparaître, et rouvrir un onglet n'y change rien.
#
# Un script qui envoie réinstaller ce qui est déjà installé fait perdre plus de
# temps qu'il n'en fait gagner. On cherche donc là où l'installateur dépose
# réellement les binaires avant de déclarer forfait.
# ─────────────────────────────────────────────────────────────────────────────

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue

if (-not $pgDump) {
    # Version la plus élevée d'abord : `pg_dump` refuse un serveur plus récent
    # que lui, jamais l'inverse.
    $candidat = Get-ChildItem -Path 'C:\Program Files\PostgreSQL', 'C:\Program Files (x86)\PostgreSQL' `
                    -Filter 'pg_dump.exe' -Recurse -ErrorAction SilentlyContinue |
                Sort-Object { [int]($_.FullName -replace '.*PostgreSQL\\(\d+)\\.*', '$1') } -Descending |
                Select-Object -First 1

    if ($candidat) {
        $pgDump = Get-Command $candidat.FullName
        Write-Host "pg_dump trouve hors PATH : $($candidat.FullName)" -ForegroundColor DarkGray
        Write-Host "  (pour l'avoir partout, fermez puis rouvrez votre IDE)" -ForegroundColor DarkGray
    }
}

if (-not $pgDump) {
    Write-Host "pg_dump est introuvable, et PostgreSQL n'est pas installe." -ForegroundColor Red
    Write-Host ""
    Write-Host "Installez les outils clients PostgreSQL (une seule fois) :"
    Write-Host "    winget install -e --id PostgreSQL.PostgreSQL.17" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Ce script le retrouvera ensuite tout seul, sans manipulation du PATH."
    exit 1
}

if (-not $env:SUPABASE_DB_PASSWORD) {
    Write-Host "SUPABASE_DB_PASSWORD n'est pas defini." -ForegroundColor Red
    Write-Host ""
    Write-Host "Pour cette session :"
    Write-Host "    `$env:SUPABASE_DB_PASSWORD = '<mot de passe base>'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Pour le rendre permanent (necessaire a une tache planifiee) :"
    Write-Host "    [Environment]::SetEnvironmentVariable('SUPABASE_DB_PASSWORD','<mdp>','User')" -ForegroundColor Cyan
    exit 1
}

# Le mot de passe est encodé : un `@`, un `/` ou un `#` non échappé couperait
# l'URI en deux et produirait une erreur d'authentification incompréhensible.
$encodedPassword = [uri]::EscapeDataString($env:SUPABASE_DB_PASSWORD)
$connection = "postgresql://${DbUser}:${encodedPassword}@${PoolerHost}:${PoolerPort}/${DbName}"

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$stamp     = Get-Date -Format 'yyyy-MM-dd_HHmm'
$dataFile  = Join-Path $OutDir "rezo360_data_$stamp.sql"
$schemaFile = Join-Path $OutDir "rezo360_schema_$stamp.sql"

# -----------------------------------------------------------------------------
# Les deux dumps
# -----------------------------------------------------------------------------

Write-Host "Sauvegarde du projet $ProjectRef vers $OutDir" -ForegroundColor Green

try {
    # DONNÉES — le fichier qui compte.
    #
    # `auth` est inclus délibérément : sans `auth.users`, une restauration rend
    # une base pleine d'organisations et de missions que plus personne ne peut
    # ouvrir. `--column-inserts` produit un fichier plus verbeux qu'un COPY,
    # mais qui reste rejouable table par table quand une seule a été perdue.
    Write-Host "  [1/2] Donnees (public + auth)..." -NoNewline
    & $pgDump.Source $connection `
        --data-only `
        --schema=public `
        --schema=auth `
        --column-inserts `
        --no-owner `
        --no-privileges `
        --file=$dataFile
    if ($LASTEXITCODE -ne 0) { throw "pg_dump a echoue sur les donnees (code $LASTEXITCODE)." }
    Write-Host " OK" -ForegroundColor Green

    # SCHÉMA — filet de sécurité, la référence restant `supabase/migrations/`.
    Write-Host "  [2/2] Schema (public)..." -NoNewline
    & $pgDump.Source $connection `
        --schema-only `
        --schema=public `
        --no-owner `
        --no-privileges `
        --file=$schemaFile
    if ($LASTEXITCODE -ne 0) { throw "pg_dump a echoue sur le schema (code $LASTEXITCODE)." }
    Write-Host " OK" -ForegroundColor Green
}
catch {
    # Un dump interrompu laisse un fichier tronqué. Le garder serait pire que
    # de n'avoir rien : on croirait disposer d'une sauvegarde.
    foreach ($f in @($dataFile, $schemaFile)) {
        if (Test-Path $f) { Remove-Item $f -Force }
    }
    Write-Host ""
    Write-Host "ECHEC : $_" -ForegroundColor Red
    exit 1
}

# -----------------------------------------------------------------------------
# Contrôle et rotation
# -----------------------------------------------------------------------------

$dataSize = (Get-Item $dataFile).Length
if ($dataSize -lt 1024) {
    Write-Host "ATTENTION : le fichier de donnees fait $dataSize octets - anormalement petit." -ForegroundColor Yellow
    exit 1
}

"{0:N0} Ko de donnees, {1:N0} Ko de schema." -f ($dataSize / 1KB), ((Get-Item $schemaFile).Length / 1KB) | Write-Host

# Rotation : on compte les sauvegardes par leur fichier de données, et on retire
# le couple complet pour ne pas laisser un schéma orphelin.
$anciennes = Get-ChildItem $OutDir -Filter 'rezo360_data_*.sql' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $Keep

foreach ($vieille in $anciennes) {
    $suffixe = $vieille.Name -replace '^rezo360_data_', '' -replace '\.sql$', ''
    Remove-Item $vieille.FullName -Force
    $schemaAssocie = Join-Path $OutDir "rezo360_schema_$suffixe.sql"
    if (Test-Path $schemaAssocie) { Remove-Item $schemaAssocie -Force }
    Write-Host "  purge : sauvegarde du $suffixe"
}

Write-Host "Termine." -ForegroundColor Green

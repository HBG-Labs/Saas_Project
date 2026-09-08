<#
.SYNOPSIS
    Sauvegarde la base Supabase de REZO360 dans des fichiers SQL datés.

.DESCRIPTION
    ─────────────────────────────────────────────────────────────────────────────
    POURQUOI CE SCRIPT EXISTE

    Le plan Supabase Free ne fournit AUCUNE sauvegarde automatique, et un projet
    Free est mis en pause après une période d'inactivité. Tant que
    l'organisation n'est pas passée en Pro, ce script est la seule protection
    contre une perte de données définitive.

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

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Host "pg_dump est introuvable." -ForegroundColor Red
    Write-Host ""
    Write-Host "Installez les outils clients PostgreSQL (une seule fois) :"
    Write-Host "    winget install -e --id PostgreSQL.PostgreSQL.17" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Puis rouvrez le terminal pour que le PATH soit rechargé."
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

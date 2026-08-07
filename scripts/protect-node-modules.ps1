<#
.SYNOPSIS
    Protege node_modules contre la deshydratation OneDrive (Files On-Demand).

.DESCRIPTION
    Ce projet est heberge dans OneDrive avec Files On-Demand ACTIF. Le risque reel
    n'est pas le volume synchronise (genant mais benin) : c'est la DESHYDRATATION.
    OneDrive peut transformer un fichier de node_modules en placeholder cloud, et
    Node echoue alors avec EIO / ENOENT au milieu d'un build ou d'un test.

    Ce script epingle node_modules en "toujours disponible localement" (attribut +P),
    ce qui interdit a OneDrive de le deshydrater.

    APPROCHE ECARTEE — jonction NTFS :
    Deplacer node_modules hors de OneDrive via une jonction a ete teste et ECHOUE :
    npm 11 supprime le lien au debut de chaque install
    ("npm warn reify Removing non-directory ... node_modules") et recree un vrai
    dossier. La mitigation ne survivait donc pas a `npm install`.

    Le script est idempotent : relancable sans effet de bord.
    A relancer apres chaque `npm install` qui recree node_modules.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeModules = Join-Path $projectRoot 'node_modules'

if (-not (Test-Path -LiteralPath $nodeModules)) {
    Write-Host "SKIP  node_modules absent. Lancez d'abord 'npm install'." -ForegroundColor Yellow
    exit 0
}

Write-Host "Epinglage de node_modules en local (peut prendre ~30 s)..." -ForegroundColor Cyan

# +P : pinned (toujours disponible localement) / -U : retire "free up space"
& attrib.exe +P -U $nodeModules /S /D 2>$null | Out-Null

Write-Host "OK  node_modules est epingle : OneDrive ne peut plus le deshydrater." -ForegroundColor Green
Write-Host "    A relancer apres chaque 'npm install'." -ForegroundColor DarkGray

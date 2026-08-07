# ==============================================================================
# Script d'automatisation Git Push pour NexoraTech -> GitHub (ApplicationTechFinal)
# ==============================================================================

$RepoUrl = "https://github.com/HBZ/ApplicationTechFinal.git"

Write-Host "`n🚀 Publication de NexoraTech sur GitHub ($RepoUrl)..." -ForegroundColor Cyan

# 1. Configuration du remote origin
$remotes = git remote
if ($remotes -notcontains "origin") {
    Write-Host "`n[1/4] ➕ Configuration du dépôt distant origin..." -ForegroundColor Yellow
    git remote add origin $RepoUrl
} else {
    # Mettre à jour l'URL au cas où elle a changé
    git remote set-url origin $RepoUrl
    Write-Host "`n[1/4] ✔ Remote origin configuré : $RepoUrl" -ForegroundColor Green
}

# 2. Indexation des fichiers
Write-Host "[2/4] 📦 Indexation des modifications (git add .)..." -ForegroundColor Yellow
git add .

# 3. Validation du commit
$status = git status --porcelain
if ($status) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    Write-Host "[3/4] 📝 Enregistrement du commit..." -ForegroundColor Yellow
    git commit -m "feat(nexoratech): mise à jour complète du projet - $timestamp"
} else {
    Write-Host "[3/4] ℹ Tous les fichiers sont déjà commités." -ForegroundColor Green
}

# 4. Publication sur GitHub
Write-Host "[4/4] ⬆ Envoi vers GitHub (git push -u origin main)...`n" -ForegroundColor Cyan
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ PROJET PUBLIÉ AVEC SUCCÈS SUR GITHUB !" -ForegroundColor Green
    Write-Host "🔗 Lien du dépôt : https://github.com/HBZ/ApplicationTechFinal" -ForegroundColor Cyan
} else {
    Write-Host "`n⚠️ Le push a rencontré un problème." -ForegroundColor Red
    Write-Host "💡 Si le dépôt distant contient déjà des fichiers, exécutez :" -ForegroundColor Yellow
    Write-Host "   git pull origin main --rebase" -ForegroundColor Yellow
    Write-Host "   git push -u origin main" -ForegroundColor Yellow
}

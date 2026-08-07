import { expect, test } from '@playwright/test';

/**
 * Test de fumée — Vérification de la disponibilité des routes principales, marketing et des 4 outils d'ingénierie.
 */
test.describe('Parcours de base & navigation marketing', () => {
  test("L'accueil s'affiche et contient le branding NexoraTech", async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /nexoratech/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /commencer/i }).first()).toBeVisible();
  });

  test('La page Fonctionnalités (/features) est accessible et affiche le titre', async ({ page }) => {
    await page.goto('/features');
    await expect(page.getByRole('heading', { name: /fonctionnalités/i })).toBeVisible();
  });

  test('La page Tarifs (/pricing) est accessible et affiche les 3 offres', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: /tarifs/i })).toBeVisible();
    await expect(page.getByText('Gratuit').first()).toBeVisible();
    await expect(page.getByText('Pro').first()).toBeVisible();
  });

  test('La page FAQ (/faq) est accessible et les accordéons s’ouvrent', async ({ page }) => {
    await page.goto('/faq');
    await expect(page.getByRole('heading', { name: /foire aux questions/i })).toBeVisible();
    const firstQuestion = page.getByRole('button', { name: /Qu’est-ce que NexoraTech/i });
    await expect(firstQuestion).toBeVisible();
    await firstQuestion.click();
    await expect(page.getByText(/plateforme SaaS de boîte à outils/i)).toBeVisible();
  });

  test('Chaque catégorie du catalogue comporte au moins 1 outil fonctionnel', async ({ page }) => {
    await page.goto('/tools');

    // Vérification de la présence des 4 outils enregistrés dans le catalogue
    await expect(page.getByRole('heading', { name: /Bilan d'atténuation fibre optique/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Calculateur de sous-réseau IP/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Loi d'Ohm & Puissance UTE/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Convertisseur dBm ↔ Milliwatts/i })).toBeVisible();
  });

  test('L’outil d’atténuation fibre (/tools/fiber-attenuation) est fonctionnel', async ({ page }) => {
    await page.goto('/tools/fiber-attenuation');
    await expect(page.getByRole('heading', { name: /Bilan d'atténuation fibre optique/i })).toBeVisible();
    await expect(page.getByText(/Atténuation totale mesurée/i)).toBeVisible();
  });

  test('L’outil de sous-réseau IP (/tools/subnet-calculator) est fonctionnel', async ({ page }) => {
    await page.goto('/tools/subnet-calculator');
    await expect(page.getByRole('heading', { name: /Calculateur de sous-réseau IP/i })).toBeVisible();
    await expect(page.getByText(/Hôtes exploitables/i)).toBeVisible();
  });

  test('L’outil électrique UTE (/tools/ohm-law-power) est fonctionnel', async ({ page }) => {
    await page.goto('/tools/ohm-law-power');
    await expect(page.getByRole('heading', { name: /Loi d'Ohm & Puissance UTE/i })).toBeVisible();
    await expect(page.getByText(/Puissance active P/i)).toBeVisible();
  });

  test('L’outil de conversion dBm (/tools/dbm-mw-converter) est fonctionnel', async ({ page }) => {
    await page.goto('/tools/dbm-mw-converter');
    await expect(page.getByRole('heading', { name: /Convertisseur dBm ↔ Milliwatts/i })).toBeVisible();
    await expect(page.getByText(/Puissance en Milliwatts/i)).toBeVisible();
  });

  test('La Calculatrice Scientifique d’ingénierie (/tools/scientific-calculator) est fonctionnelle', async ({ page }) => {
    await page.goto('/tools/scientific-calculator');
    await expect(page.getByRole('heading', { name: /Calculatrice scientifique d'ingénierie/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'sin' })).toBeVisible();
  });

  test('L’outil de Codes Couleurs Fibre Optique (/tools/fiber-color-code) est fonctionnel', async ({ page }) => {
    await page.goto('/tools/fiber-color-code');
    await expect(page.getByRole('heading', { name: /Codes Couleurs de Fibre Optique/i })).toBeVisible();
    await expect(page.getByText(/Fiche d'Intervention/i)).toBeVisible();
  });

  test('Une route privée redirige un visiteur non connecté vers la connexion', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('Une URL inconnue affiche la page 404', async ({ page }) => {
    await page.goto('/cette-page-nexiste-pas');
    await expect(page.getByRole('heading', { name: /page introuvable/i })).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

/**
 * Test de fumée — non exécutable tant que Playwright n'est pas installé
 * (voir playwright.config.ts). Il documente le premier parcours à vérifier
 * en Phase 2.
 */
test.describe('parcours de base', () => {
  test("l'accueil s'affiche et mène au catalogue", async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /nexoratech/i })).toBeVisible();

    await page.getByRole('link', { name: /parcourir les outils/i }).click();
    await expect(page).toHaveURL(/\/tools$/);
  });

  test('une route privée redirige un visiteur non connecté', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('une URL inconnue affiche la page 404', async ({ page }) => {
    await page.goto('/cette-page-nexiste-pas');
    await expect(page.getByRole('heading', { name: /page introuvable/i })).toBeVisible();
  });
});

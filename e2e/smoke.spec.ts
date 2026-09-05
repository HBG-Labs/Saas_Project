import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const viewportWidth = await page.evaluate<number>('window.innerWidth');
  const documentWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(documentWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

/**
 * Test de fumée — Vérification de la disponibilité des routes principales, marketing et des 4 outils d'ingénierie.
 */
test.describe('Parcours de base & navigation marketing', () => {
  test("L'accueil s'affiche et contient le branding REZO360", async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /rezo360/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /commencer/i }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('La page Fonctionnalités (/features) est accessible et affiche le titre', async ({ page }) => {
    await page.goto('/features');
    await expect(page.getByRole('heading', { name: /fonctionnalités/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('La page Tarifs (/pricing) est accessible et affiche les 3 offres', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: /tarifs/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pro', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('La page FAQ (/faq) est accessible et les accordéons s’ouvrent', async ({ page }) => {
    await page.goto('/faq');
    await expect(page.getByRole('heading', { name: /foire aux questions/i })).toBeVisible();
    const firstQuestion = page.getByRole('button', { name: /Qu’est-ce que REZO360/i });
    await expect(firstQuestion).toBeVisible();
    await expect(page.getByText(/plateforme SaaS de gestion d’interventions/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('Le catalogue présente les outils universels actuels', async ({ page }) => {
    await page.goto('/tools');

    await expect(page.getByRole('heading', { name: 'Calculatrice Scientifique' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Calculateur de Surface' })).toBeVisible();
    await expect(page.getByRole('heading', { name: "Convertisseur d'unités" })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lampe Torche & Balisage' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('L’outil de sous-réseau IP (/tools/subnet-calculator) est fonctionnel', async ({ page }) => {
    await page.goto('/tools/subnet-calculator');
    await expect(page.getByRole('heading', { name: /Calculateur IPv4 \/ CIDR/i })).toBeVisible();
    await expect(page.getByText('Hôtes exploitables', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('L’outil électrique UTE (/tools/ohm-law-power) est fonctionnel', async ({ page }) => {
    await page.goto('/tools/ohm-law-power');
    await expect(page.getByRole('heading', { name: /Loi d'Ohm & Puissance UTE/i })).toBeVisible();
    await expect(page.getByText(/Puissance active P/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('L’outil de conversion dBm (/tools/dbm-mw-converter) est fonctionnel', async ({ page }) => {
    await page.goto('/tools/dbm-mw-converter');
    await expect(page.getByRole('heading', { name: 'Convertisseur', exact: true })).toBeVisible();
    await expect(page.getByText(/Puissance en Milliwatts/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('La Calculatrice Scientifique d’ingénierie (/tools/scientific-calculator) est fonctionnelle', async ({ page }) => {
    await page.goto('/tools/scientific-calculator');
    await expect(page.getByRole('heading', { name: 'Calculatrice Scientifique', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'sin', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('L’outil de Codes Couleurs Fibre Optique (/tools/fiber-color-code) est fonctionnel', async ({ page }) => {
    await page.goto('/tools/fiber-color-code');
    await expect(page.getByRole('heading', { name: /Codes Couleurs de Fibre Optique/i })).toBeVisible();
    await expect(page.getByText(/Fiche d'Intervention/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);
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

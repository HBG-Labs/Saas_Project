import { expect, test } from '@playwright/test';

import { devis, devisTotaux, facture, factureTotaux } from '../fixtures/donnees';
import { installeSupabase } from '../fixtures/supabase';

test.describe('Finance Atelier', () => {
  test('la chaîne de vente relie chiffrage, devis et factures sans changer les routes', async ({
    page,
  }) => {
    await installeSupabase(page, {
      role: 'owner',
      donnees: { quotes: [devis()], quote_totals: [devisTotaux()] },
    });

    await page.goto('/devis/historique');

    const navigation = page.getByRole('navigation', { name: 'Navigation des ventes' });
    await expect(navigation.getByRole('link', { name: 'Chiffrer', exact: true })).toHaveAttribute(
      'href',
      '/devis',
    );
    await expect(navigation.getByRole('link', { name: 'Devis', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(navigation.getByRole('link', { name: 'Factures', exact: true })).toHaveAttribute(
      'href',
      '/factures',
    );
    await expect(page.getByText('DV-2026-0087').filter({ visible: true })).toBeVisible();
    await expect(page.getByText('4320.00 €').filter({ visible: true })).toBeVisible();
  });

  test('la liste des factures reste dense sur bureau et tactile sur téléphone', async ({
    page,
    isMobile,
  }) => {
    await installeSupabase(page, {
      role: 'owner',
      donnees: {
        invoices: [facture({ status: 'issued', issued_at: '2026-09-18T12:00:00.000Z' })],
        invoice_totals: [factureTotaux()],
      },
    });

    await page.goto('/factures');

    if (isMobile) {
      await expect(page.locator('article').filter({ hasText: 'FA-2026-0118' })).toBeVisible();
    } else {
      await expect(
        page.getByRole('region', { name: 'Liste des factures et avoirs' }).getByRole('table'),
      ).toBeVisible();
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('les achats restent séparés des ventes', async ({ page }) => {
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/achats/commandes');

    const navigation = page.getByRole('navigation', { name: 'Navigation des achats' });
    await expect(navigation.locator('a[href="/achats/commandes"]')).toBeVisible();
    await expect(navigation.locator('a[href="/achats/fournisseurs"]')).toBeVisible();
    await expect(navigation.locator('a[href="/devis"]')).toHaveCount(0);
  });

  test('la facture lisible reste une feuille blanche en mode nuit', async ({ page }) => {
    await installeSupabase(page, {
      role: 'owner',
      donnees: { invoices: [facture()], invoice_totals: [factureTotaux()] },
    });
    await page.addInitScript(() => {
      localStorage.setItem('rezo360-theme-preset', 'atelier-nuit');
      localStorage.setItem('rezo360-theme', 'dark');
    });

    await page.goto('/factures/cccccccc-cccc-4ccc-8ccc-cccccccccccc');

    const paper = page.locator('#invoice-printable-area');
    await expect(paper).toBeVisible();
    const colors = await paper.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, foreground: style.color };
    });
    expect(colors.background).toBe('rgb(255, 255, 255)');
    expect(colors.foreground).toBe('rgb(15, 23, 42)');
  });
});

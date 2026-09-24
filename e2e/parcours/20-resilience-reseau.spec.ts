import { expect, test, type Page } from '@playwright/test';

import { installeSupabase } from '../fixtures/supabase';

const nombreAppels = (appels: readonly string[], table: string) =>
  appels.filter((appel) => appel.includes(`/rest/v1/${table}`)).length;

async function relanceEtVerifie(
  page: Page,
  appels: readonly string[],
  table: string,
  titre: string,
) {
  const alerte = page.getByRole('alert').filter({ hasText: titre });
  await expect(alerte).toBeVisible();
  const avant = nombreAppels(appels, table);
  const retry = alerte.getByRole('button', { name: 'Réessayer' });
  await retry.click();
  await expect.poll(() => nombreAppels(appels, table)).toBeGreaterThan(avant);
}

test.describe('Résilience réseau', () => {
  test('le Workspace peut relancer le chargement de ses espaces', async ({ page }) => {
    const { appels } = await installeSupabase(page, {
      role: 'owner',
      enErreur: ['workspace_spaces'],
    });

    await page.goto('/workspace/pages');
    await relanceEtVerifie(page, appels, 'workspace_spaces', 'Workspace indisponible');
  });

  test('une page Workspace inaccessible peut être rechargée', async ({ page }) => {
    const { appels } = await installeSupabase(page, {
      role: 'owner',
      enErreur: ['workspace_pages'],
    });

    await page.goto('/workspace/pages/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    await relanceEtVerifie(page, appels, 'workspace_pages', 'Page inaccessible');
  });

  test('la corbeille Workspace peut relancer son chargement', async ({ page, isMobile }) => {
    const { appels } = await installeSupabase(page, {
      role: 'owner',
      enErreur: ['workspace_pages'],
    });

    await page.goto('/workspace/pages');
    if (isMobile) {
      await page.getByRole('button', { name: 'Espaces et pages', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Corbeille', exact: false }).click();
    await relanceEtVerifie(page, appels, 'workspace_pages', 'Corbeille inaccessible');
  });

  test('la flotte peut relancer son chargement', async ({ page }) => {
    const { appels } = await installeSupabase(page, {
      role: 'owner',
      enErreur: ['vehicles'],
    });

    await page.goto('/vehicules');
    await relanceEtVerifie(page, appels, 'vehicles', 'Chargement impossible');
  });
});

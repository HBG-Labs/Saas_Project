import { expect, test, type Page } from '@playwright/test';

import { installeSupabase } from '../fixtures/supabase';
import { installeWorkspace, PAGE_ID } from './workspace-atelier-support';

/**
 * Les contrôles géométriques détectent les débordements, mais pas une couleur
 * accidentelle, une hiérarchie écrasée ou une carte déplacée. Ces trois vues
 * forment donc le contrat visuel minimal du produit : cockpit, liste métier et
 * éditeur Workspace. Chaque projet Playwright produit sa référence desktop ou
 * mobile avec les mêmes données et la même horloge.
 */
async function stabiliseRendu(page: Page) {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.clock.setFixedTime(new Date('2026-09-23T12:00:00.000Z'));
}

async function attendRendu(page: Page) {
  await expect(page.locator('main')).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

test.describe('Contrats visuels', () => {
  test('tableau de bord', async ({ page }) => {
    await stabiliseRendu(page);
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/dashboard');
    await attendRendu(page);

    await expect(page).toHaveScreenshot('tableau-de-bord.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.002,
    });
  });

  test('liste des missions', async ({ page }) => {
    await stabiliseRendu(page);
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/missions');
    await attendRendu(page);

    await expect(page).toHaveScreenshot('missions.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.002,
    });
  });

  test('éditeur Workspace', async ({ page }) => {
    await stabiliseRendu(page);
    await installeWorkspace(page);
    await page.goto(`/workspace/pages/${PAGE_ID}`);
    await expect(page.getByRole('textbox', { name: 'Titre', exact: true })).toBeVisible();
    await attendRendu(page);

    await expect(page).toHaveScreenshot('workspace.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.002,
    });
  });
});

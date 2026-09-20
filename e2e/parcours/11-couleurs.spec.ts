import { expect, test } from '@playwright/test';

import { installeSupabase } from '../fixtures/supabase';

test('les neuf couleurs se choisissent, recolorent les commandes et persistent', async ({
  page,
  isMobile,
}) => {
  await installeSupabase(page, { role: 'owner' });
  await page.goto('/clients');
  const action = page.locator('button').filter({ hasText: /^Nouveau client$/ });
  await expect(action).toBeVisible();
  const openCustomizer = async () => {
    await page.getByRole('button', { name: 'Changer de thème', exact: true }).click();
    await page.getByRole('menuitem', { name: /Personnaliser l.ambiance/ }).click();
  };
  await openCustomizer();
  const palette = page.getByRole('group', { name: 'Choisir une couleur' });
  await expect(palette.getByRole('button')).toHaveCount(9);
  const backgrounds = new Set<string>();
  for (const label of [
    'Bleu Marine / Nuit',
    'Bleu Cobalt Tech',
    'Violet Digital',
    'Vert Émeraude',
    'Rouge Rubis',
    'Ambre & Or Chaud',
    'Rose Fuchsia',
    'Cyan & Océan',
  ]) {
    const swatch = palette.getByRole('button', { name: label, exact: true });
    await swatch.click();
    await expect(swatch).toHaveAttribute('aria-pressed', 'true');
    if (isMobile) {
      const box = await swatch.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
    const color = await action.evaluate((element) => {
      const css = getComputedStyle(element);
      const primary = css.getPropertyValue('--primary').trim();
      const probe = document.createElement('span');
      probe.style.backgroundColor = primary;
      document.body.append(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { expected, actual: css.backgroundColor };
    });
    // Les transitions doivent avoir fini : le fond doit suivre le choix, pas rester vert.
    await expect(action).toHaveCSS('background-color', color.expected);
    backgrounds.add(color.expected);
  }
  expect(backgrounds.size).toBe(8);
  await page.getByRole('button', { name: 'Fermer le panneau de personnalisation' }).click();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(action).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'cyan');
  await expect(action).toHaveCSS('background-color', 'rgb(14, 116, 144)');

  if (isMobile) await page.getByRole('button', { name: 'Ouvrir le menu', exact: true }).click();
  const selected = page.locator('.atelier-nav-link[aria-current="page"]').filter({ visible: true });
  await expect(selected).toHaveCSS('background-color', 'rgb(14, 116, 144)');
  if (isMobile) await page.keyboard.press('Escape');

  await openCustomizer();
  await page.getByRole('radio', { name: /Atelier Nuit/ }).click();
  await expect(action).toHaveCSS('background-color', 'rgb(34, 211, 238)');
  await page.getByRole('button', { name: 'Réinitialiser', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'auto');
  await expect(action).toHaveCSS('background-color', 'rgb(49, 195, 102)');
});

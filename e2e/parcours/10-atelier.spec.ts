import { expect, test } from '@playwright/test';

import { installeSupabase } from '../fixtures/supabase';

test.describe('Atelier — fondations validées', () => {
  for (const preset of ['default', 'atelier-nuit', 'contraste-eleve']) {
    test(`commandes lisibles au pointeur et au doigt — ${preset}`, async ({ page, isMobile }) => {
      await installeSupabase(page, { role: 'owner' });
      await page.addInitScript((choice) => {
        localStorage.setItem('rezo360-theme-preset', choice);
        localStorage.setItem('rezo360-theme', choice === 'atelier-nuit' ? 'dark' : 'light');
      }, preset);
      await page.goto('/clients');
      const action = page.getByRole('button', { name: 'Nouveau client', exact: true });
      await expect(action).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const metrics = await action.evaluate((element) => {
        const css = getComputedStyle(element);
        return {
          height: element.getBoundingClientRect().height,
          radius: css.borderRadius,
          font: css.fontFamily,
          fontLoaded: document.fonts.check('700 13px Nunito'),
        };
      });
      expect(metrics.height).toBeGreaterThanOrEqual(isMobile ? 44 : 34);
      if (!isMobile) expect(metrics.height).toBeLessThan(37);
      expect(parseFloat(metrics.radius)).toBeGreaterThan(100);
      expect(metrics.font).toContain('Nunito');
      expect(metrics.fontLoaded).toBe(true);
      const search = page.getByRole('textbox').first();
      const input = await search.evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        fontSize: getComputedStyle(element).fontSize,
      }));
      expect(input.height).toBeGreaterThanOrEqual(isMobile ? 44 : 36);
      if (isMobile) expect(parseFloat(input.fontSize)).toBeGreaterThanOrEqual(16);
      await action.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(action).toBeFocused();
    });
  }

  test('les univers restent accessibles dans la barre repliée ou le menu mobile', async ({
    page,
    isMobile,
  }) => {
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/missions');
    if (isMobile) {
      await page.getByRole('button', { name: 'Ouvrir le menu', exact: true }).click();
      const finance = page.getByRole('radio', { name: 'Finance', exact: true });
      await expect(finance).toHaveText('Finance');
      await finance.click();
    } else {
      await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
      const trigger = page.getByRole('button', { name: /Changer d'univers : Gestion/ });
      await trigger.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('menuitem', { name: 'Finance', exact: true }).click();
      await expect(page.getByRole('button', { name: /Changer d'univers : Finance/ })).toBeFocused();
    }
    const navigation = page
      .getByRole('navigation', { name: 'Navigation principale' })
      .filter({ visible: true });
    await navigation.getByRole('link', { name: 'Factures', exact: true }).click();
    await expect(page).toHaveURL(/\/factures$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('réduit les transitions quand le système le demande', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/clients');
    const action = page.getByRole('button', { name: 'Nouveau client', exact: true });
    await expect(action).toBeVisible();
    const duration = await action.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    );
    expect(duration.split(',').every((value) => parseFloat(value) <= 0.001)).toBe(true);
  });
});

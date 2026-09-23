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
      expect(metrics.height).toBeGreaterThanOrEqual(isMobile ? 35 : 27);
      expect(metrics.height).toBeLessThan(isMobile ? 36 : 28);
      expect(parseFloat(metrics.radius)).toBeGreaterThan(100);
      expect(metrics.font).toContain('Nunito');
      expect(metrics.fontLoaded).toBe(true);
      const search = page.getByRole('textbox').first();
      const input = await search.evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        fontSize: getComputedStyle(element).fontSize,
      }));
      expect(input.height).toBeGreaterThanOrEqual(isMobile ? 40 : 36);
      if (isMobile) expect(input.height).toBeLessThanOrEqual(40);
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

    const localActionTab = page.locator('main .atelier-action-tab').first();
    await expect(localActionTab).toBeVisible();
    const localTabHeight = await localActionTab.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    expect(localTabHeight).toBeGreaterThanOrEqual(isMobile ? 35 : 28);
    expect(localTabHeight).toBeLessThan(isMobile ? 36 : 29);

    if (isMobile) {
      await page.getByRole('button', { name: 'Ouvrir le menu', exact: true }).click();
    }

    const navigation = page
      .getByRole('navigation', { name: 'Navigation principale' })
      .filter({ visible: true });
    const universes = navigation.getByRole('radiogroup', { name: 'Univers' });
    const underline = universes.locator('.segmented-underline-indicator');
    await expect(underline).toBeVisible();
    const underlineFill = underline.locator('span');
    const commonMenuColor = await underlineFill.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );

    const activeMission = navigation.getByRole('link', { name: 'Missions', exact: true });
    await expect(activeMission).toHaveAttribute('aria-current', 'page');
    const activeRail = await activeMission.evaluate((element) => {
      const css = getComputedStyle(element, '::before');
      return { width: css.width, color: css.backgroundColor };
    });
    expect(activeRail.width).toBe('3px');
    expect(activeRail.color).not.toBe('rgba(0, 0, 0, 0)');

    if (isMobile) {
      const workspace = universes.getByRole('radio', { name: 'Workspace', exact: true });
      const finance = universes.getByRole('radio', { name: 'Finance', exact: true });
      // Le contrôle contient aussi un libellé masqué pour les lecteurs d’écran.
      // Vérifier le texte affiché, le nom accessible étant déjà ciblé ci-dessus.
      await expect(finance).toHaveText('Finance', { useInnerText: true });
      const initialTransform = await underline.evaluate(
        (element) => getComputedStyle(element).transform,
      );

      await workspace.click();
      await expect(workspace).toBeChecked();
      await expect
        .poll(() => underlineFill.evaluate((element) => getComputedStyle(element).backgroundColor))
        .toBe(commonMenuColor);
      const workspaceIconBackground = await navigation
        .getByRole('link', { name: 'Pages', exact: true })
        .locator('svg')
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(workspaceIconBackground).toBe('rgba(0, 0, 0, 0)');

      await finance.click();
      await expect(finance).toBeChecked();
      await expect
        .poll(() => underline.evaluate((element) => getComputedStyle(element).transform))
        .not.toBe(initialTransform);
      await expect
        .poll(() => underlineFill.evaluate((element) => getComputedStyle(element).backgroundColor))
        .toBe(commonMenuColor);

      const financeIcons = [
        navigation.getByRole('link', { name: 'Devis', exact: true }).locator('svg'),
        navigation.getByRole('button', { name: 'Achats', exact: true }).locator('svg').first(),
      ];
      for (const icon of financeIcons) {
        const iconBackground = await icon.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        );
        expect(iconBackground).toBe('rgba(0, 0, 0, 0)');
      }
    } else {
      await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
      const trigger = page.getByRole('button', { name: /Changer d'univers : Gestion/ });
      await trigger.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('menuitem', { name: 'Finance', exact: true }).click();
      await expect(page.getByRole('button', { name: /Changer d'univers : Finance/ })).toBeFocused();
    }
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

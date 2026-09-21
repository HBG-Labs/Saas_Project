import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test.describe('Récupération PWA', () => {
  test('un module obsolète purge l’ancien shell puis redémarre', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Commencer gratuitement' }).first()).toBeVisible();

    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const staleCache = await caches.open('rezo360-pwa-v3');
      await staleCache.put('/ancien-shell', new Response('ancienne version'));
    });

    const rechargement = page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame());
    const prevented = await page.evaluate(() => {
      const event = Object.assign(new Event('vite:preloadError', { cancelable: true }), {
        payload: new TypeError(
          'Failed to fetch dynamically imported module: /assets/App-obsolete.js',
        ),
      });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });

    expect(prevented).toBe(true);
    await rechargement;
    await expect(page.getByRole('link', { name: 'Commencer gratuitement' }).first()).toBeVisible();

    const cacheNames = await page.evaluate(() => caches.keys());
    expect(cacheNames).not.toContain('rezo360-pwa-v3');
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
      'Nunito',
    );
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--app-styles-ready').trim(),
      ),
    ).toBe('v20260921');
    await expect(
      page.getByRole('heading', { name: 'L’application n’a pas pu démarrer' }),
    ).toHaveCount(0);
  });

  test('une feuille principale perdue est rechargée au lieu d’afficher du HTML brut', async ({
    page,
  }) => {
    let stylesheetRequests = 0;
    await page.route('**/assets/*.css', async (route) => {
      stylesheetRequests += 1;
      if (stylesheetRequests === 1) {
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Commencer gratuitement' }).first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).fontFamily))
      .toContain('Nunito');
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--app-styles-ready').trim(),
        ),
      )
      .toBe('v20260921');

    expect(stylesheetRequests).toBeGreaterThanOrEqual(2);
    await expect(page.locator('html')).toHaveClass(/rezo360-styles-ready/);
    await expect(page.locator('html')).toHaveClass(/rezo360-app-ready/);
    await expect(page.locator('#rezo360-style-boot')).toBeHidden();
    await expect(
      page.getByRole('heading', { name: 'L’application n’a pas pu démarrer' }),
    ).toHaveCount(0);
  });

  test('le worker ignore un CSS empoisonné dans Cache Storage', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/rezo360-styles-ready/);

    const poisonedCss = 'html { display: none !important; }';
    await page.evaluate(async (css) => {
      const stylesheet = document.querySelector<HTMLLinkElement>(
        'link[rel="stylesheet"][href*="/assets/"]',
      );
      if (!stylesheet) throw new Error('Feuille principale introuvable');

      const cache = await caches.open('rezo360-pwa-v7');
      await cache.put(
        stylesheet.href,
        new Response(css, { headers: { 'content-type': 'text/css' } }),
      );
    }, poisonedCss);

    await page.reload();

    await expect(page.locator('html')).toHaveClass(/rezo360-styles-ready/);
    await expect(page.locator('html')).toHaveClass(/rezo360-app-ready/);
    await expect(page.getByRole('link', { name: 'Commencer gratuitement' }).first()).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
      'Nunito',
    );
    expect(
      await page.evaluate(async () => {
        const stylesheet = document.querySelector<HTMLLinkElement>(
          'link[rel="stylesheet"][href*="/assets/"]',
        );
        if (!stylesheet) return '';
        const response = await (await caches.open('rezo360-pwa-v7')).match(stylesheet.href);
        return response?.text();
      }),
    ).toBe(poisonedCss);
  });

  test('un fichier d’entrée obsolète ne laisse jamais un écran blanc', async ({ page }) => {
    let entryRequests = 0;
    await page.route(/\/assets\/index-[^/]+\.js(?:\?.*)?$/, async (route) => {
      entryRequests += 1;
      if (entryRequests === 1) {
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Commencer gratuitement' }).first()).toBeVisible({
      timeout: 20_000,
    });
    expect(entryRequests).toBeGreaterThanOrEqual(2);
    await expect(page.locator('html')).toHaveClass(/rezo360-styles-ready/);
    await expect(page.locator('html')).toHaveClass(/rezo360-app-ready/);
    await expect(page.locator('#rezo360-style-boot')).toBeHidden();
  });
});

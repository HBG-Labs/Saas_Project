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
    await expect(
      page.getByRole('heading', { name: 'L’application n’a pas pu démarrer' }),
    ).toHaveCount(0);
  });
});

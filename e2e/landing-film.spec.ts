import { expect, test } from '@playwright/test';

test('le film suit le scroll dans les deux sens et reste pilotable au clavier', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('#rezo360-style-boot')).toBeHidden();
  const dismiss = page.getByRole('button', { name: 'Tout refuser' });
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(page.locator('.lp-film')).toBeVisible();
  const moveTo = async (progress: number) => {
    await page.locator('.lp-film').evaluate((section, fraction) => {
      const top = section.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(
        0,
        top - 80 + fraction * (section.getBoundingClientRect().height - window.innerHeight),
      );
    }, progress);
  };
  await moveTo(0.2);
  const film = page.locator('.lp-film video');
  await expect
    .poll(() => film.evaluate((element: HTMLVideoElement) => element.readyState))
    .toBeGreaterThanOrEqual(2);
  await expect
    .poll(() => film.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThan(0.5);
  await moveTo(0.8);
  await expect
    .poll(() => film.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThan(3.4);
  await moveTo(0.2);
  await expect
    .poll(() => film.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeLessThan(1.6);
  await page.getByRole('slider', { name: 'Progression du film de terrain' }).focus();
  await page.getByRole('slider', { name: 'Progression du film de terrain' }).press('End');
  await expect
    .poll(() => film.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThan(4.5);
  expect(await film.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  expect(errors).toEqual([]);
});

test('la réduction des mouvements conserve la photo et évite le téléchargement vidéo', async ({
  page,
}) => {
  const videos: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('.mp4')) videos.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#rezo360-style-boot')).toBeHidden();
  await page.locator('.lp-film').scrollIntoViewIfNeeded();
  await expect(page.locator('.lp-film__poster')).toBeVisible();
  await expect(page.locator('.lp-film video')).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Progression du film de terrain' })).toHaveCount(0);
  expect(videos).toEqual([]);
});

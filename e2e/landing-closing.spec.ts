import { expect, test } from '@playwright/test';

test('le vrai film du final suit le scroll et le clavier dans les deux sens', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('#rezo360-style-boot')).toBeHidden();
  await expect(page.locator('.lp-closing-scene')).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  const dismiss = page.getByRole('button', { name: 'Tout refuser' });
  if (await dismiss.isVisible()) await dismiss.click();
  const scene = page.locator('.lp-closing-scene');
  await expect(scene.locator('.lp-product-frame, .lp-closing-report')).toHaveCount(0);
  await expect(scene.locator('img')).toHaveCount(1); // Only the video fallback poster remains.
  const film = page.locator('.lp-closing-photo video');
  const moveTo = async (fraction: number) => {
    await scene.evaluate((element, target) => {
      const stage = element.querySelector<HTMLElement>('.lp-closing-stage')!;
      const top = element.getBoundingClientRect().top + window.scrollY;
      const offset = parseFloat(getComputedStyle(stage).top);
      window.scrollTo({
        top: top - offset + (element.clientHeight - stage.offsetHeight) * target,
        behavior: 'instant',
      });
    }, fraction);
    await expect
      .poll(() => film.evaluate((video: HTMLVideoElement) => video.currentTime))
      .toBeCloseTo(4.92 * fraction, 1);
    await expect.poll(() => film.evaluate((video: HTMLVideoElement) => video.seeking)).toBe(false);
    const stageTop = await page.locator('.lp-closing-stage').evaluate((element) => ({
      actual: element.getBoundingClientRect().top,
      expected: parseFloat(getComputedStyle(element).top),
    }));
    expect(stageTop.actual).toBeCloseTo(stageTop.expected, 0);
  };
  const frameHash = () =>
    film.evaluate((video: HTMLVideoElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 18;
      const context = canvas.getContext('2d')!;
      context.drawImage(video, 0, 0, 32, 18);
      return Array.from(context.getImageData(0, 0, 32, 18).data).join(',');
    });
  await moveTo(0.1);
  const firstFrame = await frameHash();
  await page.screenshot({ path: testInfo.outputPath('closing-open.png'), scale: 'css' });
  await moveTo(0.9);
  expect(await frameHash()).not.toBe(firstFrame);
  await page.screenshot({ path: testInfo.outputPath('closing-closed.png'), scale: 'css' });
  await moveTo(0.2);
  const slider = page.getByRole('slider', { name: 'Progression du film de fin d’intervention' });
  await slider.focus();
  await slider.press('End');
  await expect
    .poll(() => film.evaluate((video: HTMLVideoElement) => video.currentTime))
    .toBeGreaterThan(4.5);
  await slider.press('Home');
  await expect
    .poll(() => film.evaluate((video: HTMLVideoElement) => video.currentTime))
    .toBeLessThan(0.2);
  expect(
    await film.evaluate(
      (video: HTMLVideoElement) => video.paused && video.muted && !video.autoplay,
    ),
  ).toBe(true);
  await expect(
    page.locator('.lp-final').getByRole('link', { name: 'Créer mon compte gratuit' }),
  ).toHaveAttribute('href', '/register');
  expect(errors).toEqual([]);
});

test('le mode réduit garde la photo sans télécharger le film et réagit aux changements de préférence', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/closing-scroll.*\.mp4/.test(request.url())) requests.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#dernier-geste');
  await expect(page.locator('#rezo360-style-boot')).toBeHidden();
  const scene = page.locator('.lp-closing-scene');
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveClass(/is-still/);
  await expect(scene.locator('img').first()).toBeVisible();
  await expect(scene.locator('video, input, .lp-closing-travel')).toHaveCount(0);
  expect(requests).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await scene.scrollIntoViewIfNeeded();
  await expect(scene.locator('video')).toBeAttached();
  await expect
    .poll(() => scene.locator('video').evaluate((video: HTMLVideoElement) => video.readyState))
    .toBeGreaterThanOrEqual(2);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(scene).toHaveClass(/is-still/);
  await expect(scene.locator('video, input, .lp-closing-travel')).toHaveCount(0);
  await page.locator('.lp-final .lp-cta').focus();
  await expect(page.locator('.lp-final .lp-cta')).toBeFocused();
});

test('une vidéo indisponible laisse un final complet sans espace de scroll vide', async ({
  page,
}) => {
  await page.route('**/closing-scroll*.mp4', (route) => route.abort());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#dernier-geste');
  await expect(page.locator('#rezo360-style-boot')).toBeHidden();
  const scene = page.locator('.lp-closing-scene');
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveClass(/is-still/);
  await expect(scene.locator('img').first()).toBeVisible();
  await expect(scene.locator('video, input, .lp-closing-travel')).toHaveCount(0);
  await expect(page.locator('.lp-final .lp-cta')).toHaveAttribute('href', '/register');
});

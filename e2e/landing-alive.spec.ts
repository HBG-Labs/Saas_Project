import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, reducedMotion: 'reduce' | 'no-preference' = 'no-preference') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(() =>
    localStorage.setItem(
      'rezo360_cookie_consent',
      JSON.stringify({ analytics: false, marketing: false, decidedAt: '2026-09-25T10:00:00Z' }),
    ),
  );
  await page.goto('/');
  await expect(page.locator('#rezo360-style-boot')).toBeHidden();
  await expect(page.locator('.lp-hero h1')).toBeVisible();
}

async function scrollStory(page: Page, progress: number) {
  await page.locator('.lp-journey-track').evaluate((track, fraction) => {
    const stage = track.querySelector('.lp-journey-layout') as HTMLElement;
    const start = track.getBoundingClientRect().top + window.scrollY - 108;
    window.scrollTo({
      top: start + (track.clientHeight - stage.offsetHeight) * fraction,
      behavior: 'instant',
    });
  }, progress);
}

test('le scroll raconte les étapes dans les deux sens, le choix manuel garde la main', async ({
  page,
}) => {
  await open(page);
  await scrollStory(page, 0.05);
  await expect(page.getByRole('button', { name: '01 Planning', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await scrollStory(page, 0.66);
  await expect(page.getByRole('button', { name: '04 Facture', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await scrollStory(page, 0.26);
  await expect(page.getByRole('button', { name: '02 Intervention', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '03 Compte rendu', exact: true }).click();
  await scrollStory(page, 0.87);
  await expect(page.getByRole('button', { name: '03 Compte rendu', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Reprendre au défilement', exact: true }).click();
  await scrollStory(page, 0.08);
  await expect(page.getByRole('button', { name: '01 Planning', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('le mode sans mouvement et le mobile suppriment la séquence sticky', async ({ page }) => {
  await open(page, 'reduce');
  await expect(page.locator('.lp-journey-layout')).toHaveCSS('position', 'static');
  await page.getByRole('button', { name: '05 Paiement', exact: true }).click();
  await expect(page.getByRole('button', { name: '05 Paiement', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.lp-journey-layout')).toHaveCSS('position', 'sticky');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.lp-journey-layout')).toHaveCSS('position', 'static');
  await page.getByRole('button', { name: '01 Planning', exact: true }).click();
  await expect
    .poll(() =>
      page.locator('.lp-journey-shot img').evaluate((img) => (img as HTMLImageElement).currentSrc),
    )
    .toContain('mobile-planning.webp');
  await page.getByRole('button', { name: 'Agrandir l’écran', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Planning · REZO360', exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.lp-screen-dialog-image img')
        .evaluate((img) => (img as HTMLImageElement).currentSrc),
    )
    .toContain('mobile-planning.webp');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Agrandir l’écran', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Compte rendu', exact: true }).click();
  await expect(page.locator('#ln-document-panel')).toBeVisible();
  await expect(page.locator('#ln-note-panel')).toBeHidden();
  await expect(page.getByText('Document prêt à être relu', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Note vocale', exact: true }).click();
  await expect(page.locator('#ln-note-panel')).toBeVisible();
});

test('les scènes chargent des images légères et la palette reste limitée à la landing', async ({
  page,
}) => {
  const films: string[] = [];
  page.on('request', (request) => {
    if (/\.mp4(?:\?|$)/.test(request.url())) films.push(request.url());
  });
  await open(page, 'reduce');
  await expect(page.locator('.landing-shell')).toHaveCSS('background-color', 'rgb(9, 19, 30)');
  await page.locator('#dernier-geste').scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .locator('.lp-final-landscape img')
        .evaluate(
          (img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
        ),
    )
    .toBe(true);
  await expect(page.locator('.lp-final .lp-cta')).toHaveAttribute('href', '/register');
  expect(films).toEqual([]);
  await page.locator('.lp-final .lp-cta').click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.locator('.public-shell')).not.toHaveClass(/landing-shell/);
  await expect(page.locator('.public-shell')).not.toHaveCSS('background-color', 'rgb(9, 19, 30)');
});

test('le film terrain mobile suit le scroll sans téléphone ni curseur et respecte le mouvement réduit', async ({
  page,
}) => {
  await open(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const visual = page.locator('.lp-field-visual');
  const film = visual.locator('video');
  await expect(film).toHaveCount(0); // No film download before approaching the section.

  const moveSceneTo = async (viewportFraction: number) => {
    await visual.evaluate((element, position) => {
      window.scrollTo({
        top: window.scrollY + element.getBoundingClientRect().top - innerHeight * position,
        behavior: 'instant',
      });
    }, viewportFraction);
  };
  await moveSceneTo(0.65);
  await expect(visual.locator('.lp-field-phone')).toBeHidden();
  await expect(film).toBeVisible();
  await expect(film).toHaveClass(/is-ready/);
  await expect
    .poll(() => film.evaluate((element) => (element as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.1);
  const firstTime = await film.evaluate((element) => (element as HTMLVideoElement).currentTime);
  await moveSceneTo(0.15);
  await expect
    .poll(() => film.evaluate((element) => (element as HTMLVideoElement).currentTime))
    .toBeGreaterThan(firstTime + 0.3);
  await moveSceneTo(0.65);
  await expect
    .poll(() => film.evaluate((element) => (element as HTMLVideoElement).currentTime))
    .toBeLessThan(firstTime + 0.1);
  expect(await film.evaluate((element) => (element as HTMLVideoElement).controls)).toBe(false);
  await expect(visual.getByRole('slider')).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(film).toHaveCount(0);
  await expect(visual.locator('img.lp-field-photo')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(visual.locator('.lp-field-phone')).toBeVisible();
  await expect(film).toHaveCount(0);
});

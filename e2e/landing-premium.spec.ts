import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 360, height: 780 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(sizes.document, `débordement à ${sizes.viewport}px`).toBeLessThanOrEqual(
    sizes.viewport + 1,
  );
}

async function expectLandingReady(page: Page) {
  await expect(page.locator('#rezo360-style-boot')).toBeHidden();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Votre activité en mieux. Tout simplement.' }),
  ).toBeVisible();
}

async function loadEveryLandingImage(page: Page) {
  // Inactive screenshots are intentionally hidden and lazy. Visit each real
  // screen before checking its image; do not defeat production lazy loading.
  for (const button of await page.locator('.lp-journey-steps button').all()) {
    await button.click();
    await expect
      .poll(() =>
        page
          .locator('.lp-journey-shot img')
          .evaluate(
            (image) =>
              (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
          ),
      )
      .toBe(true);
  }
  await page.locator('.lp-journey-steps button').first().click();
  // Wait in the viewport for native lazy loading, including the final <picture>.
  // A rapid full-page sweep can leave mobile images before Chromium schedules them.
  for (const image of await page.locator('main img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (element) =>
            (element as HTMLImageElement).complete &&
            (element as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

  await expect
    .poll(async () =>
      page
        .locator('main img')
        .evaluateAll((images) =>
          images
            .filter(
              (image) =>
                !(image as HTMLImageElement).complete ||
                (image as HTMLImageElement).naturalWidth === 0,
            )
            .map(
              (image) => (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src,
            ),
        ),
    )
    .toEqual([]);
}

test.describe('Landing premium REZO360', () => {
  test('préserve les parcours de conversion et les interactions', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (
        message.type() === 'error' ||
        (message.type() === 'warning' &&
          !message.text().includes('Service Worker registration blocked by Playwright'))
      )
        consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    await expectLandingReady(page);
    const openingOrder = await page
      .locator('.landing-alive > *')
      .evaluateAll((sections) => sections.slice(0, 4).map((section) => section.classList[0]));
    expect(openingOrder).toEqual(['lp-hero', 'lp-journey', 'lp-field-experience', 'ln-section']);
    await expect(page.locator('.lp-hero h1')).toBeVisible();
    await expect(page.locator('.lp-hero .lp-cta')).toHaveAttribute('href', '/register');
    await expect(page.locator('.lp-hero-landscape img')).toBeVisible();
    await expect(page.locator('.landing-alive video')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'Créer mon compte gratuit', exact: true }).first(),
    ).toHaveAttribute('href', '/register');
    await expect(page.getByRole('link', { name: 'Explorer les écrans' })).toHaveAttribute(
      'href',
      '#produit',
    );

    const invoiceStep = page.getByRole('button', { name: '04 Facture', exact: true });
    await invoiceStep.click();
    await expect(invoiceStep).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('img', { name: 'Interface réelle REZO360 — Facture', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Agrandir l’écran' }).click();
    await expect(page.getByRole('dialog', { name: 'Facture · REZO360' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Agrandir l’écran' })).toBeFocused();
    await page.getByRole('button', { name: '02 Workspace' }).click();
    await expect(
      page.getByRole('img', { name: 'Véritable espace Workspace de REZO360' }),
    ).toBeVisible();

    const firstFaq = page.getByRole('button', { name: /Que puis-je faire avec le compte gratuit/ });
    await firstFaq.click();
    await expect(firstFaq).toHaveAttribute('aria-expanded', 'false');
    await firstFaq.click();
    await expect(firstFaq).toHaveAttribute('aria-expanded', 'true');

    expect(consoleErrors).toEqual([]);
  });

  test('propose une navigation mobile pleinement utilisable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expectLandingReady(page);

    await page.getByRole('button', { name: 'Ouvrir le menu', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Menu de navigation', exact: true });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Le produit' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Tarifs' })).toHaveAttribute('href', '/#tarifs');
    await expect(menu.getByRole('link', { name: 'Connexion' })).toHaveAttribute('href', '/login');
    await expect(
      menu.getByRole('link', { name: 'Créer mon compte gratuit', exact: true }),
    ).toHaveAttribute('href', '/register');
    await page.getByRole('button', { name: 'Fermer le menu', exact: true }).click();
    await expect(menu).toBeHidden();
    await page.getByRole('button', { name: 'Ouvrir le menu', exact: true }).click();
    await menu.getByRole('link', { name: 'Le produit', exact: true }).click();
    await expect(menu).toBeHidden();
    await expect
      .poll(() =>
        page
          .locator('#produit')
          .evaluate((section) => Math.abs(section.getBoundingClientRect().top - 100)),
      )
      .toBeLessThan(5);
  });

  test('reste sans débordement sur tous les paliers demandés', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expectLandingReady(page);
      await expectNoHorizontalOverflow(page);
    }
  });

  test('produit une capture de contrôle lisible', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(
      testInfo.project.name === 'chromium'
        ? { width: 1440, height: 900 }
        : { width: 390, height: 844 },
    );
    await page.goto('/');
    await expectLandingReady(page);
    await loadEveryLandingImage(page);
    const cookieReject = page.getByRole('button', { name: /Tout refuser/ });
    if (await cookieReject.isVisible()) await cookieReject.click();
    await page.screenshot({
      path: testInfo.outputPath('landing-full.png'),
      fullPage: true,
      scale: 'css',
    });
    for (const [name, selector] of [
      ['hero', '.lp-hero'],
      ['field', '.lp-field-experience'],
      ['product-journey', '.lp-journey'],
      ['pricing', '.lp-pricing'],
      ['voice', '#voix'],
      ['universes', '#univers'],
      ['proofs', '.lp-evidence'],
      ['closing', '.lp-final'],
    ] as const) {
      await page.locator(selector).screenshot({
        path: testInfo.outputPath(`${name}.png`),
        style: '.public-header { visibility: hidden !important; }',
      });
    }
  });

  test('préserve le clavier, le SEO et le mode sans animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.goto('/');
    await expectLandingReady(page);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://rezo360.com/',
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-image/);
    await expect(page.locator('.ln-voice-stage')).toHaveAttribute('data-stage', '4');
    await expect(page.locator('.lp-field-phone img')).toHaveAttribute(
      'src',
      '/images/product/premium/mobile.webp',
    );
    await expect(page.locator('.lp-final .lp-cta')).toHaveAttribute('href', '/register');
    await page.getByRole('link', { name: 'Explorer les écrans' }).focus();
    await expect(page.getByRole('link', { name: 'Explorer les écrans' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#produit$/);
    await expect(page.getByRole('button', { name: '01 Planning' })).toBeVisible();
    const brokenAnchors = await page
      .locator('a[href^="#"]')
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute('href') ?? '')
          .filter((href) => href.length > 1 && !document.getElementById(href.slice(1))),
      );
    expect(brokenAnchors).toEqual([]);
  });
});

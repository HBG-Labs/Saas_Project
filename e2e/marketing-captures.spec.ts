import { expect, test, type Page } from '@playwright/test';
import {
  installMarketingDemo,
  DEVIS_ID,
  FACTURE_ID,
  INTERVENTION_ID,
  PAGE_ID,
} from './fixtures/marketing';

/** Captures of real React routes with a fully intercepted fictional backend. */
test('capture les interfaces authentiques pour la landing', async ({ page, isMobile }) => {
  test.skip(isMobile, 'One deterministic capture production per run.');
  test.setTimeout(180_000);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.clock.setFixedTime(new Date('2026-09-23T10:00:00.000Z'));
  await page.setViewportSize({ width: 1440, height: 960 });
  await installMarketingDemo(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  async function capture(name: string, route: string, ready: (page: Page) => Promise<unknown>) {
    const selected = process.env.MARKETING_CAPTURE_ONLY?.split(',');
    if (selected && !selected.includes(name)) return;
    await page.goto(route);
    await ready(page);
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    await expect(page.locator('#rezo360-style-boot')).toBeHidden();
    await page.screenshot({
      path: `artifacts/product-captures/${name}.png`,
      animations: 'disabled',
      caret: 'hide',
    });
  }
  await capture('dashboard', '/dashboard', (p) =>
    expect(p.getByRole('heading', { name: 'Tableau de bord', exact: true })).toBeVisible(),
  );
  await capture('planning', '/planning?view=week&date=2026-09-23', async (p) => {
    await expect(p.getByRole('heading', { name: 'Planning', exact: true })).toBeVisible();
    await p.getByRole('button', { name: 'Semaine', exact: true }).click();
  });
  await capture('missions', '/missions', (p) =>
    expect(p.getByText('Maintenance préventive CVC').first()).toBeVisible(),
  );
  await capture('report', `/interventions/${INTERVENTION_ID}/rapport`, (p) =>
    expect(p.getByText('Compte rendu', { exact: true }).first()).toBeVisible(),
  );
  await capture('workspace', `/workspace/pages/${PAGE_ID}`, (p) =>
    expect(p.getByRole('textbox', { name: 'Titre', exact: true })).toBeVisible(),
  );
  await capture('library', '/bibliotheque', (p) =>
    expect(
      p.getByText('Notice de maintenance CVC').filter({ visible: true }).first(),
    ).toBeVisible(),
  );
  await capture('quotes', '/devis/historique', (p) =>
    expect(p.getByText('DV-2026-0087').filter({ visible: true }).first()).toBeVisible(),
  );
  await capture('quote', `/devis/${DEVIS_ID}`, (p) =>
    expect(p.getByText('DV-2026-0087').filter({ visible: true }).first()).toBeVisible(),
  );
  await capture('invoices', '/factures', (p) =>
    expect(p.getByText('FA-2026-0118').filter({ visible: true }).first()).toBeVisible(),
  );
  await capture('invoice', `/factures/${FACTURE_ID}`, async (p) => {
    await expect(p.locator('#invoice-printable-area')).toBeVisible();
    await p
      .locator('#invoice-printable-area')
      .evaluate((element) => element.scrollIntoView({ block: 'start' }));
  });
  await installMarketingDemo(page, { paid: true });
  await capture('payment', `/factures/${FACTURE_ID}`, (p) =>
    expect(p.locator('#invoice-printable-area')).toBeVisible(),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('mobile', `/interventions/${INTERVENTION_ID}`, (p) =>
    expect(p.getByRole('heading').first()).toBeVisible(),
  );
  await capture('mobile-missions', '/missions', (p) =>
    expect(p.getByText('Maintenance préventive CVC').first()).toBeVisible(),
  );
  await capture('mobile-planning', '/planning?view=day&date=2026-09-23', (p) =>
    expect(p.getByRole('heading', { name: 'Planning', exact: true })).toBeVisible(),
  );
  expect(errors).toEqual([]);
});

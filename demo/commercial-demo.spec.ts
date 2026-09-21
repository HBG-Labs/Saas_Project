import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { DEMO, readDemoEnvironment, type DemoEnvironment } from './helpers/env';
import {
  cinematicClick,
  installPresentationLayer,
  pause,
  RECORDING_CONTEXT_OPTIONS,
  showSection,
  smoothScroll,
  typeCinematically,
} from './helpers/motion';
import { installSafetyBarrier, type SafetyMonitor } from './helpers/safety';

const VIDEO_SIZE = { width: 1920, height: 1080 };
type InMemoryStorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

async function bootstrapSession(
  browser: Browser,
  env: DemoEnvironment,
  email: string,
  password: string,
): Promise<InMemoryStorageState> {
  const context = await browser.newContext({
    ...RECORDING_CONTEXT_OPTIONS,
    baseURL: env.baseUrl,
  });
  const page = await context.newPage();
  await installPresentationLayer(page);
  const safety = await installSafetyBarrier(page, env, { allowPasswordLogin: true });

  try {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await page.getByLabel('Adresse e-mail').fill(email);
    await page.getByRole('textbox', { name: 'Mot de passe', exact: true }).fill(password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.waitForURL((url) => url.pathname !== '/login', { timeout: 30_000 });
    const state = await context.storageState();
    safety.assertClean();
    return state;
  } finally {
    await context.close();
  }
}

async function openRecordingContext(
  browser: Browser,
  env: DemoEnvironment,
  storageState: InMemoryStorageState,
): Promise<{ context: BrowserContext; page: Page; safety: SafetyMonitor }> {
  const rawDirectory = path.resolve('demo-output', 'raw');
  await mkdir(rawDirectory, { recursive: true });
  const context = await browser.newContext({
    ...RECORDING_CONTEXT_OPTIONS,
    baseURL: env.baseUrl,
    storageState,
    recordVideo: {
      dir: rawDirectory,
      size: VIDEO_SIZE,
    },
  });
  const page = await context.newPage();
  await installPresentationLayer(page);
  const safety = await installSafetyBarrier(page, env, { allowPasswordLogin: false });
  return { context, page, safety };
}

async function saveVideo(
  page: Page,
  context: BrowserContext,
  safety: SafetyMonitor,
  filename: string,
): Promise<void> {
  const video = page.video();
  if (!video) throw new Error('Playwright n’a pas créé la vidéo attendue.');
  safety.assertClean();
  await page.close();
  await context.close();
  await video.saveAs(path.resolve('demo-output', 'raw', filename));
}

async function openPath(page: Page, pathname: string, heading: string | RegExp): Promise<void> {
  await page.goto(pathname);
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  await pause(page, 750);
}

async function recordBusinessStory(page: Page): Promise<void> {
  await openPath(page, '/dashboard', 'Tableau de bord');
  await expect(page.getByRole('heading', { name: 'Missions récentes' })).toBeVisible();
  await page.waitForTimeout(2_000);

  await cinematicClick(page, page.getByRole('link', { name: 'Clients', exact: true }).first());
  await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
  const customerSearch = page.getByRole('textbox', { name: 'Rechercher' });
  await typeCinematically(customerSearch, DEMO.customerName);
  await pause(page, 1_500);
  await cinematicClick(page, page.locator(`a[href="/clients/${DEMO.customerId}"]`).first());
  await expect(page.getByRole('heading', { name: DEMO.customerName })).toBeVisible();
  await pause(page, 2_000);
  await cinematicClick(page, page.getByRole('tab', { name: "Sites d'intervention" }));
  await pause(page, 1_700);
  await cinematicClick(page, page.getByRole('tab', { name: 'Historique des missions' }));
  await pause(page, 2_000);

  await cinematicClick(page, page.getByRole('link', { name: 'Planning', exact: true }).first());
  await expect(page.getByRole('heading', { name: 'Planning & congés' })).toBeVisible();
  await pause(page, 2_500);
  await cinematicClick(page, page.getByRole('button', { name: 'Semaine', exact: true }));
  await pause(page, 2_300);

  await cinematicClick(page, page.getByRole('link', { name: 'Missions', exact: true }).first());
  await expect(page.getByRole('heading', { name: 'Missions' })).toBeVisible();
  await cinematicClick(page, page.getByRole('combobox', { name: 'Statut' }));
  await cinematicClick(page, page.getByRole('option', { name: 'Clôturée', exact: true }));
  const missionSearch = page.getByRole('textbox', { name: 'Rechercher' });
  await typeCinematically(missionSearch, DEMO.missionReference);
  await pause(page, 1_500);
  await cinematicClick(
    page,
    page.getByRole('link', { name: DEMO.missionTitle, exact: true }).first(),
  );
  await expect(
    page.getByRole('heading', { name: DEMO.missionTitle, exact: true, level: 1 }),
  ).toBeVisible();
  await pause(page, 2_200);
  await showSection(page, 'Interventions');
  await cinematicClick(
    page,
    page.locator(`a[href="/interventions/${DEMO.interventionId}"]`).first(),
  );

  await expect(
    page.getByRole('heading', { name: DEMO.missionTitle, exact: true, level: 1 }),
  ).toBeVisible();
  await pause(page, 1_800);
  await showSection(page, 'Photos & Justificatifs terrain');
  await pause(page, 2_100);
  await showSection(page, 'Relevé du temps');
  await pause(page, 2_200);
  await smoothScroll(page, 0);
  await cinematicClick(
    page,
    page.locator(`a[href="/interventions/${DEMO.interventionId}/rapport"]`).first(),
  );

  await expect(page.getByRole('heading', { name: 'Compte rendu' })).toBeVisible();
  await pause(page, 1_600);
  await showSection(page, 'Travaux réalisés');
  await pause(page, 2_300);
  await showSection(page, 'Photos et documents');
  await pause(page, 2_000);
  await showSection(page, 'Signatures & Validation terrain');
  await pause(page, 2_400);

  await openPath(page, '/devis/historique', 'Historique des devis');
  await pause(page, 1_500);
  await cinematicClick(page, page.locator(`a[href="/devis/${DEMO.quoteId}"]`).first());
  await expect(page.getByRole('heading', { name: DEMO.quoteReference })).toBeVisible();
  await pause(page, 2_800);

  await cinematicClick(page, page.getByRole('link', { name: 'Factures', exact: true }).first());
  await expect(page.getByRole('heading', { name: 'Factures' })).toBeVisible();
  await pause(page, 1_500);
  await cinematicClick(page, page.locator(`a[href="/factures/${DEMO.invoiceId}"]`).first());
  await expect(page.getByRole('heading', { name: /^FAC-/ })).toBeVisible();
  await pause(page, 2_800);

  await openPath(page, '/stock', 'Stocks & fournitures');
  await pause(page, 3_200);
  await smoothScroll(page, 420);
  await pause(page, 1_700);

  await openPath(page, '/dashboard', 'Tableau de bord');
  await expect(page.getByRole('heading', { name: 'Missions récentes' })).toBeVisible();
  await page.waitForTimeout(2_500);
}

async function recordPortalStory(page: Page): Promise<void> {
  await openPath(page, '/portail', /^Bonjour/);
  await page.waitForTimeout(3_500);
  await showSection(page, 'À suivre');
  await pause(page, 1_600);
  await smoothScroll(page, 420);
  await pause(page, 2_000);
  await showSection(page, 'Derniers échanges');
  await pause(page, 1_700);
  await showSection(page, 'Documents récents');
  await page.waitForTimeout(2_000);
}

test('enregistre la démo commerciale REZO360 sans mutation métier', async ({ browser }) => {
  const env = readDemoEnvironment();

  const businessState = await bootstrapSession(
    browser,
    env,
    env.businessEmail,
    env.businessPassword,
  );
  const business = await openRecordingContext(browser, env, businessState);
  await recordBusinessStory(business.page);
  await saveVideo(business.page, business.context, business.safety, 'business.webm');

  const portalState = await bootstrapSession(browser, env, env.portalEmail, env.portalPassword);
  const portal = await openRecordingContext(browser, env, portalState);
  await recordPortalStory(portal.page);
  await saveVideo(portal.page, portal.context, portal.safety, 'portal.webm');
});

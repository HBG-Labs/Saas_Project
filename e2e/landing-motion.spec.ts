import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

async function openLanding(page: Page, reducedMotion: 'reduce' | 'no-preference') {
  await page.emulateMedia({ reducedMotion, colorScheme: 'light' });
  await page.addInitScript(() => {
    localStorage.setItem(
      'rezo360_cookie_consent',
      JSON.stringify({ analytics: false, marketing: false, decidedAt: '2026-09-24T10:00:00Z' }),
    );
  });
  await page.goto('/');
  await expect(page.locator('#rezo360-style-boot')).toBeHidden();
  await expect(
    page.getByRole('heading', {
      name: 'Votre activité en mieux. Tout simplement.',
      level: 1,
    }),
  ).toBeVisible();
}

test.describe('Landing — narration et mesures de laboratoire', () => {
  test('les écrans changent à la demande sans déplacement forcé', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await openLanding(page, 'no-preference');
    await page.getByRole('link', { name: 'Explorer les écrans' }).click();
    const invoice = page.getByRole('button', { name: '04 Facture', exact: true });
    await invoice.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await invoice.click();
    await expect(invoice).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('img', { name: 'Interface réelle REZO360 — Facture', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(before, 0);
    await expect(page.locator('#produit')).not.toHaveClass(/lp-sequence--scroll/);
    await expect(page).toHaveURL(/#produit$/);
  });

  test('la démonstration vocale respecte pause, reprise et rejeu', async ({ page, isMobile }) => {
    test.setTimeout(45_000);
    await page.setViewportSize(
      isMobile ? { width: 390, height: 844 } : { width: 1440, height: 960 },
    );
    await openLanding(page, 'no-preference');

    const voice = page.locator('.ln-voice-stage');
    await page.locator('#voix').scrollIntoViewIfNeeded();
    await page
      .getByRole('button', { name: 'Rejouer la démonstration vocale', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Mettre en pause la démonstration vocale', exact: true })
      .click();
    await expect(voice).toHaveAttribute('data-running', 'false');
    const pausedStage = await voice.getAttribute('data-stage');
    // Cross the longest voice-frame interval to prove that pause stops its clock.
    await page.waitForTimeout(2100);
    await expect(voice).toHaveAttribute('data-stage', pausedStage ?? '0');
    await page
      .getByRole('button', { name: 'Reprendre la démonstration vocale', exact: true })
      .click();
    await expect(voice).toHaveAttribute('data-running', 'true');
    await expect
      .poll(() => voice.getAttribute('data-stage'), { timeout: 4000 })
      .not.toBe(pausedStage);
    await page
      .getByRole('button', { name: 'Rejouer la démonstration vocale', exact: true })
      .click();
    await expect(voice).toHaveAttribute('data-stage', '0');
    await page
      .getByRole('button', { name: 'Mettre en pause la démonstration vocale', exact: true })
      .click();
  });

  test('reduced motion garde les récits complets et aucune animation active', async ({ page }) => {
    await openLanding(page, 'reduce');
    await expect(page.locator('#produit')).not.toHaveClass(/lp-sequence--scroll/);
    await expect(page.locator('.ln-motion-note')).toHaveCount(1);
    await page.locator('#voix').scrollIntoViewIfNeeded();
    await expect(page.locator('.ln-voice-stage')).toHaveAttribute('data-stage', '4');
    await expect(page.locator('.ln-voice-stage')).toHaveAttribute('data-running', 'false');
    const runningAnimations = await page.locator('main').evaluate((element) =>
      element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === 'running' || animation.pending)
        .map((animation) => ({ state: animation.playState, pending: animation.pending })),
    );
    expect(runningAnimations).toEqual([]);
  });

  test('joint une mesure lab du chargement initial, distincte des CWV terrain', async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      const lab = {
        lcpMs: null as number | null,
        lcpElement: null as string | null,
        cls: 0,
        clsSession: 0,
        shiftStart: 0,
        lastShift: 0,
        supported: PerformanceObserver.supportedEntryTypes,
      };
      Object.defineProperty(window, '__rezoLandingLab', { value: lab });
      if (lab.supported.includes('largest-contentful-paint')) {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const candidate = entry as PerformanceEntry & { element?: Element };
            lab.lcpMs = candidate.startTime;
            lab.lcpElement = candidate.element?.tagName.toLowerCase() ?? null;
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      }
      if (lab.supported.includes('layout-shift')) {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
            if (shift.hadRecentInput) continue;
            if (shift.startTime - lab.lastShift > 1000 || shift.startTime - lab.shiftStart > 5000) {
              lab.clsSession = shift.value;
              lab.shiftStart = shift.startTime;
            } else lab.clsSession += shift.value;
            lab.lastShift = shift.startTime;
            lab.cls = Math.max(lab.cls, lab.clsSession);
          }
        }).observe({ type: 'layout-shift', buffered: true });
      }
    });
    await openLanding(page, 'no-preference');
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    // A fixed, bounded observation window; no interaction or full-page scrolling.
    await page.waitForTimeout(1200);
    const measurement = await page.evaluate(() => {
      const state = (
        window as unknown as {
          __rezoLandingLab: {
            lcpMs: number | null;
            lcpElement: string | null;
            cls: number;
            supported: string[];
          };
        }
      ).__rezoLandingLab;
      const navigation = performance.getEntriesByType('navigation')[0] as
        PerformanceNavigationTiming | undefined;
      const resources = (
        performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      ).map((resource) => ({
        path: new URL(resource.name).pathname,
        type: resource.initiatorType,
        transferBytes: resource.transferSize,
        encodedBytes: resource.encodedBodySize,
        durationMs: Number(resource.duration.toFixed(1)),
      }));
      return {
        measuredAt: new Date().toISOString(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          dpr: window.devicePixelRatio,
        },
        observationMs: Number(performance.now().toFixed(1)),
        lcpMs: state.lcpMs === null ? null : Number(state.lcpMs.toFixed(1)),
        lcpElement: state.lcpElement,
        clsObserved: Number(state.cls.toFixed(5)),
        navigation: navigation
          ? {
              responseStartMs: navigation.responseStart,
              domContentLoadedMs: navigation.domContentLoadedEventEnd,
              loadMs: navigation.loadEventEnd,
              transferBytes: navigation.transferSize,
            }
          : null,
        resourceCount: resources.length,
        transferredResourceBytes: resources.reduce(
          (sum, resource) => sum + resource.transferBytes,
          0,
        ),
        resources,
      };
    });
    const reportPath = testInfo.outputPath('landing-initial-load-lab.json');
    await writeFile(
      reportPath,
      JSON.stringify(
        {
          context:
            'Local production browser run; initial viewport only; no CPU/network throttling. These observations are not field Core Web Vitals, a percentile, or an INP measurement.',
          project: testInfo.project.name,
          ...measurement,
        },
        null,
        2,
      ),
      'utf8',
    );
    await testInfo.attach('landing-initial-load-lab.json', {
      path: reportPath,
      contentType: 'application/json',
    });
    expect(measurement.resourceCount).toBeGreaterThan(0);
    expect(measurement.navigation?.responseStartMs).toBeGreaterThan(0);
    expect(measurement.lcpMs).not.toBeNull();
    expect(measurement.clsObserved).toBeGreaterThanOrEqual(0);
  });
});

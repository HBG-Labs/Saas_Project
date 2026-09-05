import { mkdirSync } from 'node:fs';

import { chromium } from '@playwright/test';

const baseUrl =
  process.argv.find((argument) => argument.startsWith('--url='))?.slice(6) ??
  'http://127.0.0.1:5173';
const outputDirectory = 'test-results/marketing-redesign';

const routes = [
  { name: 'landing', path: '/' },
  { name: 'pricing', path: '/pricing' },
];
const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 800 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
];
const themes = [
  { name: 'light', preset: 'default' },
  { name: 'dark', preset: 'atelier-nuit' },
];

mkdirSync(outputDirectory, { recursive: true });

const browser = await chromium.launch();
const issues = [];

for (const theme of themes) {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: theme.name,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });

    await context.addInitScript(({ preset, mode }) => {
      localStorage.setItem('rezo360-theme-preset', preset);
      localStorage.setItem('rezo360-theme', mode);
      localStorage.setItem(
        'rezo360_cookie_consent',
        JSON.stringify({ necessary: true, analytics: false, marketing: false }),
      );
    }, { preset: theme.preset, mode: theme.name });

    const page = await context.newPage();

    for (const route of routes) {
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      await page.locator('h1').waitFor({ state: 'visible', timeout: 10_000 });
      await page.waitForTimeout(250);

      const audit = await page.evaluate(() => {
        const root = document.documentElement;
        const headings = [...document.querySelectorAll('h1')].map((heading) =>
          heading.textContent?.trim(),
        );
        const interactiveElements = [...document.querySelectorAll('button, a[href]')].filter(
          (element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              !element.classList.contains('sr-only') &&
              rect.width > 0 &&
              rect.bottom > 0 &&
              rect.top < innerHeight
            );
          },
        );
        const smallTargets = interactiveElements
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              label: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 48),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            };
          })
          .filter((target) => target.width < 40 || target.height < 40);

        return {
          h1Count: headings.length,
          headings,
          horizontalOverflow: Math.max(document.body.scrollWidth, root.clientWidth) - root.clientWidth,
          theme: root.classList.contains('dark') ? 'dark' : 'light',
          smallTargets,
        };
      });

      const label = `${route.name}/${theme.name}/${viewport.name}`;
      if (audit.h1Count !== 1) issues.push(`${label}: ${audit.h1Count} titres h1`);
      if (audit.horizontalOverflow > 1) {
        issues.push(`${label}: débordement horizontal de ${audit.horizontalOverflow}px`);
      }
      if (audit.theme !== theme.name) {
        issues.push(`${label}: thème ${audit.theme} au lieu de ${theme.name}`);
      }
      if (viewport.width === 390 && audit.smallTargets.length > 0) {
        issues.push(
          `${label}: cibles inférieures à 40px — ${audit.smallTargets
            .slice(0, 5)
            .map((target) => `${target.label} (${target.width}×${target.height})`)
            .join(', ')}`,
        );
      }

      await page.screenshot({
        path: `${outputDirectory}/${route.name}-${theme.name}-${viewport.name}.png`,
        fullPage: false,
      });

      if (theme.name === 'light' && ['1440', '390'].includes(viewport.name)) {
        await page.screenshot({
          path: `${outputDirectory}/${route.name}-${viewport.name}-full.png`,
          fullPage: true,
        });
      }
    }

    await context.close();
  }
}

await browser.close();

if (issues.length > 0) {
  console.error('Audit marketing en échec :');
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exitCode = 1;
} else {
  console.log('Audit marketing réussi : 16 vues, sans débordement ni défaut structurel.');
}

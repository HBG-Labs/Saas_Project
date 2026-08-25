import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\ae06da70-5b5e-4c43-b275-5dd5271d65ba';

async function testVisibleBg() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1200 });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 8000 }).catch(async () => {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 8000 });
  });

  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });

  // Test Bento Section with clearly visible image (opacity 0.55) and subtle gradient
  await page.evaluate(() => {
    const bentoSec = document.querySelector('section:has(img[src*="cockpit-supervision-ambient"])');
    if (bentoSec) {
      const overlayWrapper = bentoSec.children[0];
      if (overlayWrapper) {
        overlayWrapper.innerHTML = `
          <img src="/images/backgrounds/cockpit-supervision-ambient.jpg" alt="" aria-hidden="true" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transform: translateY(-360px); opacity: 0.55; filter: saturate(1.15) contrast(1.08);" />
          <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(6,10,18,0.75) 0%, rgba(6,10,18,0.2) 25%, rgba(6,10,18,0.25) 75%, rgba(6,10,18,0.85) 100%);"></div>
        `;
      }
    }
  });

  await page.waitForTimeout(300);

  const bentoSection = await page.$('section:has(img[src*="cockpit-supervision-ambient"])');
  if (bentoSection) {
    await bentoSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const bentoOut = path.join(artifactsDir, 'bento_clearly_visible_bg.png');
    await bentoSection.screenshot({ path: bentoOut });
    console.log('Saved visible bento to:', bentoOut);
  }

  // Test Playground Section with clearly visible image
  await page.evaluate(() => {
    const pgSec = document.querySelector('section:has(img[src*="industrial-inspection-ambient"])');
    if (pgSec) {
      const overlayWrapper = pgSec.children[0];
      if (overlayWrapper) {
        overlayWrapper.innerHTML = `
          <img src="/images/backgrounds/industrial-inspection-ambient.jpg" alt="" aria-hidden="true" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transform: translateY(-260px); opacity: 0.5; filter: saturate(1.15) contrast(1.08);" />
          <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(7,11,20,0.75) 0%, rgba(7,11,20,0.2) 25%, rgba(7,11,20,0.25) 75%, rgba(7,11,20,0.85) 100%);"></div>
        `;
      }
    }
  });

  await page.waitForTimeout(300);

  const pgSection = await page.$('section:has(img[src*="industrial-inspection-ambient"])');
  if (pgSection) {
    await pgSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const pgOut = path.join(artifactsDir, 'playground_clearly_visible_bg.png');
    await pgSection.screenshot({ path: pgOut });
    console.log('Saved visible playground to:', pgOut);
  }

  await browser.close();
}

testVisibleBg().catch(console.error);

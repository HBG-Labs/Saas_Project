import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\ae06da70-5b5e-4c43-b275-5dd5271d65ba';

async function testBentoFade() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1200 });

  const urls = ['http://localhost:5174/', 'http://localhost:5173/'];
  let loaded = false;
  for (const u of urls) {
    try {
      await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 6000 });
      loaded = true;
      console.log('Successfully connected to:', u);
      break;
    } catch (e) {
      console.log('Failed to connect to:', u, e.message);
    }
  }

  if (!loaded) {
    console.error('Could not connect to dev server');
    await browser.close();
    return;
  }

  await page.waitForTimeout(500);

  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });

  // Apply the same fade technique as Hero (vertical gradient to solid + radial gradient ellipse)
  await page.evaluate(() => {
    const bentoSec = document.querySelector('section:has(img[src*="cockpit-supervision-ambient"])');
    if (bentoSec) {
      const overlayWrapper = bentoSec.children[0];
      if (overlayWrapper) {
        overlayWrapper.innerHTML = `
          <img src="/images/backgrounds/cockpit-supervision-ambient.jpg" alt="" aria-hidden="true" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transform: translateY(-360px); opacity: 0.55; filter: saturate(1.15) contrast(1.05);" />
          <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(6,10,18,0.7) 0%, rgba(6,10,18,0.2) 25%, rgba(6,10,18,0.65) 55%, rgba(6,10,18,1) 80%, rgba(6,10,18,1) 100%);"></div>
          <div style="position: absolute; inset: 0; background: radial-gradient(ellipse 85% 65% at 50% 25%, transparent 20%, #060a12 92%); opacity: 0.7;"></div>
        `;
      }
    }
  });

  await page.waitForTimeout(400);

  const bentoSection = await page.$('section:has(img[src*="cockpit-supervision-ambient"])');
  if (bentoSection) {
    await bentoSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const bentoOut = path.join(artifactsDir, 'bento_bottom_fade_preview.png');
    await bentoSection.screenshot({ path: bentoOut });
    console.log('Saved bento bottom fade preview to:', bentoOut);
  }

  await browser.close();
}

testBentoFade().catch(console.error);

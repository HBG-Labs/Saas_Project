import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\ae06da70-5b5e-4c43-b275-5dd5271d65ba';

async function captureBentoFadeResult() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1200 });

  const urls = ['http://localhost:5173/', 'http://localhost:5174/'];
  for (const u of urls) {
    try {
      await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 5000 });
      break;
    } catch {
      // try next
    }
  }

  await page.waitForTimeout(600);

  const bentoSection = await page.$('section:has(img[src*="cockpit-supervision-ambient"])');
  if (bentoSection) {
    await bentoSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const bentoOut = path.join(artifactsDir, 'bento_bottom_fade_result.png');
    await bentoSection.screenshot({ path: bentoOut });
    console.log('Saved bento fade result screenshot to:', bentoOut);
  }

  await browser.close();
}

captureBentoFadeResult().catch(console.error);

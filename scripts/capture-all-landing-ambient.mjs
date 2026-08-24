import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\ae06da70-5b5e-4c43-b275-5dd5271d65ba';

async function captureLandingPreviews() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1200 });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 8000 }).catch(async () => {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 8000 });
  });

  await page.waitForTimeout(500);

  // 1. Capture Hero
  const heroSection = await page.$('section:has(img[src*="hero-field-ambient"])');
  if (heroSection) {
    const heroPath = path.join(artifactsDir, 'ambient_hero_bg_preview.png');
    await heroSection.screenshot({ path: heroPath });
    console.log('Saved hero preview to:', heroPath);
  }

  // 2. Capture Bento Section
  const bentoSection = await page.$('section:has(img[src*="cockpit-supervision-ambient"])');
  if (bentoSection) {
    await bentoSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const bentoPath = path.join(artifactsDir, 'ambient_bento_bg_preview.png');
    await bentoSection.screenshot({ path: bentoPath });
    console.log('Saved bento preview to:', bentoPath);
  }

  await browser.close();
}

captureLandingPreviews().catch(console.error);

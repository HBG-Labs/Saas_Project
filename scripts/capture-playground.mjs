import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\ae06da70-5b5e-4c43-b275-5dd5271d65ba';

async function capturePlayground() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1200 });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 8000 }).catch(async () => {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 8000 });
  });

  await page.waitForTimeout(300);

  const pgSection = await page.$('section:has(img[src*="industrial-inspection-ambient"])');
  if (pgSection) {
    await pgSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const pgPath = path.join(artifactsDir, 'ambient_playground_bg_preview.png');
    await pgSection.screenshot({ path: pgPath });
    console.log('Saved playground preview to:', pgPath);
  }

  await browser.close();
}

capturePlayground().catch(console.error);

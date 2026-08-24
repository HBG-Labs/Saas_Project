import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function captureHeroAndBentoBg() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Navigate to local dev server (port 5173 or 4173)
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 6000 });
  } catch {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 6000 }).catch(() => {});
  }

  // Dark mode
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  await page.waitForTimeout(500);

  // Screenshot top Hero with ambient background
  const heroPath = path.join(artifactsDir, 'ambient_hero_bg_preview.png');
  await page.screenshot({ path: heroPath, clip: { x: 0, y: 0, width: 1440, height: 980 } });
  console.log('Saved hero ambient preview to:', heroPath);

  // Full page preview
  const fullPath = path.join(artifactsDir, 'ambient_landing_full_preview.png');
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log('Saved full page preview to:', fullPath);

  await browser.close();
}

captureHeroAndBentoBg().catch(console.error);

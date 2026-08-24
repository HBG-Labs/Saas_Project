import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function testPreciseTranslation() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 950 });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 8000 }).catch(async () => {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 8000 });
  });

  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });

  const shifts = [140, 160, 180, 200];

  for (const s of shifts) {
    await page.evaluate((val) => {
      const img = document.querySelector('section img[src*="hero-field-ambient"]');
      if (img) {
        img.removeAttribute('class');
        img.setAttribute('style', `position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transform: translateY(-${val}px); opacity: 0.5; filter: saturate(1.1) contrast(1.05);`);
      }
    }, s);

    await page.waitForTimeout(200);
    const outPath = path.join(artifactsDir, `test_exact_shift_${s}px.png`);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1440, height: 950 } });
    console.log(`Saved ${s}px to:`, outPath);
  }

  await browser.close();
}

testPreciseTranslation().catch(console.error);

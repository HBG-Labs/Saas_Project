import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function testPureTranslationNoZoom() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 950 });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 8000 }).catch(async () => {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 8000 });
  });

  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });

  // Pure shift / object-position with NO zoom (size-full, 100% height, strictly 1.0 scale)
  const variants = [
    {
      name: 'obj_pos_70pct',
      style: 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 70%; opacity: 0.5; filter: saturate(1.1) contrast(1.05);',
    },
    {
      name: 'obj_pos_80pct',
      style: 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 80%; opacity: 0.5; filter: saturate(1.1) contrast(1.05);',
    },
    {
      name: 'obj_pos_90pct',
      style: 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 90%; opacity: 0.5; filter: saturate(1.1) contrast(1.05);',
    },
    {
      name: 'obj_pos_bottom',
      style: 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center bottom; opacity: 0.5; filter: saturate(1.1) contrast(1.05);',
    },
    {
      name: 'translate_y_minus_120',
      style: 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transform: translateY(-120px); opacity: 0.5; filter: saturate(1.1) contrast(1.05);',
    },
    {
      name: 'translate_y_minus_180',
      style: 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transform: translateY(-180px); opacity: 0.5; filter: saturate(1.1) contrast(1.05);',
    },
  ];

  for (const v of variants) {
    await page.evaluate((st) => {
      const img = document.querySelector('section img[src*="hero-field-ambient"]');
      if (img) {
        img.removeAttribute('class');
        img.setAttribute('style', st);
      }
    }, v.style);

    await page.waitForTimeout(300);
    const outPath = path.join(artifactsDir, `test_nozoom_${v.name}.png`);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1440, height: 950 } });
    console.log(`Saved ${v.name} to:`, outPath);
  }

  await browser.close();
}

testPureTranslationNoZoom().catch(console.error);

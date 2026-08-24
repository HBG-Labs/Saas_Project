import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\ae06da70-5b5e-4c43-b275-5dd5271d65ba';

async function testHeroVariations() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 950 });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 8000 }).catch(async () => {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 8000 });
  });

  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });

  const variations = [
    {
      id: 'opt1_obj_bottom',
      desc: 'object-position: center bottom (no zoom, anchored bottom)',
      apply: (img) => {
        img.removeAttribute('class');
        img.setAttribute('style', 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center bottom; opacity: 0.5; filter: saturate(1.1) contrast(1.05);');
      }
    },
    {
      id: 'opt2_obj_85pct',
      desc: 'object-position: center 85% (no zoom)',
      apply: (img) => {
        img.removeAttribute('class');
        img.setAttribute('style', 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 85%; opacity: 0.5; filter: saturate(1.1) contrast(1.05);');
      }
    },
    {
      id: 'opt3_translate_minus_150',
      desc: 'translateY(-150px) (pure shift up, no zoom)',
      apply: (img) => {
        img.removeAttribute('class');
        img.setAttribute('style', 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transform: translateY(-150px); opacity: 0.5; filter: saturate(1.1) contrast(1.05);');
      }
    },
    {
      id: 'opt4_translate_minus_220',
      desc: 'translateY(-220px) (pure shift up further, no zoom)',
      apply: (img) => {
        img.removeAttribute('class');
        img.setAttribute('style', 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transform: translateY(-220px); opacity: 0.5; filter: saturate(1.1) contrast(1.05);');
      }
    },
    {
      id: 'opt5_translate_minus_280',
      desc: 'translateY(-280px) (pure shift up high, no zoom)',
      apply: (img) => {
        img.removeAttribute('class');
        img.setAttribute('style', 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transform: translateY(-280px); opacity: 0.5; filter: saturate(1.1) contrast(1.05);');
      }
    }
  ];

  for (const v of variations) {
    await page.evaluate((fnStr) => {
      const img = document.querySelector('section img[src*="hero-field-ambient"]');
      if (img) {
        const applyFn = new Function('img', fnStr);
        applyFn(img);
      }
    }, `(${v.apply.toString()})(img)`);

    await page.waitForTimeout(200);
    const outPath = path.join(artifactsDir, `${v.id}.png`);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1440, height: 950 } });
    console.log(`Saved ${v.id} to: ${outPath}`);
  }

  await browser.close();
}

testHeroVariations().catch(console.error);

import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\ae06da70-5b5e-4c43-b275-5dd5271d65ba';

async function testBentoPrecise() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1200 });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 8000 }).catch(async () => {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 8000 });
  });

  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });

  const shifts = [240, 280, 320, 360, 400];

  for (const s of shifts) {
    await page.evaluate((val) => {
      const img = document.querySelector('section img[src*="cockpit-supervision-ambient"]');
      if (img) {
        img.removeAttribute('class');
        img.setAttribute('style', `position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transform: translateY(-${val}px); opacity: 0.4; filter: saturate(1.1) contrast(1.05);`);
      }
    }, s);

    // Scroll so that Bento section is fully visible under header
    await page.evaluate(() => {
      const sec = document.querySelector('section:has(img[src*="cockpit-supervision-ambient"])');
      if (sec) {
        const top = sec.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo(0, top);
      }
    });

    await page.waitForTimeout(200);

    const outPath = path.join(artifactsDir, `bento_exact_${s}px.png`);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 70, width: 1440, height: 950 } });
    console.log(`Saved bento exact ${s}px to:`, outPath);
  }

  await browser.close();
}

testBentoPrecise().catch(console.error);

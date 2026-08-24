import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\ae06da70-5b5e-4c43-b275-5dd5271d65ba';

async function testBentoResponsive() {
  const browser = await chromium.launch({ headless: true });
  
  const viewports = [
    { name: 'desktop', width: 1440, height: 1200, shift: 360 },
    { name: 'laptop', width: 1024, height: 1000, shift: 260 },
    { name: 'tablet', width: 768, height: 1024, shift: 160 },
    { name: 'mobile', width: 390, height: 844, shift: 80 }
  ];

  for (const vp of viewports) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 8000 }).catch(async () => {
      await page.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 8000 });
    });

    await page.evaluate((val) => {
      document.documentElement.classList.add('dark');
      const img = document.querySelector('section img[src*="cockpit-supervision-ambient"]');
      if (img) {
        img.removeAttribute('class');
        img.setAttribute('style', `position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; transform: translateY(-${val}px); opacity: 0.4; filter: saturate(1.1) contrast(1.05);`);
      }
    }, vp.shift);

    await page.evaluate(() => {
      const sec = document.querySelector('section:has(img[src*="cockpit-supervision-ambient"])');
      if (sec) {
        const top = sec.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo(0, top);
      }
    });

    await page.waitForTimeout(250);

    const outPath = path.join(artifactsDir, `bento_resp_${vp.name}.png`);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 70, width: vp.width, height: Math.min(vp.height, 950) } });
    console.log(`Saved bento responsive ${vp.name} to:`, outPath);
    await page.close();
  }

  await browser.close();
}

testBentoResponsive().catch(console.error);

import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\ae06da70-5b5e-4c43-b275-5dd5271d65ba';

async function testResponsiveNoZoom() {
  const browser = await chromium.launch({ headless: true });
  
  const viewports = [
    { name: 'desktop', width: 1440, height: 950 },
    { name: 'laptop', width: 1024, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 8000 }).catch(async () => {
      await page.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 8000 });
    });

    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      const img = document.querySelector('section img[src*="hero-field-ambient"]');
      if (img) {
        img.removeAttribute('class');
        img.setAttribute('style', 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center bottom; opacity: 0.45; filter: saturate(1.1) contrast(1.05);');
      }
    });

    await page.waitForTimeout(250);
    const outPath = path.join(artifactsDir, `responsive_${vp.name}_bottom.png`);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, 950) } });
    console.log(`Saved ${vp.name} to: ${outPath}`);
    await page.close();
  }

  await browser.close();
}

testResponsiveNoZoom().catch(console.error);

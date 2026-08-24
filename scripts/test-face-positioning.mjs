import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function testFacePositioning() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 950 });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 8000 }).catch(async () => {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 8000 });
  });

  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });

  const offsets = [
    { name: 'shift_up_150px', className: 'absolute inset-x-0 -top-[150px] h-[calc(100%+250px)] w-full object-cover object-center' },
    { name: 'shift_up_220px', className: 'absolute inset-x-0 -top-[220px] h-[calc(100%+350px)] w-full object-cover object-center' },
    { name: 'shift_up_280px', className: 'absolute inset-x-0 -top-[280px] h-[calc(100%+400px)] w-full object-cover object-center' },
    { name: 'object_bottom', className: 'absolute inset-0 size-full object-cover object-bottom' },
    { name: 'object_65pct', className: 'absolute inset-0 size-full object-cover object-[center_65%]' },
  ];

  for (const off of offsets) {
    await page.evaluate((cls) => {
      const img = document.querySelector('section img[src*="hero-field-ambient"]');
      if (img) {
        img.className = `${cls} opacity-45 dark:opacity-60 filter saturate-110 contrast-105`;
      }
    }, off.className);

    await page.waitForTimeout(300);
    const outPath = path.join(artifactsDir, `test_face_${off.name}.png`);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1440, height: 950 } });
    console.log(`Saved ${off.name} to:`, outPath);
  }

  await browser.close();
}

testFacePositioning().catch(console.error);

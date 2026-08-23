import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function preview() {
  const browser = await chromium.launch({ headless: true });
  // iPhone 14 Pro viewport (393 x 852)
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();
  
  // Set mock authenticated local storage state
  await page.addInitScript(() => {
    localStorage.setItem('rezo360_theme', 'dark');
  });

  await page.goto('http://localhost:5173/missions', { waitUntil: 'networkidle' }).catch(() => {});
  
  // If not running, let's just make sure
  await page.screenshot({ path: path.join(__dirname, '../src/preview-missions-mobile.png') }).catch(() => {});

  await browser.close();
}

preview().catch(console.error);

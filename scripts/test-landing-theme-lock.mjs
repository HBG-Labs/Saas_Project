import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\ae06da70-5b5e-4c43-b275-5dd5271d65ba';

async function testLandingThemeLock() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 950 });

  // 1. Visit Landing Page
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 8000 }).catch(async () => {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 8000 });
  });

  const landingThemeButton = await page.$('header button[aria-label="Changer de thème"]');
  const isHtmlDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  
  console.log('Landing page has theme toggle in header:', !!landingThemeButton);
  console.log('Landing page has dark class on html:', isHtmlDark);

  const landingScreenshot = path.join(artifactsDir, 'landing_locked_dark_no_toggle.png');
  await page.screenshot({ path: landingScreenshot, clip: { x: 0, y: 0, width: 1440, height: 950 } });
  console.log('Saved landing screenshot:', landingScreenshot);

  // 2. Navigate to Pricing Page (/pricing)
  await page.goto('http://localhost:5173/pricing', { waitUntil: 'networkidle', timeout: 8000 }).catch(async () => {
    await page.goto('http://localhost:4173/pricing', { waitUntil: 'networkidle', timeout: 8000 });
  });

  const pricingThemeButton = await page.$('header button[aria-label="Changer de thème"]');
  console.log('Pricing page has theme toggle in header:', !!pricingThemeButton);

  const pricingScreenshot = path.join(artifactsDir, 'pricing_with_theme_toggle.png');
  await page.screenshot({ path: pricingScreenshot, clip: { x: 0, y: 0, width: 1440, height: 950 } });
  console.log('Saved pricing screenshot:', pricingScreenshot);

  // 3. Navigate to Tools Page (/tools)
  await page.goto('http://localhost:5173/tools', { waitUntil: 'networkidle', timeout: 8000 }).catch(async () => {
    await page.goto('http://localhost:4173/tools', { waitUntil: 'networkidle', timeout: 8000 });
  });

  const toolsThemeButton = await page.$('header button[aria-label="Changer de thème"]');
  console.log('Tools page has theme toggle in header:', !!toolsThemeButton);

  await browser.close();
}

testLandingThemeLock().catch(console.error);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';
const rootDir = path.resolve(__dirname, '..');
const svgPath = path.join(rootDir, 'public', 'favicon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

async function previewNav() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 600, height: 400 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #080c16; color: #ffffff; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 24px; }
          .header-preview { background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 12px 20px; display: flex; align-items: center; gap: 12px; width: 340px; }
          .icon-box { width: 32px; height: 32px; flex-shrink: 0; border-radius: 8px; overflow: hidden; }
          .brand-text { font-size: 18px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; }
          .brand-accent { color: #3b82f6; }
          .large-box { width: 140px; height: 140px; }
        </style>
      </head>
      <body>
        <div class="large-box">${svgContent}</div>
        <div class="header-preview">
          <div class="icon-box">${svgContent}</div>
          <div class="brand-text">REZO<span class="brand-accent">360</span></div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'current_bold_r_logo.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved preview to:', outPath);
  await browser.close();
}

previewNav().catch(console.error);

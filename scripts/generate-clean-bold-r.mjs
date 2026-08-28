import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

// Tracé vectoriel d'un R BOLD moderne, puissant et équilibré
// Carré 512x512, squircle bleu roi avec dégradé subtil, R blanc épais et lisible.
const svgBoldR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="rezoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
  </defs>

  <!-- Fond Squircle PWA iOS / Android -->
  <rect width="512" height="512" rx="120" fill="url(#rezoGrad)" />

  <!-- R BOLD Typographique Pur & Impactant Centré -->
  <path
    fill="#ffffff"
    d="M 116 96
       L 280 96
       C 358 96 404 138 404 212
       C 404 266 364 306 308 318
       L 406 416
       L 306 416
       L 218 328
       L 204 328
       L 204 416
       L 116 416
       Z
       M 204 168
       L 204 256
       L 268 256
       C 304 256 324 240 324 212
       C 324 184 304 168 268 168
       Z"
  />
</svg>
`;

async function main() {
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgBoldR.trim(), 'utf8');
  console.log('Saved public/favicon.svg');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const sizes = [
    { name: 'icon-512.png', size: 512 },
    { name: 'icon-192.png', size: 192 },
    { name: 'apple-touch-icon.png', size: 180 },
  ];

  for (const { name, size } of sizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
            svg { width: 100%; height: 100%; display: block; }
          </style>
        </head>
        <body>
          ${svgBoldR}
        </body>
      </html>
    `);

    const outPath = path.join(publicDir, name);
    await page.screenshot({
      path: outPath,
      omitBackground: true,
      type: 'png',
    });
    console.log(`Generated ${name} (${size}x${size})`);
  }

  // Générer aussi un mockup mobile pour voir le rendu sur smartphone
  await page.setViewportSize({ width: 400, height: 750 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, sans-serif; }
          body { width: 100%; height: 100%; background: #070b14; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .icon { width: 180px; height: 180px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); border-radius: 42px; }
          .title { margin-top: 30px; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; }
          .title span { color: #3b82f6; }
        </style>
      </head>
      <body>
        <div class="icon">${svgBoldR}</div>
        <div class="title">REZO<span>360</span></div>
      </body>
    </html>
  `);

  const previewPath = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\95991fa5-a6e0-4c8b-bd4a-d617df670762\\new_mobile_bold_r_splash.png';
  await page.screenshot({ path: previewPath, type: 'png' });
  console.log('Saved mobile splash preview:', previewPath);

  await browser.close();
}

main().catch(console.error);

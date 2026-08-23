import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

// 1. Version Squircle Bleu Roi avec 'R' Bold Moderne Épuré
const boldR_Squircle = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
  </defs>
  
  <!-- Fond Squircle Moderne -->
  <rect width="512" height="512" rx="118" fill="url(#blueGrad)" />
  
  <!-- R Bold Simple, Épuré & Parfaitement Équilibré -->
  <path
    fill="#ffffff"
    d="M 144 104
       L 296 104
       C 370 104 416 142 416 214
       C 416 268 380 306 322 318
       L 424 408
       L 332 408
       L 242 326
       L 226 326
       L 226 408
       L 144 408
       Z
       M 226 174
       L 226 258
       L 286 258
       C 324 258 344 242 344 216
       C 344 190 324 174 286 174
       Z"
  />
</svg>
`;

// 2. Version Circulaire Simple (comme dans la capture)
const boldR_Circle = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="circleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
  </defs>
  
  <!-- Fond Rond Parfait -->
  <circle cx="256" cy="256" r="256" fill="url(#circleGrad)" />
  
  <!-- R Bold Simple -->
  <path
    fill="#ffffff"
    d="M 148 108
       L 294 108
       C 368 108 412 144 412 214
       C 412 266 378 304 320 316
       L 420 404
       L 330 404
       L 244 324
       L 228 324
       L 228 404
       L 148 404
       Z
       M 228 176
       L 228 256
       L 284 256
       C 322 256 342 240 342 216
       C 342 192 322 176 284 176
       Z"
  />
</svg>
`;

// 3. Version Typographique Puissante (Inter / Helvetica ExtraBold)
const boldR_ExtraBold = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" rx="118" fill="#2563eb" />
  <text
    x="50%"
    y="54%"
    dominant-baseline="central"
    text-anchor="middle"
    font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    font-size="340"
    font-weight="900"
    fill="#ffffff"
    letter-spacing="-0.04em"
  >R</text>
</svg>
`;

async function renderSimpleBold() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1100, height: 500 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #080c16; color: #ffffff; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
          h1 { font-size: 24px; font-weight: 800; margin-bottom: 6px; }
          p { color: #94a3b8; font-size: 14px; margin-bottom: 30px; }
          .grid { display: flex; gap: 30px; justify-content: center; }
          .card { background: #111827; border: 1px solid #1f2937; border-radius: 24px; padding: 24px; display: flex; flex-direction: column; align-items: center; width: 300px; }
          .preview { width: 160px; height: 160px; margin-bottom: 16px; }
          .title { font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 6px; text-align: center; }
          .desc { font-size: 12px; color: #64748b; text-align: center; line-height: 1.4; }
        </style>
      </head>
      <body>
        <h1>Options R Bold Simple</h1>
        <p>Monogramme épuré, net, lisible instantanément</p>
        <div class="grid">
          <div class="card">
            <div class="preview">${boldR_Squircle}</div>
            <div class="title">Modèle 1 : R Bold Géométrique (Squircle)</div>
            <div class="desc">Tracé vectoriel pur, angles arrondis standard PWA/iOS/Android.</div>
          </div>
          <div class="card">
            <div class="preview">${boldR_Circle}</div>
            <div class="title">Modèle 2 : R Bold Circulaire (Rond)</div>
            <div class="desc">Pastille ronde bleue classique avec R blanc centré.</div>
          </div>
          <div class="card">
            <div class="preview">${boldR_ExtraBold}</div>
            <div class="title">Modèle 3 : R ExtraBold Typographique</div>
            <div class="desc">Typographie système ultra-épaisse, simplicité maximale.</div>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'simple_bold_r_preview.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved preview to:', outPath);
  await browser.close();
}

renderSimpleBold().catch(console.error);

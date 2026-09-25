import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

/**
 * Aperçu social de la landing, reconstruit avec la police de marque et une
 * véritable capture du produit. Aucun service externe, aucun visuel généré.
 *
 * Après une mise à jour de la capture :
 *   node scripts/generate-og-image.mjs
 *
 * Sortie : public/og-image.jpg, 1200 × 630 pixels.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public', 'og-image.jpg');
const embed = (relativePath) => fs.readFileSync(path.join(root, relativePath)).toString('base64');

const archivo = embed(
  'node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2',
);
const plex = embed(
  'node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2',
);
const dashboard = embed('public/images/product/premium/dashboard.webp');
const icon = embed('public/icon-192.png');

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: Archivo;
    src: url(data:font/woff2;base64,${archivo}) format('woff2');
    font-weight: 100 900;
  }
  @font-face {
    font-family: Plex;
    src: url(data:font/woff2;base64,${plex}) format('woff2');
    font-weight: 100 700;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  body {
    position: relative;
    background: #f5f5f0;
    color: #172123;
    font-family: Archivo, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .brand {
    position: absolute; left: 64px; top: 48px;
    display: flex; align-items: center; gap: 10px;
    font-family: Plex, sans-serif; font-size: 29px;
    font-weight: 600; letter-spacing: -.8px;
  }
  .brand img { width: 33px; height: 33px; border-radius: 8px; }
  .brand span span { color: #1b44c8; }
  .copy { position: absolute; top: 154px; left: 64px; width: 500px; z-index: 2; }
  h1 {
    margin: 0; font-size: 67px; font-weight: 580;
    line-height: 1.035; letter-spacing: -3.6px;
  }
  h1 span { color: #1b44c8; }
  .description {
    margin: 27px 0 0; width: 400px; color: #536060;
    font-size: 20px; line-height: 1.5; font-weight: 400;
  }
  .signature {
    position: absolute; left: 64px; bottom: 45px;
    font-size: 13px; font-weight: 550; color: #536060;
    letter-spacing: .025em;
  }
  .product {
    position: absolute; left: 595px; top: 130px; width: 710px;
    border: 1px solid #dce1df; border-radius: 13px;
    overflow: hidden; background: white;
    transform: rotate(-2deg); transform-origin: 50% 50%;
    box-shadow: 0 28px 55px -24px #14273a3b, 0 4px 12px -5px #14273a1c;
  }
  .product-label {
    display: flex; align-items: center; gap: 20px;
    height: 34px; padding: 0 16px; border-bottom: 1px solid #e5e9e7;
    color: #62706e; font-size: 10px; font-weight: 500;
    letter-spacing: .03em;
  }
  .product-label strong { font-weight: 600; color: #172123; }
  .product img { display: block; width: 100%; height: auto; }
  .universes {
    position: absolute; top: 58px; right: 64px;
    color: #657073; font-size: 11px; font-weight: 550;
    letter-spacing: .12em;
  }
</style>
</head>
<body>
  <div class="brand">
    <img src="data:image/png;base64,${icon}" alt="" />
    <span>REZO<span>360</span></span>
  </div>
  <div class="universes">GESTION &nbsp; · &nbsp; WORKSPACE &nbsp; · &nbsp; FINANCE</div>
  <main class="copy">
    <h1>Votre activité<br />en mieux.<br /><span>Tout simplement.</span></h1>
    <p class="description">L’activité des entreprises de terrain,<br />réunie au même endroit.</p>
  </main>
  <figure class="product">
    <div class="product-label"><strong>REZO360</strong><span>Votre activité, en un regard</span></div>
    <img src="data:image/webp;base64,${dashboard}" alt="Tableau de bord REZO360" />
  </figure>
  <div class="signature">rezo360.com</div>
</body>
</html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
  });
  await page.screenshot({ path: output, type: 'jpeg', quality: 88 });
} finally {
  await browser.close();
}

const bytes = fs.statSync(output).size;
console.log(`og-image.jpg — 1200 × 630, ${(bytes / 1024).toFixed(0)} Ko`);

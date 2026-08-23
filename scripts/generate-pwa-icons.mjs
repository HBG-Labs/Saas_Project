import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

async function generateIcons() {
  const svgPath = path.join(publicDir, 'favicon.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');

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
          ${svgContent}
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

  await browser.close();
  console.log('All PWA and touch icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});

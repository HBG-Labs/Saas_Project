import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function cropDevices() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 723, height: 1024 });

  const inputImagePath = 'C:/Users/HBZ/.gemini/antigravity-ide/brain/18d27ded-a879-4810-ba07-6f468bca047b/.user_uploaded/media_1788363723574.jpg';
  const base64 = fs.readFileSync(inputImagePath).toString('base64');

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body style="margin:0; padding:0; background:transparent;">
        <img id="img" src="data:image/jpeg;base64,${base64}" style="display:block;" />
      </body>
    </html>
  `);

  // Laptop + phone area: x: 336, y: 84, width: 387, height: 442
  await page.screenshot({
    path: 'public/images/devices-cropped.png',
    clip: { x: 336, y: 84, width: 387, height: 442 },
    omitBackground: true
  });

  console.log('✅ Devices cropped successfully!');
  await browser.close();
}

cropDevices().catch(console.error);

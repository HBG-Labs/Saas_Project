import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Use an installed sharp or the optional runtime path without adding a production dependency.
const require = createRequire(import.meta.url);
const sharp = require(process.env.LANDING_SHARP_PATH || 'sharp');
const source = resolve('artifacts/product-captures');
const target = resolve('public/images/product/premium');
mkdirSync(target, { recursive: true });
if (!existsSync(source)) throw new Error('Create authentic product captures first.');
for (const file of readdirSync(source).filter((name) => name.endsWith('.png'))) {
  const result = await sharp(resolve(source, file))
    .webp({ lossless: true, effort: 5 })
    .toFile(resolve(target, file.replace(/\.png$/, '.webp')));
  console.log(`${file}: ${result.width} × ${result.height}, ${Math.round(result.size / 1024)} KiB`);
}

import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require(process.env.LANDING_SHARP_PATH || 'sharp');
const [name] = process.argv.slice(2);
if (!/^[a-z-]+$/.test(name ?? '')) throw new Error('Provide a scene name.');
const source = resolve(`artifacts/higgsfield/${name}.png`);
for (const width of [800, 1800]) {
  const result = await sharp(source)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 86, effort: 6 })
    .toFile(`public/images/landing/${name}-${width}.webp`);
  console.log(
    `${name}-${width}: ${result.width}x${result.height}, ${Math.round(result.size / 1024)} KiB`,
  );
}

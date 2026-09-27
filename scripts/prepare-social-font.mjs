import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createFont } from 'fonteditor-core';

const weights = [700, 800];
const subsets = ['latin', 'latin-ext'];

for (const weight of weights) {
  for (const subset of subsets) {
    const source = `node_modules/@fontsource/archivo/files/archivo-${subset}-${weight}-normal.woff`;
    const target = `supabase/functions/social-image-generate/assets/archivo-${subset}-${weight}-normal.ttf`;
    const font = createFont(readFileSync(source), {
      type: 'woff',
      hinting: true,
      kerning: true,
      inflate: (bytes) => inflateSync(Buffer.from(bytes)),
    });
    const ttf = font.write({ type: 'ttf', hinting: true, kerning: true, toBuffer: true });
    writeFileSync(target, ttf);
    console.log(`${target} (${ttf.byteLength} bytes)`);
  }
}

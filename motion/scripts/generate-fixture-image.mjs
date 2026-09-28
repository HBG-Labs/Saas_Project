// Génère l'image de test neutre « lune » (ciel nocturne, lune en bas à droite),
// de façon procédurale et déterministe, avec l'ffmpeg-static du dépôt.
// Aucune source externe, aucun fournisseur : l'image est une fonction de (x, y).
//   node scripts/generate-fixture-image.mjs
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ffmpeg = path.resolve(root, '..', 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
const out = path.join(root, 'core', 'test-fixtures', 'assets', 'night_moon.png');

const W = 720;
const H = 1280;
const moon = { x: 460, y: 845, r: 155 };
const d = `hypot(X-${moon.x},Y-${moon.y})`;
const inMoon = `lt(${d},${moon.r})`;
// Relief : ondulations lentes et deux cratères.
const relief = `(18*sin(X/23)*sin(Y/31)-55*lt(hypot(X-410,Y-800),30)-38*lt(hypot(X-505,Y-890),40))`;
// Halo autour du disque, étoiles déterministes (hachage des coordonnées).
const halo = `70*exp(-pow((${d}-${moon.r})/55,2))*gt(${d},${moon.r})`;
const star = `230*eq(mod(X*7919+Y*104729,1499),7)*lt(Y,1180)`;
const channel = (base, sky, lunar) =>
  `if(${inMoon},${lunar}+${relief},${base}+${sky}*Y/${H}+${halo}+${star})`;
const expr = [
  `r='clip(${channel(8, 14, 212)},0,255)'`,
  `g='clip(${channel(11, 20, 206)},0,255)'`,
  `b='clip(${channel(26, 42, 190)},0,255)'`,
].join(':');

execFileSync(ffmpeg, [
  '-y',
  '-loglevel',
  'error',
  '-f',
  'lavfi',
  '-i',
  `color=c=black:s=${W}x${H}:d=1,format=rgb24`,
  '-vf',
  `geq=${expr}`,
  '-frames:v',
  '1',
  '-pix_fmt',
  'rgb24',
  out,
]);
console.log(out, createHash('sha256').update(readFileSync(out)).digest('hex'));

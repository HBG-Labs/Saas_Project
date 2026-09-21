import { spawn } from 'node:child_process';
import { access, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import { loadEnv } from 'vite';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const loaded = loadEnv('demo', root, '');
for (const [name, value] of Object.entries(loaded)) {
  if (process.env[name] === undefined) process.env[name] = value;
}

const outputRoot = path.resolve(root, 'demo-output');
const rawDirectory = path.join(outputRoot, 'raw');
const artifactDirectory = path.join(outputRoot, 'test-artifacts');
const businessVideo = path.join(rawDirectory, 'business.webm');
const portalVideo = path.join(rawDirectory, 'portal.webm');
const finalVideo = path.join(outputRoot, 'rezo360-demo.mp4');
const playwrightCli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');

function assertInsideWorkspace(target) {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Chemin de sortie hors du dépôt refusé : ${target}`);
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      env: options.env ?? process.env,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    if (options.capture) {
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
    }
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} a quitté avec le code ${code}.\n${stderr}`));
    });
  });
}

async function main() {
  for (const target of [outputRoot, rawDirectory, artifactDirectory, finalVideo]) {
    assertInsideWorkspace(target);
  }
  await mkdir(rawDirectory, { recursive: true });
  await Promise.all([
    rm(artifactDirectory, { recursive: true, force: true }),
    rm(businessVideo, { force: true }),
    rm(portalVideo, { force: true }),
    rm(finalVideo, { force: true }),
  ]);

  console.log('REZO360 — prévol démo commerciale');
  console.log(`Environnement : staging ${process.env.VITE_SUPABASE_URL ?? '(non défini)'}`);
  console.log(`Compte métier : ${process.env.DEMO_EMAIL ?? '(non défini)'}`);
  console.log('Données filmées : tenant HBG Labs fictif du staging uniquement.');
  console.log(
    'Mutations attendues : authentification Supabase uniquement ; toute écriture métier est bloquée.',
  );

  const childEnv = { ...process.env };
  delete childEnv.DEMO_DATABASE_URL;
  delete childEnv.DEMO_SUPABASE_SERVICE_ROLE_KEY;

  await access(playwrightCli);
  await run(process.execPath, [playwrightCli, 'test', '--config=playwright.demo.config.ts'], {
    env: childEnv,
  });

  if (!ffmpegPath) throw new Error('Le binaire FFmpeg épinglé est introuvable.');
  await Promise.all([
    access(ffmpegPath),
    access(ffprobe.path),
    access(businessVideo),
    access(portalVideo),
  ]);

  await run(ffmpegPath, [
    '-y',
    '-i',
    businessVideo,
    '-i',
    portalVideo,
    '-filter_complex',
    '[0:v:0][1:v:0]concat=n=2:v=1:a=0[outv]',
    '-map',
    '[outv]',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    finalVideo,
  ]);

  const probe = await run(
    ffprobe.path,
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height:format=duration',
      '-of',
      'json',
      finalVideo,
    ],
    { capture: true },
  );
  const metadata = JSON.parse(probe.stdout);
  const stream = metadata.streams?.[0];
  const duration = Number(metadata.format?.duration);
  if (stream?.width !== 1920 || stream?.height !== 1080) {
    throw new Error(
      `Résolution finale invalide : ${stream?.width ?? '?'}×${stream?.height ?? '?'}.`,
    );
  }
  if (!Number.isFinite(duration) || duration < 60 || duration > 90) {
    throw new Error(`Durée finale hors cible 60–90 s : ${duration.toFixed(2)} s.`);
  }

  console.log(`Démo prête : ${finalVideo}`);
  console.log(`Contrôle : 1920×1080, ${duration.toFixed(2)} s, H.264 CRF 18.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

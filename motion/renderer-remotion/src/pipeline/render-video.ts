import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { bundle } from '@remotion/bundler';
import { ensureBrowser, openBrowser, renderMedia, selectComposition } from '@remotion/renderer';

import type { RenderPlan } from '@motion-engine/core';

import type { CompositionAudio, FontSource, ImageSource, PlanVideoProps } from '../composition/types.ts';
import { COMPOSITION_ID, QC_PREFIX } from '../composition/types.ts';
import type { RenderProfile } from './profile.ts';
import { remotionBinary } from './toolchain.ts';

const execFileAsync = promisify(execFile);

const ENTRY = path.resolve(import.meta.dirname, '..', 'composition', 'index.ts');

let bundlePromise: Promise<{ location: string; ms: number }> | null = null;

/** Bundle de la composition, construit une fois par processus. */
export function bundleComposition(): Promise<{ location: string; ms: number }> {
  bundlePromise ??= (async () => {
    const started = performance.now();
    const location = await bundle({ entryPoint: ENTRY });
    return { location, ms: performance.now() - started };
  })();
  return bundlePromise;
}

export async function prepareBrowser(): Promise<{ path: string | null; ms: number }> {
  const started = performance.now();
  const status = await ensureBrowser();
  const browserPath = status.type === 'local-puppeteer-browser' || status.type === 'user-defined-path' ? status.path : null;
  return { path: browserPath, ms: performance.now() - started };
}

export interface ProbeResult {
  width: number;
  height: number;
  codec: string;
  pix_fmt: string;
  fps: string;
  frames: number;
  duration_s: number;
  audio_streams: number;
}

/** Contrôle du fichier produit avec le FFprobe embarqué par Remotion. */
export function probeVideo(file: string): ProbeResult {
  const out = execFileSync(
    remotionBinary('ffprobe'),
    ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate,nb_read_frames:format=duration', '-of', 'json', file],
    { encoding: 'utf8', windowsHide: true },
  );
  const data = JSON.parse(out) as {
    streams: { codec_type: string; codec_name: string; width?: number; height?: number; pix_fmt?: string; r_frame_rate?: string; nb_read_frames?: string }[];
    format: { duration: string };
  };
  const video = data.streams.find((s) => s.codec_type === 'video');
  if (!video) throw new Error(`Aucun flux vidéo dans ${file}`);
  return {
    width: video.width ?? 0,
    height: video.height ?? 0,
    codec: video.codec_name,
    pix_fmt: video.pix_fmt ?? '',
    fps: video.r_frame_rate ?? '',
    frames: Number(video.nb_read_frames ?? 0),
    duration_s: Number(data.format.duration),
    audio_streams: data.streams.filter((s) => s.codec_type === 'audio').length,
  };
}

const RENDER_PROCESS_NAMES = ['chrome-headless-shell', 'headless_shell', 'remotion', 'ffmpeg'];

/**
 * Mémoire résidente cumulée des processus de rendu, via les outils du système.
 * Mesure approximative (processus homonymes étrangers au rendu compris) ; null si indisponible.
 */
async function renderProcessesMemoryMb(): Promise<number | null> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true });
      let kb = 0;
      for (const line of stdout.split(/\r?\n/)) {
        const cols = line.split('","').map((c) => c.replaceAll('"', ''));
        const name = (cols[0] ?? '').toLowerCase();
        if (!RENDER_PROCESS_NAMES.some((n) => name.startsWith(n))) continue;
        kb += Number((cols[4] ?? '').replace(/[^0-9]/g, '')) || 0;
      }
      return kb / 1024;
    }
    const { stdout } = await execFileAsync('ps', ['-A', '-o', 'rss=,comm=']);
    let kb = 0;
    for (const line of stdout.split('\n')) {
      const match = /^\s*(\d+)\s+(.*)$/.exec(line);
      if (match && RENDER_PROCESS_NAMES.some((n) => path.basename(match[2] ?? '').startsWith(n))) kb += Number(match[1]);
    }
    return kb / 1024;
  } catch {
    return null;
  }
}

export interface RenderStats {
  bundle_ms: number;
  bundle_cached: boolean;
  browser_ms: number;
  render_ms: number;
  frames: number;
  frames_per_second: number;
  concurrency: number;
  cpu: { model: string; logical_cores: number };
  memory: {
    node_peak_rss_mb: number;
    /** Pic de la somme des processus de rendu (Chromium, compositeur, FFmpeg), échantillonné toutes les 500 ms. */
    render_processes_peak_mb: number | null;
    system_total_mb: number;
  };
  node_cpu_seconds: number;
  mp4_bytes: number;
  /** Empreinte du fichier : l'encodage n'est pas garanti identique au bit près entre deux rendus. */
  mp4_sha256: string;
  probe: ProbeResult;
  qc: string[];
}

const PROFILE_PREFIX = 'puppeteer_dev_chrome_profile-';
const profileDirs = () => new Set(readdirSync(os.tmpdir()).filter((name) => name.startsWith(PROFILE_PREFIX)));

/** Ouvre un navigateur et retrouve le profil temporaire créé pendant cette ouverture. */
async function openOwnBrowser(): Promise<{ browser: Awaited<ReturnType<typeof openBrowser>>; profileDirs: string[] }> {
  const before = profileDirs();
  const browser = await openBrowser('chrome', { logLevel: 'error' });
  const created = [...profileDirs()].filter((name) => !before.has(name));
  return { browser, profileDirs: created.map((name) => path.join(os.tmpdir(), name)) };
}

/** Suppression patiente : les verrous de fichiers de Chrome tombent peu après la fin du processus. */
export function removeProfiles(dirs: readonly string[]): void {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true, maxRetries: 40, retryDelay: 250 });
}

export interface RenderRequest {
  plan: RenderPlan;
  fonts: FontSource[];
  images: ImageSource[];
  audio: CompositionAudio | null;
  profile: RenderProfile;
  outputFile: string;
}

export async function renderPlanToMp4(request: RenderRequest): Promise<RenderStats> {
  const { plan, profile } = request;
  if (plan.canvas.width !== profile.width || plan.canvas.height !== profile.height || plan.canvas.fps !== profile.fps) {
    throw new Error('Le Render Plan a été compilé pour un autre profil de rendu.');
  }
  const wasCached = bundlePromise !== null;
  const bundled = await bundleComposition();
  const browser = await prepareBrowser();
  const inputProps: PlanVideoProps = { plan, fonts: request.fonts, images: request.images, audio: request.audio };

  const qc = new Set<string>();
  let peakRss = process.memoryUsage().rss;
  let peakRender: number | null = null;
  let sampling = false;
  const sampler = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
    if (sampling) return;
    sampling = true;
    void renderProcessesMemoryMb()
      .then((mb) => {
        if (mb !== null) peakRender = Math.max(peakRender ?? 0, mb);
      })
      .finally(() => {
        sampling = false;
      });
  }, 500);
  const cpuBefore = process.cpuUsage();
  const started = performance.now();
  // Un seul navigateur pour tout le rendu, fermé par nous, puis son profil
  // temporaire supprimé : sous Windows, Remotion tente la suppression pendant que
  // Chrome tient encore ses fichiers, et le profil (~56 Mo) reste dans le dossier temporaire.
  const own = await openOwnBrowser();
  try {
    const composition = await selectComposition({ serveUrl: bundled.location, id: COMPOSITION_ID, inputProps, logLevel: 'error', puppeteerInstance: own.browser });
    await renderMedia({
      puppeteerInstance: own.browser,
      composition,
      serveUrl: bundled.location,
      codec: profile.codec,
      crf: profile.crf,
      pixelFormat: profile.pixel_format,
      colorSpace: profile.color_space,
      concurrency: profile.concurrency,
      outputLocation: request.outputFile,
      inputProps,
      logLevel: 'error',
      // Aucune clé : Remotion n'envoie alors aucun événement d'usage.
      licenseKey: null,
      onBrowserLog: (log) => {
        if (log.text.includes(QC_PREFIX)) qc.add(log.text.slice(log.text.indexOf(QC_PREFIX) + QC_PREFIX.length).trim());
      },
    });
  } finally {
    clearInterval(sampler);
    await own.browser.close({ silent: true });
    removeProfiles(own.profileDirs);
  }
  const renderMs = performance.now() - started;
  const cpu = process.cpuUsage(cpuBefore);
  const cpus = os.cpus();
  return {
    bundle_ms: bundled.ms,
    bundle_cached: wasCached,
    browser_ms: browser.ms,
    render_ms: renderMs,
    frames: plan.canvas.duration_frames,
    frames_per_second: plan.canvas.duration_frames / (renderMs / 1000),
    concurrency: profile.concurrency,
    cpu: { model: cpus[0]?.model.trim() ?? 'inconnu', logical_cores: cpus.length },
    memory: {
      node_peak_rss_mb: peakRss / 2 ** 20,
      render_processes_peak_mb: peakRender,
      system_total_mb: os.totalmem() / 2 ** 20,
    },
    node_cpu_seconds: (cpu.user + cpu.system) / 1e6,
    mp4_bytes: statSync(request.outputFile).size,
    mp4_sha256: createHash('sha256').update(readFileSync(request.outputFile)).digest('hex'),
    probe: probeVideo(request.outputFile),
    qc: [...qc].sort(),
  };
}

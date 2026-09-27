import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { RenderInternals } from '@remotion/renderer';
import { VERSION as REMOTION_VERSION } from 'remotion';

/** Exécutables FFmpeg/FFprobe embarqués par Remotion (ceux qui encodent réellement). */
export function remotionBinary(type: 'ffmpeg' | 'ffprobe'): string {
  return RenderInternals.getExecutablePath({ type, indent: false, logLevel: 'error', binariesDirectory: null });
}

function firstLine(file: string, args: string[]): string | null {
  try {
    return execFileSync(file, args, { encoding: 'utf8', windowsHide: true, timeout: 15_000 }).split(/\r?\n/)[0]?.trim() ?? null;
  } catch {
    return null;
  }
}

export interface Toolchain {
  node: string;
  remotion: string;
  chromium: string | null;
  ffmpeg: string | null;
}

/**
 * Versions réellement utilisées. La version de Chromium est lue dans le
 * chemin du navigateur installé par Remotion ; si elle ne peut pas l'être,
 * elle reste `null` plutôt que d'être supposée.
 */
export function readToolchain(browserPath: string | null): Toolchain {
  const ffmpeg = firstLine(remotionBinary('ffmpeg'), ['-version']);
  const chromiumMatch = browserPath ? /(\d+\.\d+\.\d+\.\d+)/.exec(browserPath) : null;
  const chromiumFromBinary = browserPath && !chromiumMatch ? firstLine(browserPath, ['--version']) : null;
  return {
    node: process.version,
    remotion: REMOTION_VERSION,
    chromium: chromiumMatch?.[1] ?? chromiumFromBinary ?? (browserPath ? `inconnu (${path.basename(browserPath)})` : null),
    ffmpeg: ffmpeg ? ffmpeg.replace(/ Copyright.*$/, '') : null,
  };
}

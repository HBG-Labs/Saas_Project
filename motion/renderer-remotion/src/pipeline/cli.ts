import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { runPipeline } from './pipeline.ts';
import type { StyleSource } from './pipeline.ts';
import { loadRenderProfile } from './profile.ts';

// Usage (depuis motion/) :
//   node renderer-remotion/src/pipeline/cli.ts --intent <intent.json> --style <style.json> --lib <polices> --out <dossier>
//   … --spec <spec.json> --style <autre-style.json> --substitution "motif"   (même spec, autre style)
//   … --brand <brand.json> | --series <series.json>
// Options : --patterns <dossier> (répétable), --assets <dossier> (répétable), --presets <fichier>, --profile dev|master|smoke|<fichier>, --no-render, --reduced-motion

const WORKSPACE = path.resolve(import.meta.dirname, '..', '..', '..');

const { values } = parseArgs({
  options: {
    intent: { type: 'string' },
    spec: { type: 'string' },
    style: { type: 'string' },
    brand: { type: 'string' },
    series: { type: 'string' },
    lib: { type: 'string' },
    patterns: { type: 'string', multiple: true },
    assets: { type: 'string', multiple: true },
    presets: { type: 'string' },
    profile: { type: 'string', default: 'dev' },
    out: { type: 'string' },
    substitution: { type: 'string' },
    'no-render': { type: 'boolean', default: false },
    'reduced-motion': { type: 'boolean', default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

const sources = [
  values.style ? { kind: 'style', file: values.style } : null,
  values.brand ? { kind: 'brand', file: values.brand } : null,
  values.series ? { kind: 'series', file: values.series } : null,
].filter((s) => s !== null);
if (sources.length !== 1) fail('Indiquer exactement un de --style, --brand ou --series.');
if (!values.out) fail('Indiquer --out.');
if (!values.intent === !values.spec) fail('Indiquer --intent OU --spec.');

const abs = (p: string) => path.resolve(p);
const source = sources[0]!;
const style = { kind: source.kind, file: abs(source.file), ...(values.lib ? { libraryRoot: abs(values.lib) } : {}) } as StyleSource;

/** Commit courant et état du moteur : « sale » dès qu'un fichier suivi ou non ignoré de motion/ diffère du commit. */
function gitState(): { commit: string | null; dirty: boolean | null } {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: WORKSPACE }).trim();
    const status = execFileSync('git', ['status', '--porcelain', '--', '.'], { encoding: 'utf8', cwd: WORKSPACE });
    return { commit, dirty: status.trim().length > 0 };
  } catch {
    return { commit: null, dirty: null };
  }
}

const result = await runPipeline({
  ...(values.intent ? { intentFile: abs(values.intent) } : {}),
  ...(values.spec ? { specFile: abs(values.spec) } : {}),
  style,
  ...(values.substitution ? { substitutionReason: values.substitution } : {}),
  patternDirs: (values.patterns ?? [path.join(WORKSPACE, 'packs', 'patterns', 'generic')]).map(abs),
  presetsFile: abs(values.presets ?? path.join(WORKSPACE, 'packs', 'platforms', 'platforms.json')),
  profile: loadRenderProfile(values.profile),
  outDir: abs(values.out),
  render: !values['no-render'],
  git: gitState(),
  reducedMotion: values['reduced-motion'],
  assetDirs: (values.assets ?? []).map(abs),
  analysisCacheDir: path.join(WORKSPACE, 'node_modules', '.cache', 'motion-analysis'),
  createdAt: new Date().toISOString(),
});

const s = result.stats;
console.log(
  JSON.stringify(
    {
      spec_sha256: result.manifest.spec.sha256,
      resolved_style_sha256: result.manifest.style.resolved_sha256,
      style: result.manifest.style.sources.style.id,
      substituted: result.manifest.style.substituted,
      render_plan_sha256: result.manifest.render_plan_sha256,
      manifest_sha256: result.manifest.manifest_sha256,
      git: { commit: result.manifest.engine.git_commit, dirty: result.manifest.engine.git_dirty },
      reference_eligible: result.manifest.reference_eligible,
      timing_source: result.plan.timing_source,
      typography: result.plan.provenance.typography,
      visual: result.plan.provenance.visual,
      analysis: { ms: Math.round(result.analysis.ms), cache: result.analysis.cache },
      contrast: Object.fromEntries(result.plan.scenes.flatMap((sc) => sc.nodes).filter((n) => n.type === 'text').map((n) => [n.id, n.type === 'text' ? `${n.contrast.measured}/${n.contrast.required}` : ''])),
      duration_s: result.plan.canvas.duration_frames / result.plan.canvas.fps,
      render: s
        ? {
            bundle_ms: Math.round(s.bundle_ms),
            render_ms: Math.round(s.render_ms),
            fps: Number(s.frames_per_second.toFixed(1)),
            mp4_kb: Math.round(s.mp4_bytes / 1024),
            node_peak_rss_mb: Math.round(s.memory.node_peak_rss_mb),
            render_processes_peak_mb: s.memory.render_processes_peak_mb === null ? null : Math.round(s.memory.render_processes_peak_mb),
            probe: s.probe,
            qc: s.qc,
          }
        : null,
      files: result.files,
    },
    null,
    2,
  ),
);

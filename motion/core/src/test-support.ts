import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { ResolvedStyle } from './contracts/resolved-style.ts';
import { buildSpec } from './builder/build-spec.ts';
import { compileSpec } from './compiler/compile.ts';
import type { CompileOutput } from './compiler/compile.ts';
import type { CreativeIntent } from './contracts/creative-intent.ts';
import type { MotionSceneSpec } from './contracts/motion-spec.ts';
import { loadBrandFile, loadPatternPacks, loadPlatformPresetsFile, loadSeriesFile, loadStyleFile } from './io/load.ts';
import type { LoadedBrand, LoadedSeries } from './io/load.ts';
import { resolveStyle } from './style/resolve-style.ts';
import type { ResolveStyleInput } from './style/resolve-style.ts';
import { formatIssues } from './validation/issues.ts';
import { sha256Hex } from './integrity/canonical.ts';
import { createHarfBuzzShaper } from './text/harfbuzz.ts';
import { loadAssetDirs } from './io/visual.ts';
import type { TextShaper } from './text/shaper.ts';

// Les tests du cœur n'utilisent que ses fixtures neutres : aucun exemple,
// aucune marque réelle, aucun pack externe.
export const CORE_ROOT = path.resolve(import.meta.dirname, '..');
export const FIXTURES = path.join(CORE_ROOT, 'test-fixtures');
export const PROFILES = path.join(FIXTURES, 'profiles');
export const FIXTURE_LIBRARY = { libraryRoot: path.join(FIXTURES, 'fonts') };

export type Json = Record<string, any>;

export function readFixture(relative: string): Json {
  return JSON.parse(readFileSync(path.join(FIXTURES, relative), 'utf8')) as Json;
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export const loadInk = () => loadStyleFile(path.join(PROFILES, 'fixture_ink.style.json'), FIXTURE_LIBRARY);
export const loadSignal = () => loadStyleFile(path.join(PROFILES, 'fixture_signal.style.json'), FIXTURE_LIBRARY);
export const loadFixtureBrand = (): LoadedBrand => loadBrandFile(path.join(PROFILES, 'fixture_brand.brand.json'), FIXTURE_LIBRARY);
export const loadFixtureSeries = (): LoadedSeries => loadSeriesFile(path.join(PROFILES, 'fixture_series.series.json'), FIXTURE_LIBRARY);

export function mustResolve(input: ResolveStyleInput): ResolvedStyle {
  const result = resolveStyle(input);
  if (!result.ok) throw new Error(`Résolution refusée :\n${formatIssues(result.issues)}`);
  return result.value;
}

export const resolvedInk = () => mustResolve({ style: loadInk() });
export const resolvedSignal = () => mustResolve({ style: loadSignal() });

export function codes(result: { ok: boolean; issues?: { code: string; severity?: string }[] }): string[] {
  return result.ok ? [] : (result.issues ?? []).filter((i) => i.severity !== 'warning').map((i) => i.code);
}

/** Render Plan minimal et cohérent, pour les tests de validation et de manifeste. */
export function minimalPlan(): Json {
  return {
    schema: 'render-plan',
    schema_version: '0.5.0',
    spec: { spec_id: 'moon_question', revision: 1, sha256: 'a'.repeat(64) },
    style: { mode: 'creative', sha256: 'b'.repeat(64) },
    compiler_version: '0.5.0',
    composition: { portability: 'portable' },
    timing_source: 'estimated',
    reduced_motion: false,
    provenance: {
      behavior_registry: { version: '1.2.0', sha256: 'd'.repeat(64) },
      behaviors: [],
      visual: { readability_rules: '1.0.0', analysis_algorithm: '1.0.0', analyses: [] },
      typography: { rules: 'fr@1.0.0', shaper: 'harfbuzz 14.5.0', substitutions: [] },
    },
    canvas: { width: 1080, height: 1920, fps: 30, duration_frames: 60, safe_area: { x: 60, y: 120, w: 960, h: 1560 } },
    fonts: [{ id: 'display_900', css_name: 'fixture-ink-serif', weight: 900, style: 'normal', file: 'lib:playfair-display-latin-900.ttf', sha256: 'c'.repeat(64) }],
    assets: [],
    scenes: [
      {
        id: 'sc_question',
        from: 0,
        to: 60,
        background: '#101820',
        voice_only: [],
        nodes: [
          {
            id: 'tx_question',
            type: 'text',
            box: { x: 120, y: 760, w: 840, h: 320 },
            origin: { x: 0, y: 0 },
            opacity: 1,
            align: 'start',
            lines: [
              {
                runs: [
                  {
                    id: 'r_setup',
                    text: 'Et si',
                    font: 'display_900',
                    weight: 900,
                    size: 150,
                    tracking_px: 0,
                    color: '#EFE6D2',
                    x: 0,
                    width: 310,
                    glyphs: [
                      { g: 40, cl: 0, x: 0, dx: 0, dy: 0 },
                      { g: 87, cl: 1, x: 100, dx: 0, dy: 0 },
                      { g: 3, cl: 2, x: 150, dx: 0, dy: 0 },
                      { g: 86, cl: 3, x: 190, dx: 0, dy: 0 },
                      { g: 76, cl: 4, x: 260, dx: 0, dy: 0 },
                    ],
                  },
                ],
                top: 0,
                height: 153,
                baseline: 118,
                measured_width: 310,
                ink: { x0: 0, x1: 308, y0: 12, y1: 120 },
              },
            ],
            fit: { role: 'display.xl', ratio: 1, size: 150, policy: 'explicit' },
            ink: { x: 120, y: 772, w: 308, h: 108 },
            contrast: { category: 'large', required: 3, measured: 14.5, worst: { run: 'r_setup', line: 0, frame: 10 }, frames: 1, override: null },
            tracks: [{ property: 'opacity', keys: [{ frame: 0, value: 0 }, { frame: 10, value: 1 }], sources: ['bh_question_in'] }],
          },
        ],
      },
    ],
  };
}

// --- P1.2 : chaîne Intent → Spec → Render Plan sur fixtures neutres ---
export const loadFixturePatterns = () => loadPatternPacks(path.join(FIXTURES, 'patterns'));
export const loadFixturePresets = () => loadPlatformPresetsFile(path.join(FIXTURES, 'platforms.json'));
export const readFilmIntent = (): CreativeIntent => readFixture('moon.film.intent.json') as unknown as CreativeIntent;

/** Même intent, sans durée cible : les durées naturelles du style s'appliquent. */
export function naturalIntent(): CreativeIntent {
  const intent = clone(readFilmIntent());
  delete intent.target_duration_s;
  return intent;
}

export function mustBuild(resolved: ResolvedStyle, intent: CreativeIntent = naturalIntent()): MotionSceneSpec {
  const result = buildSpec({ intent, resolved, presets: loadFixturePresets(), patterns: loadFixturePatterns() });
  if (!result.ok) throw new Error(`Construction refusée :\n${formatIssues(result.issues)}`);
  return result.value;
}

/** Shaper HarfBuzz sur les polices de test, indexées par empreinte. */
let fixtureShaperInstance: TextShaper | null = null;
export function fixtureShaper(): TextShaper {
  if (!fixtureShaperInstance) {
    const dir = path.join(FIXTURES, 'fonts');
    const bytes = new Map<string, Uint8Array>();
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.ttf'))) {
      const data = readFileSync(path.join(dir, name));
      bytes.set(sha256Hex(data), data);
    }
    fixtureShaperInstance = createHarfBuzzShaper((sha) => {
      const data = bytes.get(sha);
      if (!data) throw new Error(`police ${sha} absente des fixtures`);
      return data;
    });
  }
  return fixtureShaperInstance;
}

/** Empreinte d'un fichier de police de test. */
export const fixtureFontSha = (name: string) => sha256Hex(readFileSync(path.join(FIXTURES, 'fonts', name)));

/** Assets de test (image procédurale neutre), vérifiés à la lecture. */
export const loadFixtureAssets = () => loadAssetDirs([path.join(FIXTURES, 'assets')]);

export const DEV_OUTPUT = { width: 540, height: 960, fps: 30 };
export const AUDIO_TARGETS = { target_lufs: -14, true_peak_dbtp: -1 };

export function mustCompile(spec: MotionSceneSpec, resolved: ResolvedStyle, output = DEV_OUTPUT, reducedMotion = false): CompileOutput {
  const result = compileSpec({
    reducedMotion,
    spec,
    resolved,
    presets: loadFixturePresets(),
    patterns: loadFixturePatterns(),
    output,
    audioTargets: AUDIO_TARGETS,
    allowStyleSubstitution: true,
    shaper: fixtureShaper(),
  });
  if (!result.ok) throw new Error(`Compilation refusée :\n${formatIssues(result.issues)}`);
  return result.value;
}

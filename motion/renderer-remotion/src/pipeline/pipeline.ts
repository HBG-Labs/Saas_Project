import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildReproducibilityManifest,
  ENGINE_NAME,
  ENGINE_VERSION,
  buildSpec,
  compileSpec,
  formatIssues,
  loadBrandFile,
  loadPatternPacks,
  loadPlatformPresetsFile,
  loadSeriesFile,
  loadStyleFile,
  resolveResource,
  resolveStyle,
  sha256Hex,
  validateIntent,
  validateSpec,
} from '@motion-engine/core';
import type {
  AudioPlan,
  MotionSceneSpec,
  RenderPlan,
  ReproducibilityManifest,
  ResolvedStyle,
  ResolveStyleInput,
  SubtitlePlan,
  ValidationResult,
} from '@motion-engine/core';

import type { FontSource } from '../composition/types.ts';
import type { RenderProfile } from './profile.ts';
import { prepareBrowser, renderPlanToMp4 } from './render-video.ts';
import type { RenderStats } from './render-video.ts';
import { readToolchain } from './toolchain.ts';

export type StyleSource =
  | { kind: 'style'; file: string; libraryRoot?: string }
  | { kind: 'brand'; file: string; libraryRoot?: string }
  | { kind: 'series'; file: string; libraryRoot?: string };

export interface PipelineRequest {
  /** Construire la spec depuis un Creative Intent… */
  intentFile?: string;
  /** …ou rendre une spec existante telle quelle. */
  specFile?: string;
  style: StyleSource;
  /** Obligatoire si le style n'est pas celui de la liaison de la spec. */
  substitutionReason?: string;
  patternDirs: string[];
  presetsFile: string;
  profile: RenderProfile;
  outDir: string;
  render: boolean;
  /** État git réel du dépôt au moment du rendu, lu par l'appelant. */
  git: { commit: string | null; dirty: boolean | null };
  /** Préférence « mouvement réduit » : chaque comportement applique sa propre stratégie. */
  reducedMotion?: boolean;
  /** Date de création du manifeste, fournie par l'appelant (le pipeline ne lit pas l'horloge pour décider). */
  createdAt: string;
}

export interface PipelineResult {
  spec: MotionSceneSpec;
  resolved: ResolvedStyle;
  plan: RenderPlan;
  audio: AudioPlan;
  subtitles: SubtitlePlan;
  manifest: ReproducibilityManifest;
  stats: RenderStats | null;
  files: Record<string, string>;
}

function unwrap<T>(what: string, result: ValidationResult<T>): T {
  if (!result.ok) throw new Error(`${what} refusé :\n${formatIssues(result.issues)}`);
  return result.value;
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Résout le style et retrouve le dossier contre lequel ses références `pack:` se lisent. */
export function loadStyleSource(source: StyleSource): { resolved: ResolvedStyle; styleDir: string } {
  const options = source.libraryRoot ? { libraryRoot: source.libraryRoot } : {};
  let input: ResolveStyleInput;
  let styleDir: string;
  if (source.kind === 'style') {
    input = { style: loadStyleFile(source.file, options) };
    styleDir = path.dirname(source.file);
  } else if (source.kind === 'brand') {
    const brand = loadBrandFile(source.file, options);
    input = { brand };
    styleDir = path.dirname(resolveResource(brand.profile.style.src, path.dirname(source.file), options));
  } else {
    const series = loadSeriesFile(source.file, options);
    input = { series: { profile: series.profile, style: series.style }, ...(series.brand ? { brand: series.brand } : {}) };
    styleDir = path.dirname(resolveResource(series.profile.style.src, path.dirname(source.file), options));
  }
  return { resolved: unwrap('Style', resolveStyle(input)), styleDir };
}

/** Octets des polices du plan, vérifiés par empreinte, en data URL pour le navigateur. */
export function fontSources(plan: RenderPlan, styleDir: string, libraryRoot: string | undefined): FontSource[] {
  return plan.fonts.map((font) => {
    const file = resolveResource(font.file, styleDir, libraryRoot ? { libraryRoot } : {});
    const bytes = readFileSync(file);
    if (sha256Hex(bytes) !== font.sha256) throw new Error(`Police ${font.file} : empreinte différente du Render Plan.`);
    return {
      id: font.id,
      css_name: font.css_name,
      weight: font.weight,
      style: font.style,
      data_url: `data:font/ttf;base64,${bytes.toString('base64')}`,
    };
  });
}

export async function runPipeline(request: PipelineRequest): Promise<PipelineResult> {
  const { resolved, styleDir } = loadStyleSource(request.style);
  const presets = loadPlatformPresetsFile(request.presetsFile);
  const patterns = loadPatternPacks(...request.patternDirs);

  let spec: MotionSceneSpec;
  if (request.specFile) {
    spec = unwrap('Spec', validateSpec(readJson(request.specFile), resolved, { patterns, allowStyleSubstitution: request.substitutionReason !== undefined }));
  } else if (request.intentFile) {
    const intent = unwrap('Creative Intent', validateIntent(readJson(request.intentFile)));
    spec = unwrap('SpecBuilder', buildSpec({ intent, resolved, presets, patterns }));
  } else {
    throw new Error('Il faut un Creative Intent ou une spec.');
  }

  const compiled = unwrap(
    'Compilation',
    compileSpec({
      spec,
      resolved,
      presets,
      patterns,
      output: { width: request.profile.width, height: request.profile.height, fps: request.profile.fps },
      audioTargets: request.profile.audio,
      allowStyleSubstitution: request.substitutionReason !== undefined,
      reducedMotion: request.reducedMotion ?? false,
    }),
  );

  mkdirSync(request.outDir, { recursive: true });
  const files: Record<string, string> = {};
  const write = (name: string, value: unknown) => {
    const file = path.join(request.outDir, name);
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    files[name] = file;
  };
  write('spec.json', spec);
  write('resolved-style.json', resolved);
  write('render-plan.json', compiled.plan);
  write('audio-plan.json', compiled.audio);
  write('subtitle-plan.json', compiled.subtitles);

  let stats: RenderStats | null = null;
  let browserPath: string | null = null;
  if (request.render) {
    const fonts = fontSources(compiled.plan, styleDir, request.style.libraryRoot);
    const output = path.join(request.outDir, 'video.mp4');
    browserPath = (await prepareBrowser()).path;
    stats = await renderPlanToMp4({ plan: compiled.plan, fonts, audio: null, profile: request.profile, outputFile: output });
    files['video.mp4'] = output;
    write('stats.json', stats);
  }

  const manifest = buildReproducibilityManifest({
    createdAt: request.createdAt,
    engine: { name: ENGINE_NAME, version: ENGINE_VERSION },
    git: request.git,
    spec,
    resolvedStyle: resolved,
    plan: compiled.plan,
    platformPresets: presets,
    toolchain: readToolchain(browserPath),
    renderConfig: {
      width: request.profile.width,
      height: request.profile.height,
      fps: request.profile.fps,
      codec: request.profile.codec,
      crf: request.profile.crf,
      pixel_format: request.profile.pixel_format,
      color_space: request.profile.color_space,
    },
    ...(request.substitutionReason ? { substitutionReason: request.substitutionReason } : {}),
  });
  write('manifest.json', manifest);

  return { spec, resolved, plan: compiled.plan, audio: compiled.audio, subtitles: compiled.subtitles, manifest, stats, files };
}

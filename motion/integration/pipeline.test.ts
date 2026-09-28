import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { ENGINE_NAME, ENGINE_VERSION, hashDocument, sha256Hex } from '@motion-engine/core';
import { imageSources, loadRenderProfile, runPipeline } from '@motion-engine/renderer-remotion';
import type { PipelineRequest } from '@motion-engine/renderer-remotion';

import { CORE, EXAMPLES, WORKSPACE } from './support.ts';

// Chaîne complète sans encodage vidéo (render: false) : rapide, et exécutée à
// chaque vérification. Le rendu réel est couvert par le smoke test du renderer.

const out = mkdtempSync(path.join(tmpdir(), 'motion-pipeline-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));

const base: Omit<PipelineRequest, 'style' | 'outDir'> = {
  intentFile: path.join(CORE, 'test-fixtures', 'moon.film.intent.json'),
  patternDirs: [path.join(WORKSPACE, 'packs', 'patterns', 'generic')],
  presetsFile: path.join(WORKSPACE, 'packs', 'platforms', 'platforms.json'),
  profile: loadRenderProfile('dev'),
  render: false,
  git: { commit: null, dirty: null },
  createdAt: '2026-09-27T18:00:00+02:00',
};
const nocturne = { kind: 'style' as const, file: path.join(EXAMPLES, 'control_nocturne', 'style.json'), libraryRoot: path.join(WORKSPACE, 'packs', 'fonts') };
const signal = {
  kind: 'style' as const,
  file: path.join(CORE, 'test-fixtures', 'profiles', 'fixture_signal.style.json'),
  libraryRoot: path.join(CORE, 'test-fixtures', 'fonts'),
};

describe('pipeline Intent → Spec → Render Plan → manifeste', () => {
  it('écrit spec, style résolu, plans et manifeste, reliés par leurs empreintes', async () => {
    const result = await runPipeline({ ...base, style: nocturne, outDir: path.join(out, 'a') });
    const onDisk = (name: string) => JSON.parse(readFileSync(result.files[name]!, 'utf8')) as unknown;
    expect(hashDocument(onDisk('spec.json'))).toBe(result.manifest.spec.sha256);
    expect(hashDocument(onDisk('render-plan.json'))).toBe(result.manifest.render_plan_sha256);
    expect(result.manifest.style.resolved_sha256).toBe(result.resolved.sha256);
    expect(result.manifest.platform_presets).not.toBeNull();
    expect(result.manifest.render_config).toMatchObject({ width: 540, height: 960, fps: 30, codec: 'h264', color_space: 'bt709', reduced_motion: false });
    expect(result.manifest.schema_version).toBe('0.3.0');
    expect(result.manifest.engine).toMatchObject({ name: ENGINE_NAME, version: ENGINE_VERSION });
    expect(result.manifest.timing_source).toBe('estimated');
    expect(result.manifest.behavior_registry).toEqual(result.plan.provenance.behavior_registry);
    // Chaque police du manifeste correspond octet pour octet au fichier de la bibliothèque.
    for (const font of result.manifest.fonts) {
      const file = path.join(WORKSPACE, 'packs', 'fonts', font.file.replace(/^lib:/, ''));
      expect(sha256Hex(readFileSync(file))).toBe(font.sha256);
    }
  });

  it('même spec, même style, mêmes versions : même Render Plan d’un processus à l’autre', async () => {
    const a = await runPipeline({ ...base, style: nocturne, outDir: path.join(out, 'r1') });
    const b = await runPipeline({ ...base, style: nocturne, outDir: path.join(out, 'r2') });
    expect(b.manifest.render_plan_sha256).toBe(a.manifest.render_plan_sha256);
    expect(b.manifest.manifest_sha256).toBe(a.manifest.manifest_sha256);
  });

  it('la MÊME spec rendue avec un autre style : autre plan, substitution tracée', async () => {
    const a = await runPipeline({ ...base, style: nocturne, outDir: path.join(out, 'same-a') });
    const { intentFile: _intent, ...withoutIntent } = base;
    const b = await runPipeline({
      ...withoutIntent,
      specFile: a.files['spec.json']!,
      style: signal,
      substitutionReason: 'preuve : même spec, autre style',
      outDir: path.join(out, 'same-b'),
    });
    expect(b.manifest.spec.sha256).toBe(a.manifest.spec.sha256);
    expect(b.manifest.render_plan_sha256).not.toBe(a.manifest.render_plan_sha256);
    expect(b.manifest.style.substituted).toBe(true);
    expect(b.manifest.style.sources.style.id).toBe('fixture_signal');
    expect(b.plan.scenes[0]!.background).not.toBe(a.plan.scenes[0]!.background);
  });

  it('état git inconnu ou sale : jamais un rendu de référence', async () => {
    const unknown = await runPipeline({ ...base, style: nocturne, outDir: path.join(out, 'git-unknown') });
    expect(unknown.manifest.engine.git_dirty).toBeNull();
    expect(unknown.manifest.reference_eligible).toBe(false);
    const dirty = await runPipeline({ ...base, git: { commit: 'a'.repeat(40), dirty: true }, style: nocturne, outDir: path.join(out, 'git-dirty') });
    expect(dirty.manifest.engine).toMatchObject({ git_commit: 'a'.repeat(40), git_dirty: true });
    expect(dirty.manifest.reference_eligible).toBe(false);
  });

  it('mouvement réduit : tracé dans le plan et le manifeste, sans changer le temps', async () => {
    const full = await runPipeline({ ...base, style: nocturne, outDir: path.join(out, 'rm-full') });
    const reduced = await runPipeline({ ...base, reducedMotion: true, style: nocturne, outDir: path.join(out, 'rm-reduced') });
    expect(reduced.manifest.render_config.reduced_motion).toBe(true);
    expect(reduced.plan.reduced_motion).toBe(true);
    expect(reduced.plan.canvas.duration_frames).toBe(full.plan.canvas.duration_frames);
    expect(reduced.manifest.render_plan_sha256).not.toBe(full.manifest.render_plan_sha256);
  });

  it('P1.5 : la spec visuelle P1.4 (grille, « style_bound ») est refusée avec un autre style ; elle reste reproductible depuis 4816633', async () => {
    const { intentFile: _intent, ...withoutIntent } = base;
    await expect(
      runPipeline({
        ...withoutIntent,
        specFile: path.join(CORE, 'test-fixtures', 'moon.visual.spec.json'),
        assetDirs: [path.join(CORE, 'test-fixtures', 'assets')],
        style: nocturne,
        substitutionReason: 'preuve de refus',
        outDir: path.join(out, 'visual-p14'),
      }),
    ).rejects.toThrowError(/composition\.style_bound_substitution/);
  });

  it('P1.5 : spec PORTABLE — assets vérifiés et analysés, texte mesuré, contraste, images en mouvement', async () => {
    const { intentFile: _intent, ...withoutIntent } = base;
    const result = await runPipeline({
      ...withoutIntent,
      specFile: path.join(CORE, 'test-fixtures', 'moon.portable.spec.json'),
      patternDirs: [path.join(WORKSPACE, 'packs', 'patterns', 'generic')],
      assetDirs: [path.join(CORE, 'test-fixtures', 'assets')],
      style: nocturne,
      substitutionReason: 'P1.5 : spec portable, profil Nocturne',
      outDir: path.join(out, 'visual'),
    });
    expect(result.plan.composition).toEqual({ portability: 'portable' });
    expect(result.plan.provenance.visual.analyses.map((a) => a.ref)).toEqual(['night_moon']);
    expect(result.plan.scenes.flatMap((s) => s.nodes).filter((n) => n.type === 'text').every((n) => n.type === 'text' && n.contrast.measured >= n.contrast.required)).toBe(true);
    expect(result.plan.assets.map((a) => a.ref)).toEqual(['night_moon']);
    expect(result.manifest.assets).toEqual([{ ref: 'night_moon', sha256: result.plan.assets[0]!.sha256 }]);
    expect(result.plan.provenance.typography.rules).toBe('fr@1.0.0');
    const types = result.plan.scenes.flatMap((s) => s.nodes.map((n) => n.type));
    expect(types).toEqual(expect.arrayContaining(['image', 'text', 'mask', 'path']));
    // Le navigateur recevra les octets vérifiés de l'image.
    const sources = imageSources(result.plan, new Map([['night_moon', path.join(CORE, 'test-fixtures', 'assets', 'night_moon.png')]]));
    expect(sources[0]!.data_url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('P1.5 : le cache des analyses est une pure optimisation (même plan avec, sans, et cache chaud)', async () => {
    const { intentFile: _intent, ...withoutIntent } = base;
    const run = (name: string, cache: string | undefined) =>
      runPipeline({
        ...withoutIntent,
        specFile: path.join(CORE, 'test-fixtures', 'moon.portable.spec.json'),
        assetDirs: [path.join(CORE, 'test-fixtures', 'assets')],
        ...(cache ? { analysisCacheDir: cache } : {}),
        style: nocturne,
        substitutionReason: 'cache',
        outDir: path.join(out, name),
      });
    const cacheDir = path.join(out, 'analysis-cache');
    const none = await run('cache-none', undefined);
    const cold = await run('cache-cold', cacheDir);
    const warm = await run('cache-warm', cacheDir);
    expect([none.analysis.cache['night_moon'], cold.analysis.cache['night_moon'], warm.analysis.cache['night_moon']]).toEqual(['none', 'miss', 'hit']);
    expect(cold.manifest.render_plan_sha256).toBe(none.manifest.render_plan_sha256);
    expect(warm.manifest.render_plan_sha256).toBe(none.manifest.render_plan_sha256);
  });

  it('P1.5 : les films P1.3/P1.4 gardent leurs durées (300 et 180 frames) et leur mise en page', async () => {
    const a = await runPipeline({ ...base, style: nocturne, outDir: path.join(out, 'film-n') });
    const { intentFile: _intent, ...withoutIntent } = base;
    const b = await runPipeline({ ...withoutIntent, specFile: a.files['spec.json']!, style: signal, substitutionReason: 'film', outDir: path.join(out, 'film-s') });
    expect([a.plan.canvas.duration_frames, b.plan.canvas.duration_frames]).toEqual([300, 180]);
    expect(a.plan.scenes.map((s) => [s.from, s.to])).toEqual([
      [0, 169],
      [169, 300],
    ]);
  });

  it('REZO360 passe par le même moteur, en consommateur (mode marque)', async () => {
    const result = await runPipeline({
      ...base,
      intentFile: path.join(EXAMPLES, 'rezo360', 'pilots', 'pilot-b-interrupt', 'intent.json'),
      style: { kind: 'brand', file: path.join(EXAMPLES, 'rezo360', 'brand.json') },
      outDir: path.join(out, 'rezo'),
    });
    expect(result.manifest.style.mode).toBe('brand');
    expect(result.manifest.style.sources.brand?.id).toBe('rezo360');
    expect(result.plan.fonts.every((f) => f.file.startsWith('pack:fonts/'))).toBe(true);
  });
});

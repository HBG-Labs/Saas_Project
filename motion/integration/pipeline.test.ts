import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { hashDocument, sha256Hex } from '@motion-engine/core';
import { loadRenderProfile, runPipeline } from '@motion-engine/renderer-remotion';
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
  gitCommit: null,
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
    expect(result.manifest.render_config).toMatchObject({ width: 540, height: 960, fps: 30, codec: 'h264', color_space: 'bt709' });
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

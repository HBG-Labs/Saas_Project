import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { runPipeline } from '../src/pipeline/pipeline.ts';
import type { PipelineRequest } from '../src/pipeline/pipeline.ts';
import { loadRenderProfile } from '../src/pipeline/profile.ts';

// Rendu réel de bout en bout sur fixtures neutres : Intent → Spec → Render Plan
// → Chromium → MP4. Lancé à part (npm run test:render) : il télécharge un
// navigateur au premier passage et dure plusieurs dizaines de secondes.

const CORE_FIXTURES = path.resolve(import.meta.dirname, '..', '..', 'core', 'test-fixtures');
const out = mkdtempSync(path.join(tmpdir(), 'motion-smoke-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));

function request(overrides: Partial<PipelineRequest>): PipelineRequest {
  return {
    intentFile: path.join(CORE_FIXTURES, 'moon.film.intent.json'),
    style: {
      kind: 'style',
      file: path.join(CORE_FIXTURES, 'profiles', 'fixture_signal.style.json'),
      libraryRoot: path.join(CORE_FIXTURES, 'fonts'),
    },
    patternDirs: [path.join(CORE_FIXTURES, 'patterns')],
    presetsFile: path.join(CORE_FIXTURES, 'platforms.json'),
    profile: loadRenderProfile('smoke'),
    outDir: out,
    render: true,
    git: { commit: null, dirty: null },
    createdAt: '2026-09-27T18:00:00+02:00',
    ...overrides,
  };
}

describe('smoke test de rendu', () => {
  it('produit un MP4 conforme au Render Plan et au profil', async () => {
    const result = await runPipeline(request({}));
    const stats = result.stats!;
    expect(stats.probe).toMatchObject({ width: 270, height: 480, codec: 'h264', pix_fmt: 'yuv420p', fps: '30/1' });
    expect(stats.probe.frames).toBe(result.plan.canvas.duration_frames);
    expect(stats.qc).toEqual([]);
    expect(result.manifest.render_config.color_space).toBe('bt709');
    expect(result.manifest.schema_version).toBe('0.3.0');
    expect(result.manifest.reference_eligible).toBe(false);
    expect(result.manifest.toolchain.remotion).toBe('4.0.529');
    expect(result.manifest.toolchain.chromium).not.toBeNull();

    // Même spec, même style, mêmes versions : même Render Plan (sans refaire la vidéo).
    const again = await runPipeline(request({ outDir: path.join(out, 'again'), render: false }));
    expect(again.manifest.render_plan_sha256).toBe(result.manifest.render_plan_sha256);
    expect(again.manifest.spec.sha256).toBe(result.manifest.spec.sha256);
  });
});

import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { backgroundAt, decodePng, loadAssetDirs, SAMPLE_STEP_REF_PX, scoreGlyphs } from '@motion-engine/core';

import { fontSources, imageSources, loadStyleSource, runPipeline } from '../src/pipeline/pipeline.ts';
import { renderPlanStill } from '../src/pipeline/render-video.ts';
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

  it('P1.4/P1.5 : image, masque, tracé, mouvements d’image ; le navigateur mesure le texte comme le cœur', async () => {
    const { intentFile: _intent, ...rest } = request({});
    const result = await runPipeline({
      ...rest,
      specFile: path.join(CORE_FIXTURES, 'moon.portable.spec.json'),
      assetDirs: [path.join(CORE_FIXTURES, 'assets')],
      substitutionReason: 'smoke P1.5 : spec portable, profil Signal',
      outDir: path.join(out, 'visual'),
    });
    const stats = result.stats!;
    expect(stats.probe.frames).toBe(result.plan.canvas.duration_frames);
    // Aucune divergence de largeur navigateur / HarfBuzz, aucune police de repli.
    expect(stats.qc).toEqual([]);
    expect(result.plan.assets.map((a) => a.ref)).toEqual(['night_moon']);
  });

  it('P1.5 : la métrique de contraste du cœur représente ce que Chromium dessine réellement (textes retirés)', async () => {
    const { intentFile: _intent, ...rest } = request({});
    const style = rest.style;
    const assets = loadAssetDirs([path.join(CORE_FIXTURES, 'assets')]);
    const result = await runPipeline({
      ...rest,
      profile: loadRenderProfile('dev'),
      render: false,
      specFile: path.join(CORE_FIXTURES, 'moon.portable.spec.json'),
      assetDirs: [path.join(CORE_FIXTURES, 'assets')],
      substitutionReason: 'P1.5 : métrique contre rendu réel',
      outDir: path.join(out, 'metric'),
    });
    const plan = result.plan;
    const { styleDir } = loadStyleSource(style);
    const fonts = fontSources(plan, styleDir, style.libraryRoot);
    const images = imageSources(plan, assets.files);
    const step = (SAMPLE_STEP_REF_PX * plan.canvas.width) / 1080;
    for (const id of ['tx_static', 'tx_push']) {
      const scene = plan.scenes.find((sc) => sc.nodes.some((n) => n.id === id))!;
      const node = scene.nodes.find((n) => n.id === id)!;
      if (node.type !== 'text') throw new Error('texte attendu');
      const frame = node.contrast.worst.frame;
      // Même plan, textes retirés : les pixels sous l'encre sont le fond RÉEL.
      const bare = structuredClone(plan);
      for (const sc of bare.scenes) sc.nodes = sc.nodes.filter((n) => n.type !== 'text');
      const file = path.join(out, `${id}.png`);
      await renderPlanStill({ plan: bare, fonts, images, audio: null, frame, outputFile: file });
      const img = decodePng(new Uint8Array(readFileSync(file)));
      const pixel = (x: number, y: number): [number, number, number] => {
        const p = (Math.floor(y) * img.width + Math.floor(x)) * 4;
        return [img.data[p]! / 255, img.data[p + 1]! / 255, img.data[p + 2]! / 255];
      };
      const glyphs = result.textSamples.get(id)!.glyphs;
      const real = scoreGlyphs(glyphs, step, pixel);
      const predicted = scoreGlyphs(glyphs, step, (x, y) => backgroundAt(scene, plan, assets.analyses, id, x, y, frame));
      // Écart relatif ≤ 2 %, même pire glyphe, même verdict.
      expect(Math.abs(real.measured - predicted.measured) / real.measured).toBeLessThan(0.02);
      expect(real.worst.run).toBe(predicted.worst.run);
      expect(real.measured >= node.contrast.required).toBe(predicted.measured >= node.contrast.required);
    }
  });

  it('aucun profil Chrome temporaire ne reste après un rendu (fuite corrigée en P1.4)', async () => {
    // Uniquement les profils CRÉÉS pendant ce test, dans le dossier temporaire du système.
    const profiles = () => new Set(readdirSync(tmpdir()).filter((n) => n.startsWith('puppeteer_dev_chrome_profile-')));
    const before = profiles();
    await runPipeline(request({ outDir: path.join(out, 'leak') }));
    const leaked = [...profiles()].filter((n) => !before.has(n));
    expect(leaked).toEqual([]);
  });
});

import { readFileSync, writeFileSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import type { MotionSceneSpec } from '../contracts/motion-spec.ts';
import type { PlanImageNode, PlanMaskNode, PlanNode, PlanPathNode, PlanTextNode, RenderPlan } from '../contracts/render-plan.ts';
import type { ResolvedStyle } from '../contracts/resolved-style.ts';
import { hashDocument } from '../integrity/canonical.ts';
import { imageDimensions, loadAssetFile } from '../io/visual.ts';
import {
  AUDIO_TARGETS,
  clone,
  codes,
  DEV_OUTPUT,
  FIXTURES,
  fixtureShaper,
  loadFixtureAssets,
  loadFixturePatterns,
  loadFixturePresets,
  loadInk,
  mustBuild,
  mustResolve,
  readFixture,
  resolvedInk,
  resolvedSignal,
} from '../test-support.ts';
import { NBSP } from '../text/typography.ts';
import { validateSpec } from '../validation/validate.ts';
import { compileSpec } from './compile.ts';

const ink = resolvedInk();
const signal = resolvedSignal();
const assets = loadFixtureAssets().registry;
const visual = (): MotionSceneSpec => clone(readFixture('moon.visual.spec.json')) as unknown as MotionSceneSpec;

const compile = (spec: MotionSceneSpec, resolved: ResolvedStyle = ink, output = DEV_OUTPUT) =>
  compileSpec({
    spec,
    resolved,
    presets: loadFixturePresets(),
    patterns: loadFixturePatterns(),
    output,
    audioTargets: AUDIO_TARGETS,
    allowStyleSubstitution: true,
    shaper: fixtureShaper(),
    assets,
  });

function must(spec: MotionSceneSpec, resolved: ResolvedStyle = ink, output = DEV_OUTPUT): RenderPlan {
  const result = compile(spec, resolved, output);
  if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
  return result.value.plan;
}

const all = (nodes: readonly PlanNode[]): PlanNode[] => nodes.flatMap((n) => (n.type === 'group' || n.type === 'mask' ? [n, ...all(n.children)] : [n]));
const find = <T extends PlanNode>(plan: RenderPlan, id: string) => plan.scenes.flatMap((s) => all(s.nodes)).find((n) => n.id === id) as T;
const inside = (inner: { x: number; y: number; w: number; h: number }, outer: { x: number; y: number; w: number; h: number }, t = 0.5) =>
  inner.x >= outer.x - t && inner.y >= outer.y - t && inner.x + inner.w <= outer.x + outer.w + t && inner.y + inner.h <= outer.y + outer.h + t;

describe('spec visuelle : images, masques, régions, tracés, texte mesuré', () => {
  it('la spec est valide face aux assets, et se compile déterministiquement', () => {
    expect(validateSpec(visual(), ink, { patterns: loadFixturePatterns(), assets }).ok).toBe(true);
    expect(hashDocument(must(visual()))).toBe(hashDocument(must(visual())));
  });

  it('image plein cadre, recadrage déclaré, asset tracé dans le plan', () => {
    const plan = must(visual());
    const sky = find<PlanImageNode>(plan, 'img_sky');
    expect(sky.box).toEqual({ x: 0, y: 0, w: 540, h: 960 });
    expect(sky.crop).toEqual({ x: 0, y: 0, w: 720, h: 1280 });
    expect(plan.assets).toEqual([{ ref: 'night_moon', file: 'pack:night_moon.png', sha256: assets.get('night_moon')!.sha256, width: 720, height: 1280 }]);
  });

  it('le titre se pose dans la région « ciel » de l’image, ramenée dans la zone sûre', () => {
    const plan = must(visual());
    const sky = find<PlanImageNode>(plan, 'img_sky');
    const title = find<PlanTextNode>(plan, 'tx_sky');
    const zone = sky.regions['sky']!;
    expect(inside(title.ink!, zone)).toBe(true);
    expect(inside(title.ink!, plan.canvas.safe_area)).toBe(true);
  });

  it('masque : l’image enfant remplit la fenêtre, recadrée serrée sur la lune', () => {
    const plan = must(visual());
    const mask = find<PlanMaskNode>(plan, 'msk_moon');
    const image = find<PlanImageNode>(plan, 'img_moon');
    expect(mask.clip.shape).toBe('ellipse');
    expect(image.box).toEqual(mask.box);
    // La lune occupe (au moins) toute la hauteur ou toute la largeur de la fenêtre.
    const moon = image.regions['moon']!;
    expect(Math.max(moon.w / image.box.w, moon.h / image.box.h)).toBeCloseTo(1, 6);
  });

  it('tracé par points : coordonnées de grille converties, dans la zone sûre, tracé relatif à la boîte', () => {
    const plan = must(visual());
    const wave = find<PlanPathNode>(plan, 'ln_wave');
    expect(wave.d.startsWith('M ')).toBe(true);
    expect(wave.d.split('L').length).toBe(5);
    expect(inside(wave.box, plan.canvas.safe_area)).toBe(true);
  });

  it('typographie française appliquée au texte affiché, repli de glyphe tracé', () => {
    const plan = must(visual());
    const title = find<PlanTextNode>(plan, 'tx_sky');
    const text = title.lines.map((l) => l.runs.map((r) => r.text).join('')).join(' ');
    expect(text).toContain('n’était');
    expect(text).toContain(`plus là${NBSP}?`);
    const tides = find<PlanTextNode>(plan, 'tx_tides');
    expect(tides.lines.at(-1)!.runs.map((r) => r.text).join('')).toBe(`un ciel «${NBSP}vide${NBSP}»…`);
    // Playfair n'a pas l'espace fine U+202F : repli déclaré vers U+00A0, enregistré.
    expect(plan.provenance.typography.rules).toBe('fr@1.0.0');
    expect(plan.provenance.typography.shaper).toMatch(/^harfbuzz \d+\.\d+\.\d+$/);
    expect(plan.provenance.typography.substitutions.map((s) => [s.character, s.replacement])).toEqual([[' ', NBSP]]);
    const result = compile(visual());
    expect(result.ok && result.warnings.map((w) => w.code)).toContain('type.glyph_substituted');
  });

  it('la spec voyage entre styles : même spec, autre style, autre mise en page mesurée', () => {
    const a = must(visual(), ink);
    const b = must(visual(), signal);
    expect(a.spec.sha256).toBe(b.spec.sha256);
    expect(find<PlanTextNode>(b, 'tx_sky').lines[0]!.runs[0]!.text).toBe('ET SI LA');
    expect(find<PlanTextNode>(a, 'tx_sky').fit.size).not.toBe(find<PlanTextNode>(b, 'tx_sky').fit.size);
  });
});

describe('ajustement et cohérence typographique', () => {
  it('portée « role » : deux calques du même rôle partagent le plus petit rapport', () => {
    const spec = mustBuild(ink);
    // Même rôle pour les deux textes, mais le second est beaucoup plus long.
    const second = spec.scenes[1]!.layers[0]!;
    if (second.primitive !== 'text') throw new Error('texte attendu');
    second.content.runs[2]!.text = 'disparaissait donc ?';
    const plan = must(spec);
    const texts = plan.scenes.flatMap((s) => s.nodes).filter((n): n is PlanTextNode => n.type === 'text');
    expect(new Set(texts.map((t) => t.fit.role)).size).toBe(1);
    expect(new Set(texts.map((t) => t.fit.ratio)).size).toBe(1);

    const style = clone(loadInk());
    style.typography.fit.scope = 'layer';
    const perLayer = must(spec, mustResolve({ style }));
    const ratios = perLayer.scenes.flatMap((s) => s.nodes).filter((n): n is PlanTextNode => n.type === 'text').map((t) => t.fit.ratio);
    expect(new Set(ratios).size).toBe(2);
  });

  it('refuse un texte qui ne tient pas au plancher du style (erreur structurée, jamais de débordement)', () => {
    const spec = mustBuild(ink);
    const text = spec.scenes[0]!.layers[0]!;
    if (text.primitive !== 'text') throw new Error('texte attendu');
    text.content.runs[0]!.text = 'Anticonstitutionnellement';
    expect(codes(compile(spec))).toEqual(['layout.text_overflow']);
  });

  it('refuse un glyphe absent de la police, sans repli silencieux', () => {
    const spec = mustBuild(ink);
    const text = spec.scenes[0]!.layers[0]!;
    if (text.primitive !== 'text') throw new Error('texte attendu');
    text.content.runs[0]!.text = 'Chaque nuit 月';
    expect(codes(compile(spec))).toEqual(['type.missing_glyph']);
  });

  it('même rapport et mêmes coupures à 540 et 1080 px (positions × 2)', () => {
    const small = must(visual(), ink, { width: 540, height: 960, fps: 30 });
    const large = must(visual(), ink, { width: 1080, height: 1920, fps: 30 });
    for (const id of ['tx_sky', 'tx_tides']) {
      const s = find<PlanTextNode>(small, id);
      const l = find<PlanTextNode>(large, id);
      expect(l.fit.ratio).toBe(s.fit.ratio);
      expect(l.lines.map((x) => x.runs.map((r) => r.text))).toEqual(s.lines.map((x) => x.runs.map((r) => r.text)));
      expect(l.lines[0]!.baseline).toBeCloseTo(s.lines[0]!.baseline * 2, 6);
    }
  });
});

describe('zone sûre et placements', () => {
  it('refuse un tracé hors de la zone sûre', () => {
    const spec = visual();
    const wave = spec.scenes[1]!.layers[2]!;
    if (wave.primitive !== 'path' || !('points' in wave.geometry)) throw new Error('tracé attendu');
    wave.geometry.points[0] = { x: 0, y: 0 };
    wave.geometry.points[1] = { x: 0, y: 95 };
    expect(codes(compile(spec))).toEqual(['layout.safe_zone']);
  });

  it('refuse une région inconnue de l’asset, une image déclarée après, un double placement', () => {
    const unknown = visual();
    const title = unknown.scenes[0]!.layers[1]!;
    title.region = { layer: 'img_sky', name: 'sea' };
    expect(codes(validateSpec(unknown, ink, { patterns: loadFixturePatterns(), assets }))).toContain('asset.region_unknown');

    const order = visual();
    order.scenes[0]!.layers.reverse();
    expect(codes(validateSpec(order, ink, { patterns: loadFixturePatterns(), assets }))).toContain('layout.region_order');

    const twice = visual();
    twice.scenes[0]!.layers[1]!.slot = 'statement.primary';
    expect(codes(validateSpec(twice, ink, { patterns: loadFixturePatterns(), assets }))).toContain('layout.placement_conflict');
  });

  it('refuse deux contenus qui se chevauchent au repos (défaut réel, vu sur la planche SIGNAL)', () => {
    const spec = visual();
    const mask = spec.scenes[1]!.layers[0]!;
    // Vignette sur 5 rangées : avec la grille 6×12 de SIGNAL, elle mord sur le texte.
    mask.placement = { col: 2, col_span: 5, row: 1, row_span: 5 };
    const result = compile(spec, signal);
    expect(codes(result)).toEqual(['layout.collision']);
    expect(result.ok ? '' : result.issues.find((i) => i.code === 'layout.collision')!.message).toMatch(/msk_moon.*tx_tides/);
  });

  it('un chevauchement déclaré (texte posé dans la région d’une image) est permis', () => {
    const spec = visual();
    const image = spec.scenes[0]!.layers[0]!;
    if (image.primitive !== 'image') throw new Error('image attendue');
    // Image non plein cadre : elle compte comme contenu, mais le titre est posé DANS sa région.
    image.bleed = false;
    image.placement = { col: 1, col_span: 6, row: 1, row_span: 12 };
    expect(compile(spec).ok).toBe(true);
  });

  it('une région rognée par le recadrage n’est jamais inventée', () => {
    const spec = visual();
    const image = spec.scenes[0]!.layers[0]!;
    if (image.primitive !== 'image') throw new Error('image attendue');
    image.bleed = false;
    image.placement = { col: 1, col_span: 4, row: 12, row_span: 4 };
    image.focus = { region: 'moon', fill: true };
    expect(codes(compile(spec))).toEqual(['layout.region_unavailable']);
  });
});

describe('assets : vérifiés à la lecture', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'motion-asset-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const definition = readFixture('assets/night_moon.asset.json');

  it('lit les dimensions dans l’en-tête (PNG et JPEG)', () => {
    const png = readFileSync(path.join(FIXTURES, 'assets', 'night_moon.png'));
    expect(imageDimensions(png)).toEqual({ format: 'png', width: 720, height: 1280 });
    // En-tête JPEG minimal : SOI, APP0 (longueur 4), SOF0 (hauteur 300, largeur 200).
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x00, 0xc8, 0x03]);
    expect(imageDimensions(jpeg)).toEqual({ format: 'jpeg', width: 200, height: 300 });
    expect(() => imageDimensions(Uint8Array.from([1, 2, 3, 4]))).toThrowError();
  });

  it('refuse une empreinte ou des dimensions qui ne correspondent pas au fichier', () => {
    copyFileSync(path.join(FIXTURES, 'assets', 'night_moon.png'), path.join(dir, 'night_moon.png'));
    writeFileSync(path.join(dir, 'a.asset.json'), JSON.stringify({ ...definition, width: 721 }));
    expect(() => loadAssetFile(path.join(dir, 'a.asset.json'))).toThrowError(/dimensions 720×1280, déclarées 721×1280/);
    writeFileSync(path.join(dir, 'b.asset.json'), JSON.stringify({ ...definition, sha256: 'f'.repeat(64) }));
    expect(() => loadAssetFile(path.join(dir, 'b.asset.json'))).toThrowError(/empreinte/);
    writeFileSync(path.join(dir, 'c.asset.json'), JSON.stringify(definition));
    expect(loadAssetFile(path.join(dir, 'c.asset.json')).definition.id).toBe('night_moon');
  });
});

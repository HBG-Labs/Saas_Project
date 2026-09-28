import { describe, expect, it } from 'vitest';

import type { PlanImageNode, PlanMaskNode, PlanTextNode, RenderPlan } from '@motion-engine/core/runtime';

import { imageContentState, imageFilter, imageGeometry, lineState, maskRadius, nodeState, pathProgress, runState, sceneAt, unsupportedNodes } from './frame-state.ts';

// Plan écrit à la main : le renderer se teste sans le compilateur ni aucun style.
const text: PlanTextNode = {
  id: 'tx',
  type: 'text',
  box: { x: 10, y: 20, w: 300, h: 100 },
  origin: { x: 0.5, y: 0.5 },
  opacity: 1,
  align: 'start',
  lines: [
    { runs: [{ id: 'r0', text: 'A', font: 'f', weight: 700, size: 40, tracking_px: 0, color: '#111111', x: 0, width: 28, glyphs: [{ g: 1, cl: 0, x: 0, dx: 0, dy: 0 }] }], top: 0, height: 50, baseline: 38, measured_width: 28, ink: null },
    { runs: [{ id: 'r1', text: 'B', font: 'f', weight: 700, size: 40, tracking_px: 0, color: '#111111', x: 0, width: 28, glyphs: [{ g: 1, cl: 0, x: 0, dx: 0, dy: 0 }] }], top: 50, height: 50, baseline: 88, measured_width: 28, ink: null },
  ],
  fit: { role: 'display.m', ratio: 1, size: 40, policy: 'explicit' },
  ink: null,
  contrast: { category: 'large', required: 3, measured: 12, worst: { run: 'r0', line: 0, frame: 0 }, frames: 1, override: null },
  tracks: [
    { property: 'clip_top', target: { line: 0 }, keys: [{ frame: 0, value: 1 }, { frame: 10, value: 0 }], sources: ['bh_in'] },
    { property: 'translate_y', target: { line: 0 }, keys: [{ frame: 0, value: 20 }, { frame: 10, value: 0 }], sources: ['bh_in'] },
    { property: 'color', target: { run: 'r1' }, keys: [{ frame: 20, value: '#111111' }, { frame: 30, value: '#EE0000' }], sources: ['bh_accent'] },
    { property: 'scale', target: { run: 'r1' }, keys: [{ frame: 20, value: 1 }, { frame: 25, value: 1.1 }, { frame: 30, value: 1 }], sources: ['bh_accent'] },
    { property: 'opacity', keys: [{ frame: 40, value: 1 }, { frame: 50, value: 0 }], sources: ['bh_out'] },
  ],
};

const plan: RenderPlan = {
  schema: 'render-plan',
  schema_version: '0.5.0',
  spec: { spec_id: 's', revision: 1, sha256: 'a'.repeat(64) },
  style: { mode: 'creative', sha256: 'b'.repeat(64) },
  compiler_version: '0.5.0',
  composition: { portability: 'portable' },
  timing_source: 'none',
  reduced_motion: false,
  provenance: {
    behavior_registry: { version: '1.2.0', sha256: 'c'.repeat(64) },
    behaviors: [],
    visual: { readability_rules: '1.0.0', analysis_algorithm: '1.0.0', analyses: [] },
    typography: { rules: 'none@1.0.0', shaper: 'test', substitutions: [] },
  },
  canvas: { width: 540, height: 960, fps: 30, duration_frames: 60, safe_area: { x: 30, y: 60, w: 480, h: 780 } },
  fonts: [],
  assets: [],
  scenes: [
    { id: 'one', from: 0, to: 30, background: '#FFFFFF', nodes: [text], voice_only: [] },
    {
      id: 'two',
      from: 30,
      to: 60,
      background: '#000000',
      voice_only: [{ from: 45, to: 60 }],
      nodes: [
        {
          id: 'ln',
          type: 'path',
          box: { x: 0, y: 0, w: 100, h: 4 },
          origin: { x: 0.5, y: 0.5 },
          opacity: 1,
          d: 'M 0 2 L 100 2',
          stroke: { color: '#FF0000', width: 4, cap: 'butt' },
          tracks: [{ property: 'path_progress', keys: [{ frame: 30, value: 0 }, { frame: 40, value: 1 }], sources: ['bh_draw'] }],
        },
      ],
    },
  ],
};

describe('état d’un nœud à une frame', () => {
  it('rogne la ligne pendant la révélation, puis libère le rognage', () => {
    expect(lineState(text, 0, 0, 30).clipPath).toBe('inset(100% 0% 0% 0%)');
    expect(lineState(text, 0, 5, 30).translateY).toBe(10);
    expect(lineState(text, 0, 10, 30).clipPath).toBeUndefined();
    expect(lineState(text, 1, 0, 30).clipPath).toBeUndefined();
  });

  it('colore et fait respirer le run accentué', () => {
    expect(runState(text, 'r1', '#111111', 10, 30)).toEqual({ color: '#111111', scale: 1 });
    expect(runState(text, 'r1', '#111111', 25, 30).scale).toBeCloseTo(1.1);
    expect(runState(text, 'r1', '#111111', 30, 30)).toEqual({ color: '#EE0000', scale: 1 });
    expect(runState(text, 'r0', '#111111', 30, 30)).toEqual({ color: '#111111', scale: 1 });
  });

  it('applique les pistes de nœud (opacité) et l’origine de transformation', () => {
    expect(nodeState(text, 45, 30).opacity).toBeCloseTo(0.5);
    expect(nodeState(text, 0, 30).transformOrigin).toBe('50% 50%');
  });

  it('dessine un tracé progressivement', () => {
    const path = plan.scenes[1]!.nodes[0]!;
    expect(pathProgress(path, 30, 30)).toBe(0);
    expect(pathProgress(path, 35, 30)).toBeCloseTo(0.5);
    expect(pathProgress(path, 59, 30)).toBe(1);
  });

  it('choisit la scène active, frames de fin exclusives', () => {
    expect(sceneAt(plan, 29)?.id).toBe('one');
    expect(sceneAt(plan, 30)?.id).toBe('two');
    expect(sceneAt(plan, 60)).toBeUndefined();
  });

  it('sait dessiner toutes les primitives du plan (P1.4)', () => {
    expect(unsupportedNodes(plan)).toEqual([]);
    const withImage = structuredClone(plan);
    withImage.scenes[0]!.nodes.push(image, mask);
    expect(unsupportedNodes(withImage)).toEqual([]);
  });
});

const image: PlanImageNode = {
  id: 'img',
  type: 'image',
  box: { x: 100, y: 200, w: 300, h: 150 },
  origin: { x: 0.5, y: 0.5 },
  opacity: 1,
  tracks: [],
  asset: 'a',
  fit: 'cover',
  crop: { x: 50, y: 100, w: 600, h: 300 },
  focus: { x: 350, y: 250 },
  content_origin: { x: 0.5, y: 0.5 },
  regions: {},
  treatment: { grayscale: 1, contrast: 1.2, tint: null },
};
const mask: PlanMaskNode = {
  id: 'msk',
  type: 'mask',
  box: { x: 10, y: 10, w: 100, h: 100 },
  origin: { x: 0.5, y: 0.5 },
  opacity: 1,
  tracks: [],
  clip: { shape: 'ellipse', radius: 0 },
  children: [],
};

describe('images et masques : pure projection du plan', () => {
  it('projette le recadrage du plan dans la boîte, sans décider du cadrage', () => {
    // Recadrage 600×300 dessiné en 300×150 : facteur 0,5 ; origine décalée de −crop.
    expect(imageGeometry(image, { width: 1000, height: 800 })).toEqual({ left: -25, top: -50, width: 500, height: 400 });
  });

  it('P1.5 : transforme le CONTENU autour de l’origine du plan, sans décider ni trajectoire ni recadrage', () => {
    const moving: PlanImageNode = {
      ...image,
      content_origin: { x: 0.25, y: 0.75 },
      tracks: [
        { property: 'content_scale', keys: [{ frame: 0, value: 1 }, { frame: 10, value: 1.1 }], sources: ['bh'] },
        { property: 'content_x', keys: [{ frame: 0, value: 0 }, { frame: 10, value: -8 }], sources: ['bh'] },
      ],
    };
    expect(imageContentState(moving, 0, 30)).toEqual({ transform: 'translate(0px, 0px) scale(1)', transformOrigin: '25% 75%' });
    expect(imageContentState(moving, 10, 30)).toEqual({ transform: 'translate(-8px, 0px) scale(1.1)', transformOrigin: '25% 75%' });
  });

  it('P1.5 : rognage du nœud entier (clip_*) traduit en inset(), absent au repos', () => {
    const revealing: PlanImageNode = { ...image, tracks: [{ property: 'clip_top', keys: [{ frame: 0, value: 1 }, { frame: 10, value: 0 }], sources: ['bh'] }] };
    expect(nodeState(revealing, 0, 30).clipPath).toBe('inset(100% 0% 0% 0%)');
    expect(nodeState(revealing, 5, 30).clipPath).toBe('inset(50% 0% 0% 0%)');
    expect(nodeState(revealing, 10, 30).clipPath).toBeUndefined();
    expect(nodeState(image, 0, 30).clipPath).toBeUndefined();
  });

  it('traduit le traitement résolu en filtre, et la forme du masque en rayon', () => {
    expect(imageFilter(image)).toBe('grayscale(1) contrast(1.2)');
    expect(maskRadius(mask)).toBe('50%');
    expect(maskRadius({ ...mask, clip: { shape: 'rect', radius: 12 } })).toBe('12px');
  });
});

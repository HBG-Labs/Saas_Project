import { describe, expect, it } from 'vitest';

import type { PlanTextNode, RenderPlan } from '@motion-engine/core/runtime';

import { lineState, nodeState, pathProgress, runState, sceneAt, unsupportedNodes } from './frame-state.ts';

// Plan écrit à la main : le renderer se teste sans le compilateur ni aucun style.
const text: PlanTextNode = {
  id: 'tx',
  type: 'text',
  box: { x: 10, y: 20, w: 300, h: 100 },
  origin: { x: 0.5, y: 0.5 },
  opacity: 1,
  align: 'start',
  lines: [
    { runs: [{ id: 'r0', text: 'A', font: 'f', weight: 700, size: 40, tracking_px: 0, color: '#111111' }], top: 0, height: 50, measured_width: null },
    { runs: [{ id: 'r1', text: 'B', font: 'f', weight: 700, size: 40, tracking_px: 0, color: '#111111' }], top: 50, height: 50, measured_width: null },
  ],
  tracks: [
    { property: 'clip_top', target: { line: 0 }, keys: [{ frame: 0, value: 1 }, { frame: 10, value: 0 }], source: 'bh_in' },
    { property: 'translate_y', target: { line: 0 }, keys: [{ frame: 0, value: 20 }, { frame: 10, value: 0 }], source: 'bh_in' },
    { property: 'color', target: { run: 'r1' }, keys: [{ frame: 20, value: '#111111' }, { frame: 30, value: '#EE0000' }], source: 'bh_accent' },
    { property: 'scale', target: { run: 'r1' }, keys: [{ frame: 20, value: 1 }, { frame: 25, value: 1.1 }, { frame: 30, value: 1 }], source: 'bh_accent' },
    { property: 'opacity', keys: [{ frame: 40, value: 1 }, { frame: 50, value: 0 }], source: 'bh_out' },
  ],
};

const plan: RenderPlan = {
  schema: 'render-plan',
  schema_version: '0.1.0',
  spec: { spec_id: 's', revision: 1, sha256: 'a'.repeat(64) },
  style: { mode: 'creative', sha256: 'b'.repeat(64) },
  compiler_version: '0.1.0',
  canvas: { width: 540, height: 960, fps: 30, duration_frames: 60 },
  fonts: [],
  assets: [],
  scenes: [
    { id: 'one', from: 0, to: 30, background: '#FFFFFF', nodes: [text] },
    {
      id: 'two',
      from: 30,
      to: 60,
      background: '#000000',
      nodes: [
        {
          id: 'ln',
          type: 'path',
          box: { x: 0, y: 0, w: 100, h: 4 },
          origin: { x: 0.5, y: 0.5 },
          opacity: 1,
          d: 'M 0 2 L 100 2',
          stroke: { color: '#FF0000', width: 4, cap: 'butt' },
          tracks: [{ property: 'path_progress', keys: [{ frame: 30, value: 0 }, { frame: 40, value: 1 }], source: 'bh_draw' }],
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

  it('signale les primitives qu’il ne sait pas encore dessiner', () => {
    expect(unsupportedNodes(plan)).toEqual([]);
    const withImage = structuredClone(plan);
    withImage.scenes[0]!.nodes.push({ id: 'img', type: 'image', box: { x: 0, y: 0, w: 1, h: 1 }, origin: { x: 0, y: 0 }, opacity: 1, tracks: [], asset: 'a', fit: 'cover', crop: { x: 0, y: 0, w: 1, h: 1 } });
    expect(unsupportedNodes(withImage)).toEqual(['img (image)']);
  });
});

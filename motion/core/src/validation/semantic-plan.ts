import type { PlanNode, RenderPlan } from '../contracts/render-plan.ts';
import { IssueCollector } from './issues.ts';
import type { ValidationIssue } from './issues.ts';

export function validateRenderPlanSemantics(plan: RenderPlan): ValidationIssue[] {
  const c = new IssueCollector();
  const fonts = new Set(plan.fonts.map((f) => f.id));
  const assets = new Set(plan.assets.map((a) => a.ref));
  const ids = new Set<string>();

  let cursor = 0;
  plan.scenes.forEach((scene, si) => {
    const base = `scenes[${si}]`;
    if (scene.from !== cursor) c.error('plan.scene_gap', base, `la scène commence à ${scene.from}, attendu ${cursor}`);
    if (scene.to <= scene.from) c.error('plan.scene_empty', base, 'scène de durée nulle');
    let previousEnd = scene.from;
    scene.voice_only.forEach((interval, k) => {
      if (interval.from < previousEnd || interval.to <= interval.from || interval.to > scene.to) {
        c.error('plan.voice_only_range', `${base}.voice_only[${k}]`, `intervalle [${interval.from}, ${interval.to}) invalide ou hors de la scène`);
      }
      previousEnd = interval.to;
    });
    cursor = scene.to;
    const visit = (node: PlanNode, path: string) => {
      if (ids.has(node.id)) c.error('id.duplicate', path, `nœud « ${node.id} » en double`);
      ids.add(node.id);
      const seenTracks = new Set<string>();
      node.tracks.forEach((track, ti) => {
        const key = `${track.property}|${track.target?.run ?? ''}|${track.target?.line ?? ''}`;
        if (seenTracks.has(key)) c.error('plan.duplicate_track', `${path}.tracks[${ti}]`, `deux pistes pour ${track.property} sur la même cible`);
        seenTracks.add(key);
        const tpath = `${path}.tracks[${ti}]`;
        let previous = -1;
        for (const key of track.keys) {
          if (key.frame <= previous) c.error('track.order', tpath, 'clés non strictement croissantes');
          if (key.frame < scene.from || key.frame >= scene.to) {
            c.error('track.range', tpath, `clé ${key.frame} hors de la scène [${scene.from}, ${scene.to})`);
          }
          const isColor = typeof key.value === 'string';
          if (isColor !== (track.property === 'color')) {
            c.error('track.value_type', tpath, `valeur incompatible avec la propriété ${track.property}`);
          }
          previous = key.frame;
        }
      });
      if (node.type === 'text') {
        node.lines.forEach((line) =>
          line.runs.forEach((run) => {
            if (!fonts.has(run.font)) c.error('plan.unknown_font', path, `police « ${run.font} » non déclarée`);
          }),
        );
      }
      if (node.type === 'image' && !assets.has(node.asset)) {
        c.error('plan.unknown_asset', path, `asset « ${node.asset} » non déclaré`);
      }
      if (node.type === 'group' || node.type === 'mask') {
        node.children.forEach((child, i) => visit(child, `${path}.children[${i}]`));
      }
    };
    scene.nodes.forEach((node, ni) => visit(node, `${base}.nodes[${ni}]`));
  });
  if (cursor !== plan.canvas.duration_frames) {
    c.error('plan.duration', 'canvas.duration_frames', `durée ${plan.canvas.duration_frames}, scènes jusqu'à ${cursor}`);
  }
  return c.issues;
}

import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { Img } from 'remotion';

import type { PlanImageNode, PlanMaskNode, PlanNode, PlanPathNode, PlanShapeNode, PlanTextNode, RenderPlan } from '@motion-engine/core/runtime';

import { imageContentState, imageFilter, imageGeometry, lineState, maskRadius, nodeState, pathProgress, runState } from '../frame-state.ts';
import type { ImageSource } from './types.ts';
import { QC_PREFIX } from './types.ts';

interface NodeProps {
  node: PlanNode;
  plan: RenderPlan;
  images: readonly ImageSource[];
  frame: number;
}

const reported = new Set<string>();

function boxStyle(node: PlanNode, frame: number, fps: number): CSSProperties {
  const state = nodeState(node, frame, fps);
  return {
    position: 'absolute',
    left: node.box.x,
    top: node.box.y,
    width: node.box.w,
    height: node.box.h,
    opacity: state.opacity,
    transform: state.transform,
    transformOrigin: state.transformOrigin,
    clipPath: state.clipPath,
  };
}

/**
 * Tolérance du contrôle de largeur : le navigateur et le compilateur mettent
 * le texte en forme avec le même moteur (HarfBuzz) et la même police ; un
 * écart au-delà signale une police de repli ou une mise en forme divergente.
 */
const WIDTH_TOLERANCE = (planned: number) => Math.max(0.75, planned * 0.003);

function TextLine({ node, plan, frame, index }: { node: PlanTextNode; plan: RenderPlan; frame: number; index: number }) {
  const line = node.lines[index]!;
  const fps = plan.canvas.fps;
  const state = lineState(node, index, frame, fps);
  const refs = useRef<(SVGTextElement | null)[]>([]);

  // Contrôle qualité : le navigateur mesure ce qu'il dessine et le compare à la
  // mesure du compilateur. Il signale, il ne corrige jamais.
  useLayoutEffect(() => {
    line.runs.forEach((run, r) => {
      const el = refs.current[r];
      if (!el) return;
      const measured = el.getComputedTextLength();
      const key = `${node.id}:${index}:${r}`;
      if (Math.abs(measured - run.width) > WIDTH_TOLERANCE(run.width) && !reported.has(key)) {
        reported.add(key);
        console.warn(`${QC_PREFIX} text_width_mismatch node=${node.id} line=${index} run=${run.id} browser=${measured.toFixed(2)} plan=${run.width.toFixed(2)}`);
      }
    });
  });

  // Chaque run est posé à SA position mesurée, sur SA ligne de base : le
  // navigateur ne coupe, n'aligne ni ne place rien.
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: line.top,
        width: node.box.w,
        height: line.height,
        opacity: state.opacity,
        clipPath: state.clipPath,
      }}
    >
      <svg
        width={node.box.w}
        height={line.height}
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', transform: `translate(${state.translateX}px, ${state.translateY}px)` }}
      >
        {line.runs.map((run, r) => {
          const font = plan.fonts.find((f) => f.id === run.font);
          const rs = runState(node, run.id, run.color, frame, fps);
          return (
            <text
              key={`${run.id}:${r}`}
              ref={(el) => {
                refs.current[r] = el;
              }}
              x={run.x}
              y={line.baseline - line.top}
              style={{
                fontFamily: `"${font?.css_name ?? 'sans-serif'}"`,
                fontWeight: run.weight,
                fontSize: run.size,
                letterSpacing: run.tracking_px,
                fill: rs.color,
                whiteSpace: 'pre',
                fontKerning: 'normal',
                textRendering: 'geometricPrecision',
                transformBox: 'fill-box',
                transformOrigin: '50% 60%',
                transform: `scale(${rs.scale})`,
              }}
            >
              {run.text}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function TextNode({ node, plan, frame }: { node: PlanTextNode; plan: RenderPlan; frame: number }) {
  return (
    <div style={boxStyle(node, frame, plan.canvas.fps)}>
      {node.lines.map((_line, index) => (
        <TextLine key={index} node={node} plan={plan} frame={frame} index={index} />
      ))}
    </div>
  );
}

function PathNode({ node, plan, frame }: { node: PlanPathNode; plan: RenderPlan; frame: number }) {
  const progress = pathProgress(node, frame, plan.canvas.fps);
  return (
    <div style={boxStyle(node, frame, plan.canvas.fps)}>
      <svg width={node.box.w} height={node.box.h} style={{ overflow: 'visible', display: 'block', opacity: progress > 0 ? 1 : 0 }}>
        <path
          d={node.d}
          fill="none"
          stroke={node.stroke.color}
          strokeWidth={node.stroke.width}
          strokeLinecap={node.stroke.cap}
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - progress}
        />
      </svg>
    </div>
  );
}

function ShapeNode({ node, plan, frame }: { node: PlanShapeNode; plan: RenderPlan; frame: number }) {
  return (
    <div
      style={{
        ...boxStyle(node, frame, plan.canvas.fps),
        background: node.fill ?? 'transparent',
        borderRadius: node.shape === 'ellipse' ? '50%' : node.radius,
        border: node.stroke ? `${node.stroke.width}px solid ${node.stroke.color}` : undefined,
        boxSizing: 'border-box',
      }}
    />
  );
}

function ImageNode({ node, plan, images, frame }: { node: PlanImageNode; plan: RenderPlan; images: readonly ImageSource[]; frame: number }) {
  const asset = plan.assets.find((a) => a.ref === node.asset);
  const source = images.find((i) => i.asset === node.asset);
  if (!asset || !source) throw new Error(`Image « ${node.asset} » absente des sources fournies au renderer`);
  const g = imageGeometry(node, asset);
  const content = imageContentState(node, frame, plan.canvas.fps);
  return (
    <div style={{ ...boxStyle(node, frame, plan.canvas.fps), overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: content.transform, transformOrigin: content.transformOrigin }}>
        <Img
          src={source.data_url}
          style={{ position: 'absolute', left: g.left, top: g.top, width: g.width, height: g.height, maxWidth: 'none', filter: imageFilter(node) }}
        />
      </div>
      {node.treatment.tint ? (
        <div style={{ position: 'absolute', inset: 0, background: node.treatment.tint.color, opacity: node.treatment.tint.opacity }} />
      ) : null}
    </div>
  );
}

function MaskNode({ node, plan, images, frame }: { node: PlanMaskNode; plan: RenderPlan; images: readonly ImageSource[]; frame: number }) {
  // Les enfants sont en coordonnées absolues : le contenu est recalé sous la fenêtre du masque.
  return (
    <div style={{ ...boxStyle(node, frame, plan.canvas.fps), overflow: 'hidden', borderRadius: maskRadius(node) }}>
      <div style={{ position: 'absolute', left: -node.box.x, top: -node.box.y, width: plan.canvas.width, height: plan.canvas.height }}>
        {node.children.map((child) => (
          <NodeView key={child.id} node={child} plan={plan} images={images} frame={frame} />
        ))}
      </div>
    </div>
  );
}

export function NodeView({ node, plan, images, frame }: NodeProps) {
  switch (node.type) {
    case 'text':
      return <TextNode node={node} plan={plan} frame={frame} />;
    case 'path':
      return <PathNode node={node} plan={plan} frame={frame} />;
    case 'shape':
      return <ShapeNode node={node} plan={plan} frame={frame} />;
    case 'image':
      return <ImageNode node={node} plan={plan} images={images} frame={frame} />;
    case 'mask':
      return <MaskNode node={node} plan={plan} images={images} frame={frame} />;
    case 'group': {
      // Les boîtes du plan sont en coordonnées absolues : le groupe couvre tout
      // le canevas et transforme autour de sa propre boîte.
      const state = nodeState(node, frame, plan.canvas.fps);
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: state.opacity,
            transform: state.transform,
            transformOrigin: `${node.box.x + node.box.w * node.origin.x}px ${node.box.y + node.box.h * node.origin.y}px`,
          }}
        >
          {node.children.map((child) => (
            <NodeView key={child.id} node={child} plan={plan} images={images} frame={frame} />
          ))}
        </div>
      );
    }
  }
}

import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

import type { PlanNode, PlanPathNode, PlanShapeNode, PlanTextNode, RenderPlan } from '@motion-engine/core/runtime';

import { lineState, nodeState, pathProgress, runState } from '../frame-state.ts';
import { QC_PREFIX } from './types.ts';

interface NodeProps {
  node: PlanNode;
  plan: RenderPlan;
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
  };
}

const JUSTIFY = { start: 'left', center: 'center', end: 'right' } as const;

function TextLine({ node, plan, frame, index }: { node: PlanTextNode; plan: RenderPlan; frame: number; index: number }) {
  const line = node.lines[index]!;
  const fps = plan.canvas.fps;
  const state = lineState(node, index, frame, fps);
  const measured = useRef<HTMLSpanElement>(null);

  // Contrôle qualité : le compilateur ne mesure pas encore le texte (P1.4).
  // Le navigateur signale une ligne plus large que sa boîte ; il ne la corrige pas.
  useLayoutEffect(() => {
    const width = measured.current?.offsetWidth ?? 0;
    const key = `${node.id}:${index}`;
    if (width > node.box.w + 0.5 && !reported.has(key)) {
      reported.add(key);
      console.warn(`${QC_PREFIX} text_overflow node=${node.id} line=${index} width=${width.toFixed(1)} box=${node.box.w.toFixed(1)}`);
    }
  });

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
      <div
        style={{
          height: line.height,
          lineHeight: `${line.height}px`,
          whiteSpace: 'pre',
          textAlign: JUSTIFY[node.align],
          transform: `translate(${state.translateX}px, ${state.translateY}px)`,
        }}
      >
        <span ref={measured} style={{ display: 'inline-block' }}>
          {line.runs.map((run) => {
            const font = plan.fonts.find((f) => f.id === run.font);
            const r = runState(node, run.id, run.color, frame, fps);
            return (
              <span
                key={run.id}
                style={{
                  display: 'inline-block',
                  fontFamily: `"${font?.css_name ?? 'sans-serif'}"`,
                  fontWeight: run.weight,
                  fontSize: run.size,
                  letterSpacing: run.tracking_px,
                  color: r.color,
                  transform: `scale(${r.scale})`,
                  transformOrigin: '50% 60%',
                  fontKerning: 'normal',
                  textRendering: 'geometricPrecision',
                  WebkitFontSmoothing: 'antialiased',
                }}
              >
                {run.text}
              </span>
            );
          })}
        </span>
      </div>
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

export function NodeView({ node, plan, frame }: NodeProps) {
  switch (node.type) {
    case 'text':
      return <TextNode node={node} plan={plan} frame={frame} />;
    case 'path':
      return <PathNode node={node} plan={plan} frame={frame} />;
    case 'shape':
      return <ShapeNode node={node} plan={plan} frame={frame} />;
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
            <NodeView key={child.id} node={child} plan={plan} frame={frame} />
          ))}
        </div>
      );
    }
    case 'mask':
    case 'image':
      throw new Error(`Primitive « ${node.type} » non prise en charge par ce renderer (P1.2) : ${node.id}`);
  }
}

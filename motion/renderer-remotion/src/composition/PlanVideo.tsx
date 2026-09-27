import { useEffect, useState } from 'react';
import { AbsoluteFill, cancelRender, continueRender, delayRender, useCurrentFrame } from 'remotion';

import { sceneAt } from '../frame-state.ts';
import { NodeView } from './nodes.tsx';
import type { PlanVideoProps } from './types.ts';

/** Charge les polices du plan avant toute capture : aucune frame n'est rendue avec une police de repli. */
function useFonts(fonts: PlanVideoProps['fonts']) {
  const [handle] = useState(() => delayRender('Chargement des polices du Render Plan'));
  useEffect(() => {
    Promise.all(
      fonts.map(async (font) => {
        const face = new FontFace(font.css_name, `url(${font.data_url})`, { weight: String(font.weight), style: font.style });
        await face.load();
        document.fonts.add(face);
      }),
    )
      .then(() => continueRender(handle))
      .catch((error: unknown) => cancelRender(error));
  }, [fonts, handle]);
}

export function PlanVideo({ plan, fonts }: PlanVideoProps) {
  useFonts(fonts);
  const frame = useCurrentFrame();
  const scene = sceneAt(plan, frame);
  if (!scene) return <AbsoluteFill />;
  return (
    <AbsoluteFill style={{ background: scene.background, overflow: 'hidden' }}>
      {scene.nodes.map((node) => (
        <NodeView key={node.id} node={node} plan={plan} frame={frame} />
      ))}
    </AbsoluteFill>
  );
}

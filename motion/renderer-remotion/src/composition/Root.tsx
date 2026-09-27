import { Composition } from 'remotion';

import { PlanVideo } from './PlanVideo.tsx';
import { COMPOSITION_ID } from './types.ts';
import type { PlanVideoProps } from './types.ts';

// Plan vide par défaut : les vraies dimensions, cadence et durée viennent
// toujours du Render Plan passé en entrée (calculateMetadata).
const emptyProps: PlanVideoProps = {
  plan: {
    schema: 'render-plan',
    schema_version: '0.1.0',
    spec: { spec_id: 'empty', revision: 1, sha256: '0'.repeat(64) },
    style: { mode: 'creative', sha256: '0'.repeat(64) },
    compiler_version: '0.0.0',
    canvas: { width: 540, height: 960, fps: 30, duration_frames: 1 },
    fonts: [],
    assets: [],
    scenes: [{ id: 'empty', from: 0, to: 1, background: '#000000', nodes: [] }],
  },
  fonts: [],
  audio: null,
};

export function RemotionRoot() {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={PlanVideo}
      defaultProps={emptyProps}
      width={540}
      height={960}
      fps={30}
      durationInFrames={1}
      calculateMetadata={({ props }) => ({
        width: props.plan.canvas.width,
        height: props.plan.canvas.height,
        fps: props.plan.canvas.fps,
        durationInFrames: props.plan.canvas.duration_frames,
      })}
    />
  );
}

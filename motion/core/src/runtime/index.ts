// Point d'entrée « runtime » : utilisable dans un navigateur (aucun accès
// fichier, aucune dépendance). Les renderers n'importent que ceci et les types.

export { cubicBezier, evaluateEasing, springResponse } from './easing.ts';
export { mixColor, sampleProperty, sampleTrack } from './sample.ts';
export type { TrackTarget } from './sample.ts';

export type {
  Box,
  Keyframe,
  PlanGroupNode,
  PlanImageNode,
  PlanLine,
  PlanMaskNode,
  PlanNode,
  PlanPathNode,
  PlanRun,
  PlanScene,
  PlanShapeNode,
  PlanTextNode,
  RenderPlan,
  Track,
  TrackProperty,
} from '../contracts/render-plan.ts';
export type { Easing } from '../contracts/style-profile.ts';

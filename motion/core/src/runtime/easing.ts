import type { Easing } from '../contracts/style-profile.ts';

// Évaluation des courbes : mathématiques pures, déterministes, sans dépendance
// au navigateur ni à Node. Utilisées telles quelles par tous les renderers.

/** Courbe de Bézier cubique CSS (P0=(0,0), P3=(1,1)) : renvoie y pour x donné. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Newton, puis bissection si la pente est trop faible.
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-7) return sampleY(t);
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

/**
 * Réponse indicielle d'un ressort amorti (masse, raideur, amortissement),
 * de 0 vers 1, au temps `seconds`. Peut dépasser 1 (dépassement contrôlé).
 */
export function springResponse(spring: { damping: number; stiffness: number; mass: number }, seconds: number): number {
  const { damping: c, stiffness: k, mass: m } = spring;
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  const t = Math.max(0, seconds);
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  if (zeta === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const s = w0 * Math.sqrt(zeta * zeta - 1);
  const r1 = -zeta * w0 + s;
  const r2 = -zeta * w0 - s;
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

/**
 * Progression d'une courbe sur un intervalle : `t` ∈ [0, 1] de l'intervalle,
 * `intervalSeconds` sa durée réelle (utile aux ressorts). La fin d'intervalle
 * vaut toujours exactement 1 : la clé suivante est atteinte sans saut.
 */
export function evaluateEasing(easing: Easing | undefined, t: number, intervalSeconds: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (!easing || easing.type === 'linear') return t;
  if (easing.type === 'bezier') return cubicBezier(...easing.p)(t);
  const end = springResponse(easing, intervalSeconds);
  const value = springResponse(easing, t * intervalSeconds);
  // Normalisation : un ressort non stabilisé à la fin de l'intervalle rejoint quand même sa cible.
  return end === 0 ? t : value / end;
}

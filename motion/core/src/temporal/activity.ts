/**
 * Intervalles « voix seule » : la parole (estimée ou alignée) continue alors
 * qu'aucun comportement visuel n'est actif. Ce n'est PAS une phase : c'est une
 * annotation dérivée, calculée après placement, qui ne modifie ni les phases
 * ni aucun instant. Elle reste disponible pour un usage futur (sous-titres,
 * respiration visuelle, critique) sans toucher au modèle temporel.
 */
export interface Interval {
  start_ms: number;
  end_ms: number;
}

/** Union triée d'intervalles, fusionnant ceux qui se touchent. */
export function union(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals.filter((i) => i.end_ms > i.start_ms).sort((a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start_ms <= last.end_ms) last.end_ms = Math.max(last.end_ms, i.end_ms);
    else out.push({ ...i });
  }
  return out;
}

/** `from` privé de `minus`, en millisecondes entières. */
export function subtract(from: readonly Interval[], minus: readonly Interval[]): Interval[] {
  const holes = union(minus);
  const out: Interval[] = [];
  for (const base of union(from)) {
    let cursor = base.start_ms;
    for (const hole of holes) {
      if (hole.end_ms <= cursor || hole.start_ms >= base.end_ms) continue;
      if (hole.start_ms > cursor) out.push({ start_ms: cursor, end_ms: hole.start_ms });
      cursor = Math.max(cursor, hole.end_ms);
    }
    if (cursor < base.end_ms) out.push({ start_ms: cursor, end_ms: base.end_ms });
  }
  return out;
}

export function voiceOnlyIntervals(speech: readonly Interval[], visual: readonly Interval[]): Interval[] {
  return subtract(speech, visual);
}

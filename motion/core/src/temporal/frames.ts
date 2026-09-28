/**
 * Conversion unique millisecondes → frame : arrondi au plus proche, toujours
 * calculé depuis le temps ABSOLU. Les bornes de scène sont donc des fonctions
 * du temps absolu, pas des sommes de durées arrondies : aucune dérive ne
 * s'accumule d'une scène à l'autre.
 */
export function msToFrame(ms: number, fps: number): number {
  return Math.round((ms * fps) / 1000);
}

export class FrameError extends Error {
  readonly code = 'temporal.frame';
  constructor(message: string) {
    super(message);
    this.name = 'FrameError';
  }
}

/** Frames strictement croissantes, dans [from, to) ; une collision décale d'une frame. */
export function toSceneFrames(msList: readonly number[], fps: number, from: number, to: number): number[] {
  const out: number[] = [];
  let previous = from - 1;
  for (const ms of msList) {
    let frame = Math.min(to - 1, Math.max(from, msToFrame(ms, fps)));
    if (frame <= previous) frame = previous + 1;
    if (frame >= to) throw new FrameError(`clé à la frame ${frame} hors de la scène [${from}, ${to}) : scène trop courte pour ${fps} fps`);
    out.push(frame);
    previous = frame;
  }
  return out;
}

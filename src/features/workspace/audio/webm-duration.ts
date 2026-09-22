import fixWebmDuration from 'fix-webm-duration';

/*
  `MediaRecorder` écrit un WebM « en flux » : l'en-tête ne porte pas de durée.
  Les lecteurs affichent alors n'importe quoi (« 9:02 » pour 14 secondes — cas
  vécu le 21/09/2026). On inscrit la durée que l'on a mesurée nous-mêmes
  avant l'envoi. Sur un fichier qui n'est pas un WebM, ou en cas d'échec,
  l'audio part tel quel : ce n'est qu'un confort d'affichage, jamais une
  raison de perdre un enregistrement.
*/

export type DurationFixer = (audio: Blob, durationMs: number) => Promise<Blob>;

export const fixDuration: DurationFixer = async (audio, durationMs) => {
  if (!audio.type.startsWith('audio/webm') && !audio.type.startsWith('video/webm')) return audio;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return audio;
  try {
    const corrige = await fixWebmDuration(audio, Math.round(durationMs), { logger: false });
    return corrige.size > 0 ? corrige : audio;
  } catch {
    return audio;
  }
};

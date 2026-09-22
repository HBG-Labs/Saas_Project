import fixWebmDuration from 'fix-webm-duration';

/*
  `MediaRecorder` écrit un WebM « en flux » : l'en-tête ne porte pas de durée.
  Les lecteurs affichent alors n'importe quoi (« 9:02 » pour 14 secondes — cas
  vécu le 21/09/2026). On inscrit la durée que l'on a mesurée nous-mêmes —
  UNIQUEMENT sur la copie que le navigateur télécharge pour le lecteur.
  Jamais sur le fichier envoyé : réécrit avant l'envoi, le WebM de Chrome
  Android est devenu illisible pour OpenAI (« Audio file might be corrupted »,
  22/09/2026). Ce n'est qu'un confort d'affichage.
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

/**
 * L'URL à donner au lecteur : le fichier téléchargé, la durée inscrite, en
 * URL locale. En cas d'échec, l'URL signée telle quelle (durée fausse, son
 * juste). `fetchImpl` injecté pour les tests.
 */
export async function playableUrl(
  signedUrl: string,
  durationSeconds: number,
  fetchImpl: typeof fetch = fetch,
  fixer: DurationFixer = fixDuration,
): Promise<string> {
  try {
    const response = await fetchImpl(signedUrl);
    if (!response.ok) return signedUrl;
    const audio = await response.blob();
    const corrige = await fixer(audio, durationSeconds * 1000);
    return URL.createObjectURL(corrige);
  } catch {
    return signedUrl;
  }
}

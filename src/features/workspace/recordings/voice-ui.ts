/** Helpers purs et partageables de l'interface REZO Voice. */
export function formatRecordingDuration(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function countTranscriptWords(value: string | null): number | null {
  if (!value?.trim()) return null;
  return value.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

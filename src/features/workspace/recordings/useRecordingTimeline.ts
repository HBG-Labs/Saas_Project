import { useMemo } from 'react';

import type { WorkspaceRecording } from '../api/workspace.api';
import { buildTimeline, type RecorderSnapshot, type TimelineItem } from './timeline';

/**
 * La frise prête à rendre : la capture en cours, ce qui attend sur
 * l'appareil, ce que le serveur connaît — une seule liste, du plus récent au
 * plus ancien. `recorder` est le retour de `useAudioRecorder` ;
 * `recordings` celui de `useRecordings(pageId).data`.
 */
export function useRecordingTimeline(
  recorder: RecorderSnapshot,
  recordings: readonly WorkspaceRecording[] | undefined,
): TimelineItem[] {
  const { status, elapsedSeconds, progress, error, notes, pending, current } = recorder;
  return useMemo(
    () =>
      buildTimeline(
        { status, elapsedSeconds, progress, error, notes, pending, current },
        recordings ?? [],
      ),
    [status, elapsedSeconds, progress, error, notes, pending, current, recordings],
  );
}

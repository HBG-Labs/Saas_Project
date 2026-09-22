import type {
  NormalizationChange,
  RecordingSegment,
  RecordingSummary,
  RecordingSummaryItem,
  WorkspaceRecordingStatus,
} from '@/types/database';

import type { WorkspaceRecording } from '../api/workspace.api';
import type { AudioRecorderStatus, PendingRecording } from '../hooks/useAudioRecorder';

/*
  La frise d'un enregistrement, du micro à la page — STT phase 10.

  Deux mondes se succèdent : l'appareil (capture, sauvegarde locale, envoi)
  puis le serveur (file, transcription, page). L'écran ne doit pas avoir à
  le savoir : ici, une seule suite de phases, un seul libellé par phase, un
  seul ordre pour une barre d'étapes, et une seule liste qui fusionne ce qui
  est encore sur l'appareil et ce que le serveur connaît. Tout est pur : le
  hook `useRecordingTimeline` ne fait qu'appeler `buildTimeline`.

  Nuance assumée : « résumé en cours » n'existe pas — le worker transcrit et
  résume dans la même passe, sans écriture intermédiaire. Afficher une étape
  qu'on ne mesure pas serait un mensonge ; `transcribing` couvre les deux.
*/

export type RecordingPhase =
  // Sur l'appareil.
  | 'recording'
  | 'paused'
  | 'saving'
  | 'uploading'
  | 'submitting'
  /** Capture retrouvée après une fermeture : l'audio est là, l'envoi n'a pas eu lieu. */
  | 'interrupted'
  /** Prêt sur l'appareil, pas encore envoyé (hors ligne, échec réseau) : repartira. */
  | 'waiting'
  // Sur le serveur.
  | 'queued'
  | 'transcribing'
  | 'done'
  | 'failed';

export const PHASE_LABELS: Record<RecordingPhase, string> = {
  recording: 'Enregistrement',
  paused: 'En pause',
  saving: 'Sauvegarde sur l’appareil',
  uploading: 'Envoi de l’audio',
  submitting: 'Confirmation',
  interrupted: 'Interrompu — audio conservé',
  waiting: 'En attente d’envoi',
  queued: 'En file pour la transcription',
  transcribing: 'Transcription et résumé en cours',
  done: 'Terminé',
  failed: 'Échec',
};

/** Les étapes d'une barre de progression, dans l'ordre. `paused`, `interrupted`, `waiting`, `failed` s'y projettent. */
export const PHASE_STEPS = [
  'recording',
  'saving',
  'uploading',
  'queued',
  'transcribing',
  'done',
] as const;
export type PhaseStep = (typeof PHASE_STEPS)[number];

/** L'étape (0 → 5) où se trouve une phase ; les états latéraux se rangent à l'étape qu'ils bloquent. */
export function stepOf(phase: RecordingPhase): number {
  const projection: Record<RecordingPhase, PhaseStep> = {
    recording: 'recording',
    paused: 'recording',
    saving: 'saving',
    uploading: 'uploading',
    submitting: 'uploading',
    interrupted: 'saving',
    waiting: 'uploading',
    queued: 'queued',
    transcribing: 'transcribing',
    done: 'done',
    failed: 'transcribing',
  };
  return PHASE_STEPS.indexOf(projection[phase]);
}

export const isTerminal = (phase: RecordingPhase): boolean =>
  phase === 'done' || phase === 'failed';

/** La phase de la capture en cours ; `null` quand rien n'est en cours (idle, done, error…). */
export function localPhase(status: AudioRecorderStatus): RecordingPhase | null {
  switch (status) {
    case 'recording':
    case 'paused':
    case 'saving':
    case 'uploading':
    case 'submitting':
      return status;
    default:
      return null;
  }
}

export function pendingPhase(p: PendingRecording): RecordingPhase {
  if (p.interrupted) return 'interrupted';
  if (p.status === 'uploading' || p.status === 'uploaded') return 'uploading';
  return 'waiting';
}

const PHASE_PAR_STATUT: Record<WorkspaceRecordingStatus, RecordingPhase> = {
  uploading: 'uploading',
  pending: 'queued',
  processing: 'transcribing',
  done: 'done',
  failed: 'failed',
};

export function serverPhase(r: Pick<WorkspaceRecording, 'status'>): RecordingPhase {
  return PHASE_PAR_STATUT[r.status];
}

export interface TimelineItem {
  /** Stable : la clé locale, ou l'id serveur. */
  key: string;
  source: 'local' | 'server';
  phase: RecordingPhase;
  label: string;
  step: number;
  title: string;
  startedAt: string;
  durationSeconds: number;
  /** Progression de l'envoi (0 → 1) quand elle est connue. */
  progress: number | null;
  error: string | null;
  notes: string | null;
  /** Ce que l'écran peut proposer sur cet élément. */
  can: { retry: boolean; discard: boolean; delete: boolean; editNotes: boolean };
  local?: PendingRecording;
  recording?: WorkspaceRecording;
}

export interface RecorderSnapshot {
  status: AudioRecorderStatus;
  elapsedSeconds: number;
  progress: number | null;
  error: string | null;
  notes: string;
  pending: readonly PendingRecording[];
  /** La capture en cours, telle que le hook la connaît. */
  current: { key: string; title: string; startedAt: string } | null;
}

/**
 * Une seule liste, du plus récent au plus ancien : la capture en cours en
 * tête, puis ce qui attend sur l'appareil, puis ce que le serveur connaît.
 * Un même enregistrement n'apparaît qu'une fois : tant que sa copie locale
 * existe (jusqu'à la soumission confirmée), c'est elle qui parle.
 */
export function buildTimeline(
  recorder: RecorderSnapshot,
  recordings: readonly WorkspaceRecording[],
): TimelineItem[] {
  const items: TimelineItem[] = [];
  const phaseCourante = localPhase(recorder.status);
  if (phaseCourante && recorder.current) {
    items.push({
      key: recorder.current.key,
      source: 'local',
      phase: phaseCourante,
      label: PHASE_LABELS[phaseCourante],
      step: stepOf(phaseCourante),
      title: recorder.current.title,
      startedAt: recorder.current.startedAt,
      durationSeconds: recorder.elapsedSeconds,
      progress: phaseCourante === 'uploading' ? recorder.progress : null,
      error: recorder.error,
      notes: recorder.notes.length > 0 ? recorder.notes : null,
      can: { retry: false, discard: false, delete: false, editNotes: true },
    });
  }

  const idsLocaux = new Set<string>();
  for (const p of recorder.pending) {
    if (p.key === recorder.current?.key) continue;
    if (p.serverRecordingId) idsLocaux.add(p.serverRecordingId);
    const phase = pendingPhase(p);
    items.push({
      key: p.key,
      source: 'local',
      phase,
      label: PHASE_LABELS[phase],
      step: stepOf(phase),
      title: p.title,
      startedAt: p.startedAt,
      durationSeconds: p.durationSeconds,
      progress: null,
      error: p.lastError ?? null,
      notes: p.notes && p.notes.length > 0 ? p.notes : null,
      can: { retry: true, discard: true, delete: false, editNotes: false },
      local: p,
    });
  }

  for (const r of recordings) {
    if (idsLocaux.has(r.id)) continue; // la copie locale parle encore
    const phase = serverPhase(r);
    items.push({
      key: r.id,
      source: 'server',
      phase,
      label: PHASE_LABELS[phase],
      step: stepOf(phase),
      title: r.title,
      startedAt: r.created_at,
      durationSeconds: r.duration_seconds,
      progress: null,
      error: phase === 'failed' ? r.error : null,
      notes: r.notes,
      can: { retry: false, discard: false, delete: true, editNotes: true },
      recording: r,
    });
  }

  // La capture en cours reste en tête ; le reste du plus récent au plus ancien.
  const tete = items.slice(0, phaseCourante && recorder.current ? 1 : 0);
  const reste = items.slice(tete.length).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return [...tete, ...reste];
}

// ─── Les vues d'un enregistrement terminé ────────────────────────────────────

export interface RecordingViews {
  summary: {
    /** Le résumé structuré et cité (v2) ; `null` en legacy ou si le modèle n'a pas rendu la forme. */
    structured: RecordingSummary | null;
    /** Le Markdown de la page — toujours là quand un résumé existe. */
    markdown: string | null;
  };
  notes: string | null;
  transcript: {
    /** Les paragraphes numérotés (v2) ; en legacy, le texte entier en un seul paragraphe. */
    segments: RecordingSegment[];
    text: string | null;
  };
  /** Le brut du moteur et ce qui a été corrigé pour arriver au texte — vérifiable. */
  raw: {
    text: string | null;
    normalized: boolean;
    changes: NormalizationChange[];
  };
  /** Le brouillon du direct (phase 14) : à montrer, marqué « brouillon », quand la finale manque. */
  live: { text: string | null; used: boolean };
}

export function recordingViews(r: WorkspaceRecording): RecordingViews {
  const segments =
    r.segments && r.segments.length > 0
      ? r.segments
      : r.transcript
        ? [{ id: 's1', start: null, end: null, speaker: null, text: r.transcript }]
        : [];
  return {
    summary: { structured: r.summary_json, markdown: r.summary },
    notes: r.notes,
    transcript: { segments, text: r.transcript },
    raw: {
      text: r.transcript_raw,
      normalized: r.transcript_normalized_at !== null,
      changes: r.normalization_diff ?? [],
    },
    live: { text: r.transcript_live, used: r.live_used },
  };
}

/** Les paragraphes qu'un élément du résumé cite, dans l'ordre du texte ; les renvois inconnus sont ignorés. */
export function citedSegments(
  item: Pick<RecordingSummaryItem, 'citations'>,
  segments: readonly RecordingSegment[],
): RecordingSegment[] {
  const voulus = new Set(item.citations);
  return segments.filter((s) => voulus.has(s.id));
}

/** « s3 » → « §3 » : le numéro lisible d'un paragraphe. */
export const segmentLabel = (id: string): string => `§${id.replace(/^s/u, '')}`;

import { describe, expect, it } from 'vitest';

import type { WorkspaceRecording } from '../api/workspace.api';
import type { PendingRecording } from '../hooks/useAudioRecorder';
import {
  PHASE_LABELS,
  PHASE_STEPS,
  buildTimeline,
  citedSegments,
  localPhase,
  pendingPhase,
  recordingViews,
  segmentLabel,
  serverPhase,
  stepOf,
  type RecorderSnapshot,
  type RecordingPhase,
} from './timeline';

/*
  Ce qui est vérifié : une seule frise, du micro à la page ; chaque phase a
  un libellé et une étape ; un même enregistrement n'apparaît qu'une fois ;
  les vues d'un enregistrement terminé tiennent en legacy comme en v2.
*/

const repos: RecorderSnapshot = {
  status: 'idle',
  elapsedSeconds: 0,
  progress: null,
  error: null,
  notes: '',
  pending: [],
  current: null,
};

const pending = (p: Partial<PendingRecording>): PendingRecording => ({
  key: 'k',
  organizationId: 'org',
  pageId: 'page',
  mimeType: 'audio/webm',
  title: 'Local',
  startedAt: '2026-09-21T10:00:00Z',
  durationSeconds: 30,
  chunkCount: 3,
  consentConfirmedAt: '2026-09-21T10:00:00Z',
  status: 'ready',
  updatedAt: '2026-09-21T10:00:30Z',
  interrupted: false,
  ...p,
});

const serveur = (r: Partial<WorkspaceRecording>): WorkspaceRecording => ({
  id: 'srv',
  organization_id: 'org',
  page_id: 'page',
  created_by: 'u',
  title: 'Serveur',
  audio_path: 'org/page/a.webm',
  mime_type: 'audio/webm',
  size_bytes: 1000,
  duration_seconds: 90,
  language: 'fr',
  status: 'done',
  transcript: 'La PTO est posée.',
  summary: '## Points clés\n- PTO posée [§1]',
  error: null,
  consent_confirmed_at: '2026-09-21T09:00:00Z',
  attempts: 1,
  next_attempt_at: '2026-09-21T09:00:00Z',
  locked_at: null,
  transcribed_at: '2026-09-21T09:05:00Z',
  audio_deleted_at: null,
  engine: 'gpt-transcribe',
  transcript_raw: 'La pto est posée.',
  transcript_normalized_at: '2026-09-21T09:05:00Z',
  normalization_diff: [{ de: 'pto', vers: 'PTO', occurrences: 1, couche: 'orthographe' }],
  segments: [{ id: 's1', start: null, end: null, speaker: null, text: 'La PTO est posée.' }],
  summary_json: {
    version: 1,
    points_cles: [{ texte: 'PTO posée', citations: ['s1', 's9'] }],
    decisions: [],
    actions: [],
  },
  notes: null,
  transcript_live: null,
  live_used: false,
  created_at: '2026-09-21T09:00:00Z',
  updated_at: '2026-09-21T09:05:00Z',
  ...r,
});

describe('phases', () => {
  it('chaque phase a un libellé et une étape dans la barre', () => {
    const toutes = Object.keys(PHASE_LABELS) as RecordingPhase[];
    for (const phase of toutes) {
      expect(PHASE_LABELS[phase].length).toBeGreaterThan(0);
      expect(stepOf(phase)).toBeGreaterThanOrEqual(0);
      expect(stepOf(phase)).toBeLessThan(PHASE_STEPS.length);
    }
    expect(stepOf('recording')).toBe(0);
    expect(stepOf('paused')).toBe(0);
    expect(stepOf('interrupted')).toBe(stepOf('saving'));
    expect(stepOf('waiting')).toBe(stepOf('uploading'));
    expect(stepOf('done')).toBe(PHASE_STEPS.length - 1);
  });

  it('les statuts du hook et du serveur se projettent sur la même suite', () => {
    expect(localPhase('recording')).toBe('recording');
    expect(localPhase('submitting')).toBe('submitting');
    expect(localPhase('idle')).toBeNull();
    expect(localPhase('done')).toBeNull();
    expect(localPhase('error')).toBeNull();
    expect(pendingPhase(pending({ interrupted: true, status: 'recording' }))).toBe('interrupted');
    expect(pendingPhase(pending({ status: 'uploading' }))).toBe('uploading');
    expect(pendingPhase(pending({ status: 'ready' }))).toBe('waiting');
    expect(serverPhase({ status: 'pending' })).toBe('queued');
    expect(serverPhase({ status: 'processing' })).toBe('transcribing');
    expect(serverPhase({ status: 'failed' })).toBe('failed');
  });
});

describe('buildTimeline', () => {
  it('la capture en cours est en tête, avec ses notes et sa progression', () => {
    const items = buildTimeline(
      {
        ...repos,
        status: 'uploading',
        elapsedSeconds: 12,
        progress: 0.4,
        notes: 'PTO au salon',
        current: { key: 'c', title: 'En cours', startedAt: '2026-09-21T11:00:00Z' },
      },
      [serveur({})],
    );
    expect(items.map((i) => i.key)).toEqual(['c', 'srv']);
    expect(items[0]).toMatchObject({
      source: 'local',
      phase: 'uploading',
      label: PHASE_LABELS.uploading,
      durationSeconds: 12,
      progress: 0.4,
      notes: 'PTO au salon',
      can: { editNotes: true, retry: false, discard: false, delete: false },
    });
  });

  it('un enregistrement dont la copie locale existe encore n’apparaît qu’une fois — la locale', () => {
    const items = buildTimeline(
      {
        ...repos,
        pending: [
          pending({ key: 'l', status: 'uploaded', serverRecordingId: 'srv', lastError: 'coupure' }),
        ],
      },
      [
        serveur({ id: 'srv', status: 'uploading' }),
        serveur({ id: 'autre', created_at: '2026-09-20T09:00:00Z' }),
      ],
    );
    expect(items.map((i) => i.key)).toEqual(['l', 'autre']);
    expect(items[0]).toMatchObject({
      phase: 'uploading',
      error: 'coupure',
      can: { retry: true, discard: true },
    });
  });

  it('du plus récent au plus ancien, quelle que soit la source', () => {
    const items = buildTimeline(
      {
        ...repos,
        pending: [pending({ key: 'vieux', startedAt: '2026-09-19T10:00:00Z', interrupted: true })],
      },
      [serveur({ id: 'recent', created_at: '2026-09-21T09:00:00Z' })],
    );
    expect(items.map((i) => i.key)).toEqual(['recent', 'vieux']);
    expect(items[1]).toMatchObject({ phase: 'interrupted', label: PHASE_LABELS.interrupted });
  });

  it('en erreur d’envoi, rien en tête : c’est l’élément local en attente qui porte l’erreur', () => {
    const items = buildTimeline(
      {
        ...repos,
        status: 'error',
        error: 'Envoi impossible.',
        pending: [pending({ key: 'k', lastError: 'Envoi impossible.' })],
      },
      [],
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: 'k', phase: 'waiting', error: 'Envoi impossible.' });
  });

  it('une ligne serveur en échec porte son motif ; terminée, non', () => {
    const items = buildTimeline(repos, [
      serveur({ id: 'ko', status: 'failed', error: 'Quota épuisé' }),
      serveur({ id: 'ok', error: 'vieux motif', created_at: '2026-09-20T09:00:00Z' }),
    ]);
    expect(items[0]).toMatchObject({
      phase: 'failed',
      error: 'Quota épuisé',
      can: { delete: true },
    });
    expect(items[1]).toMatchObject({ phase: 'done', error: null });
  });
});

describe('vues d’un enregistrement', () => {
  it('v2 : résumé structuré, paragraphes, brut et corrections', () => {
    const v = recordingViews(serveur({ notes: 'Karim jeudi' }));
    expect(v.summary.structured?.points_cles[0]?.texte).toBe('PTO posée');
    expect(v.summary.markdown).toContain('[§1]');
    expect(v.notes).toBe('Karim jeudi');
    expect(v.transcript.segments.map((s) => s.id)).toEqual(['s1']);
    expect(v.raw).toEqual({
      text: 'La pto est posée.',
      normalized: true,
      changes: [{ de: 'pto', vers: 'PTO', occurrences: 1, couche: 'orthographe' }],
    });
  });

  it('legacy : le texte entier devient un seul paragraphe, rien de structuré, brut = texte', () => {
    const v = recordingViews(
      serveur({
        segments: null,
        summary_json: null,
        transcript_raw: 'La PTO est posée.',
        transcript_normalized_at: null,
        normalization_diff: null,
        summary: '- PTO posée',
      }),
    );
    expect(v.summary.structured).toBeNull();
    expect(v.summary.markdown).toBe('- PTO posée');
    expect(v.transcript.segments).toEqual([
      { id: 's1', start: null, end: null, speaker: null, text: 'La PTO est posée.' },
    ]);
    expect(v.raw).toEqual({ text: 'La PTO est posée.', normalized: false, changes: [] });
    expect(v.live).toEqual({ text: null, used: false });
  });

  it('en échec de la finale, le brouillon du direct reste à montrer', () => {
    const v = recordingViews(
      serveur({
        status: 'failed',
        transcript: null,
        transcript_raw: null,
        segments: null,
        summary_json: null,
        summary: null,
        transcript_live: 'la pto est posée au salon',
        live_used: true,
      }),
    );
    expect(v.transcript.segments).toEqual([]);
    expect(v.live).toEqual({ text: 'la pto est posée au salon', used: true });
  });

  it('les citations résolvent vers les paragraphes existants, les inconnues sont ignorées', () => {
    const r = serveur({});
    const cites = citedSegments(r.summary_json!.points_cles[0]!, r.segments!);
    expect(cites.map((s) => s.id)).toEqual(['s1']);
    expect(segmentLabel('s12')).toBe('§12');
  });
});

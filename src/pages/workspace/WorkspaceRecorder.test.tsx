import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkspacePage, WorkspaceRecording } from '@/features/workspace';

import { WorkspaceRecorder } from './WorkspaceRecorder';

const mocks = vi.hoisted(() => ({
  recordings: [] as WorkspaceRecording[],
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  retryTranscription: vi.fn(),
  recorder: {
    status: 'idle',
    elapsedSeconds: 0,
    progress: null as number | null,
    error: null as string | null,
    durable: true,
    pending: [],
    notes: '',
    setNotes: vi.fn(),
    current: null,
    level: null as number | null,
    signal: 'unknown',
    live: { status: 'off', text: '' },
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    retry: vi.fn(),
    discard: vi.fn(),
  },
}));

vi.mock('@/features/workspace', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/workspace')>();
  return {
    ...actual,
    createRecordingRow: vi.fn(),
    fetchLiveToken: vi.fn(),
    submitRecording: vi.fn(),
    updateRecordingNotes: vi.fn(),
    useAudioRecorder: () => mocks.recorder,
    useRecordings: () => ({ data: mocks.recordings }),
    useTranscriptionQuota: () => ({ data: { unlimited: false, remaining_minutes: 37 } }),
    useRecordingTimeline: () => [],
    useRenameRecording: () => ({ isPending: false, mutate: vi.fn() }),
    useRetryRecordingTranscription: () => ({
      isPending: false,
      mutate: mocks.retryTranscription,
    }),
    useDeleteRecording: () => ({ isPending: false, mutate: vi.fn() }),
    useRecordingAudioUrl: () => ({ isLoading: false, data: null }),
  };
});

const page = {
  id: 'page-1',
  organization_id: 'org-1',
} as WorkspacePage;

function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

function renderRecorder() {
  return render(<WorkspaceRecorder page={page} />, { wrapper: Wrapper });
}

function recording(patch: Partial<WorkspaceRecording> = {}): WorkspaceRecording {
  return {
    id: 'rec-1',
    organization_id: 'org-1',
    page_id: 'page-1',
    created_by: 'user-1',
    title: 'Visite terrain',
    audio_path: 'org-1/page-1/note.webm',
    mime_type: 'audio/webm',
    size_bytes: 1200,
    duration_seconds: 138,
    language: 'fr',
    status: 'pending',
    transcript: null,
    summary: null,
    error: null,
    consent_confirmed_at: '2026-09-23T10:00:00.000Z',
    attempts: 0,
    next_attempt_at: '2026-09-23T10:00:00.000Z',
    locked_at: null,
    transcribed_at: null,
    audio_deleted_at: null,
    engine: null,
    transcript_raw: null,
    transcript_normalized_at: null,
    normalization_diff: null,
    segments: null,
    summary_json: null,
    notes: null,
    transcript_live: null,
    live_used: false,
    created_at: '2026-09-23T10:00:00.000Z',
    updated_at: '2026-09-23T10:00:00.000Z',
    ...patch,
  };
}

describe('REZO Voice dans le Workspace', () => {
  beforeEach(() => {
    mocks.recordings = [];
    mocks.retryTranscription.mockReset();
    Object.assign(mocks.recorder, {
      status: 'idle',
      elapsedSeconds: 0,
      progress: null,
      error: null,
      pending: [],
      notes: '',
      current: null,
      level: null,
      signal: 'unknown',
      live: { status: 'off', text: '' },
    });
    for (const action of [
      mocks.recorder.start,
      mocks.recorder.pause,
      mocks.recorder.resume,
      mocks.recorder.stop,
      mocks.recorder.cancel,
    ]) {
      action.mockReset();
    }
  });

  it('présente une action explicite et exige le consentement avant de démarrer', async () => {
    const user = userEvent.setup();
    renderRecorder();

    const start = screen.getByRole('button', { name: 'Enregistrer une note vocale' });
    expect(start).toBeDisabled();
    expect(start).toHaveClass('min-h-11');

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Les personnes enregistrées sont informées et d’accord.',
      }),
    );
    await user.click(start);

    expect(mocks.recorder.start).toHaveBeenCalledWith(
      expect.objectContaining({ consentConfirmed: true }),
    );
  });

  it('garde un Voice Dock tactile et accessible pendant la capture', async () => {
    const user = userEvent.setup();
    Object.assign(mocks.recorder, {
      status: 'recording',
      elapsedSeconds: 42,
      level: 0.08,
      current: { key: 'local-1' },
    });
    const view = renderRecorder();

    expect(screen.getByText('Enregistrement en cours')).toBeInTheDocument();
    expect(screen.getByText('00:42')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Niveau sonore du microphone' })).toBeInTheDocument();
    expect(screen.getByLabelText('REZO Voice')).toHaveClass(
      'fixed',
      'bottom-[calc(4.75rem+var(--safe-bottom))]',
    );

    await user.click(screen.getByRole('button', { name: 'Mettre l’enregistrement en pause' }));
    Object.assign(mocks.recorder, { status: 'paused' });
    view.rerender(<WorkspaceRecorder page={page} />);
    await user.click(screen.getByRole('button', { name: 'Reprendre l’enregistrement' }));
    await user.click(screen.getByRole('button', { name: 'Terminer l’enregistrement' }));
    expect(mocks.recorder.pause).toHaveBeenCalledOnce();
    expect(mocks.recorder.resume).toHaveBeenCalledOnce();
    expect(mocks.recorder.stop).toHaveBeenCalledOnce();
  });

  it('n’invente pas de progression pendant l’envoi', () => {
    Object.assign(mocks.recorder, { status: 'uploading', progress: 0.37 });
    renderRecorder();

    expect(screen.getByText('Envoi sécurisé — 37 %')).toBeInTheDocument();
    expect(screen.queryByText(/100 %/u)).not.toBeInTheDocument();
  });

  it('explique un refus du microphone avec une action de reprise claire', () => {
    Object.assign(mocks.recorder, {
      status: 'error',
      error: 'NotAllowedError: permission denied',
    });
    renderRecorder();

    expect(screen.getByRole('alert')).toHaveTextContent('Autorisation du microphone refusée');
    expect(screen.getByText(/puis réessayez/u)).toBeInTheDocument();
  });

  it('morph vers la transcription terminée avec les mesures réellement calculées', async () => {
    mocks.recordings = [recording()];
    const view = renderRecorder();

    mocks.recordings = [
      recording({
        status: 'done',
        transcript: 'La fibre est correctement raccordée.',
        transcribed_at: '2026-09-23T10:01:00.000Z',
      }),
    ];
    view.rerender(<WorkspaceRecorder page={page} />);

    expect(await screen.findByText('Transcription prête')).toBeInTheDocument();
    expect(screen.getByText(/Durée : 02:18 · 5 mots/u)).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('REZO Voice')).getByRole('button', {
        name: /Voir la transcription/u,
      }),
    ).toBeInTheDocument();
  });

  it('retire automatiquement le panneau flottant après la confirmation finale', async () => {
    vi.useFakeTimers();
    try {
      mocks.recordings = [recording()];
      const view = renderRecorder();

      mocks.recordings = [
        recording({
          status: 'done',
          transcript: 'Intervention terminée.',
          transcribed_at: '2026-09-23T10:01:00.000Z',
        }),
      ];
      view.rerender(<WorkspaceRecorder page={page} />);

      expect(screen.getByLabelText('REZO Voice')).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(3_000));
      expect(screen.queryByLabelText('REZO Voice')).not.toBeInTheDocument();
      expect(screen.getByText('Dernière transcription prête')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('sort de l’échec avec une relance explicite quand l’audio existe encore', async () => {
    const user = userEvent.setup();
    mocks.recordings = [recording()];
    const view = renderRecorder();

    const failed = recording({ status: 'failed', error: 'Connexion interrompue' });
    mocks.recordings = [failed];
    view.rerender(<WorkspaceRecorder page={page} />);

    await waitFor(() => expect(screen.getByLabelText('REZO Voice')).toBeInTheDocument());
    const dock = screen.getByLabelText('REZO Voice');
    expect(within(dock).getByText('Transcription échouée')).toBeInTheDocument();
    await user.click(within(dock).getByRole('button', { name: 'Réessayer' }));

    expect(mocks.retryTranscription).toHaveBeenCalledWith(failed);
  });
});

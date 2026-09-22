import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MemoryAudioStore } from '../audio/local-store';
import type { ResumableUploadParams, ResumableUploader } from '../audio/resumable-upload';

import {
  CAPTURE_CONSTRAINTS,
  useAudioRecorder,
  type RecorderMedia,
  type RecorderServerApi,
} from './useAudioRecorder';

/*
  Aucun micro, aucun réseau : le MediaRecorder est factice (on lui « émet »
  des tranches), l'envoi et le serveur sont des fonctions. Ce qui est
  vérifié, c'est la règle zéro perte : chaque tranche est écrite localement
  avant l'envoi ; un échec garde tout et propose la reprise ; la reprise
  repart du pas franchi ; le local n'est vidé qu'après la soumission
  acceptée ; une capture retrouvée après fermeture est proposée comme
  interrompue ; l'annulation efface.
*/

class FakeRecorder {
  state: RecordingState = 'inactive';
  ondataavailable: ((e: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly options: MediaRecorderOptions;
  constructor(options: MediaRecorderOptions) {
    this.options = options;
  }
  start() {
    this.state = 'recording';
  }
  pause() {
    this.state = 'paused';
  }
  resume() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
  emit(texte: string) {
    this.ondataavailable?.({ data: new Blob([texte], { type: 'audio/webm' }) } as BlobEvent);
  }
}

function fabriquer(
  overrides: {
    upload?: ResumableUploader;
    createRow?: RecorderServerApi['createRow'];
    submit?: RecorderServerApi['submit'];
    updateNotes?: RecorderServerApi['updateNotes'];
    store?: MemoryAudioStore;
    getUserMedia?: RecorderMedia['getUserMedia'];
  } = {},
) {
  const store = overrides.store ?? new MemoryAudioStore();
  const recorders: FakeRecorder[] = [];
  const pistes = { stopped: 0 };
  const stream = {
    getTracks: () => [{ stop: () => (pistes.stopped += 1) }],
  } as unknown as MediaStream;
  const media: RecorderMedia = {
    getUserMedia: overrides.getUserMedia ?? (() => Promise.resolve(stream)),
    isTypeSupported: (t) => t === 'audio/webm;codecs=opus',
    createRecorder: (_s, o) => {
      const r = new FakeRecorder(o);
      recorders.push(r);
      return r as unknown as MediaRecorder;
    },
  };
  const createRow = overrides.createRow ?? vi.fn(() => Promise.resolve({ id: 'srv-1' }));
  const submit = overrides.submit ?? vi.fn(() => Promise.resolve({}));
  const updateNotes = overrides.updateNotes ?? vi.fn(() => Promise.resolve({}));
  const upload = overrides.upload ?? vi.fn(() => Promise.resolve());
  const onSubmitted = vi.fn();
  let horloge = 1_000_000;
  const now = () => horloge;
  const avancer = (ms: number) => {
    horloge += ms;
  };
  const rendu = renderHook(() =>
    useAudioRecorder({
      page: { id: 'page-1', organization_id: 'org-1' },
      store,
      uploader: upload,
      api: { createRow, submit, updateNotes },
      media,
      now,
      onSubmitted,
    }),
  );
  return {
    ...rendu,
    store,
    recorders,
    pistes,
    createRow,
    submit,
    updateNotes,
    upload,
    onSubmitted,
    avancer,
  };
}

const demarrer = async (h: ReturnType<typeof fabriquer>) => {
  await act(async () => {
    await h.result.current.start({ title: 'Réunion', consentConfirmed: true });
  });
  const recorder = h.recorders[0];
  if (!recorder) throw new Error('pas de recorder');
  return recorder;
};

describe('useAudioRecorder — zéro perte', () => {
  it('refuse de démarrer sans consentement', async () => {
    const h = fabriquer();
    await act(async () => {
      await h.result.current.start({ title: 'x', consentConfirmed: false });
    });
    expect(h.result.current.status).toBe('idle');
    expect(h.result.current.error).toMatch(/informées/);
    expect(h.recorders).toHaveLength(0);
  });

  it('demande le micro avec des contraintes explicites, et retombe sur { audio: true } si elles sont refusées', async () => {
    const appels: MediaStreamConstraints[] = [];
    const stream = { getTracks: () => [] } as unknown as MediaStream;
    const h = fabriquer({
      getUserMedia: (c) => {
        appels.push(c);
        if (appels.length === 1) {
          const e = new Error('non');
          e.name = 'OverconstrainedError';
          return Promise.reject(e);
        }
        return Promise.resolve(stream);
      },
    });
    await demarrer(h);
    expect(appels[0]).toBe(CAPTURE_CONSTRAINTS);
    expect(appels[1]).toEqual({ audio: true });
    expect(h.result.current.status).toBe('recording');
    expect(h.recorders[0]?.options).toEqual({
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 48_000,
    });
  });

  it('écrit chaque tranche localement pendant la capture, avant tout envoi', async () => {
    const h = fabriquer();
    const recorder = await demarrer(h);
    await act(async () => {
      recorder.emit('A');
      h.avancer(1000);
      recorder.emit('B');
      h.avancer(1000);
      await Promise.resolve();
    });
    const local = await h.store.listRecordings({ pageId: 'page-1' });
    expect(local).toHaveLength(1);
    expect(local[0]).toMatchObject({ status: 'recording', chunkCount: 2, title: 'Réunion' });
    expect(await (await h.store.readAudio(local[0]!.key, 'audio/webm')).text()).toBe('AB');
    expect(h.upload).not.toHaveBeenCalled();
  });

  it("à l'arrêt : ligne serveur, envoi reprenable, soumission — puis seulement le local est vidé", async () => {
    const ordre: string[] = [];
    const h = fabriquer({
      createRow: vi.fn(() => {
        ordre.push('row');
        return Promise.resolve({ id: 'srv-1' });
      }),
      upload: vi.fn(async (p: ResumableUploadParams) => {
        ordre.push(`upload:${p.path}:${await p.blob.text()}`);
        p.onUploadUrl?.('https://tus/abc');
      }),
      submit: vi.fn(async (id: string, taille: number) => {
        ordre.push(`submit:${id}:${String(taille)}`);
        // Au moment de la soumission, le local est ENCORE là.
        expect((await h.store.listRecordings()).length).toBe(1);
        return {};
      }),
    });
    const recorder = await demarrer(h);
    act(() => {
      recorder.emit('AB');
      h.avancer(3000);
    });
    act(() => {
      h.result.current.stop();
    });
    await waitFor(() => expect(h.result.current.status).toBe('done'));
    const key = (h.createRow as unknown as { mock: { calls: Array<[{ audioPath: string }]> } }).mock
      .calls[0]?.[0]?.audioPath;
    expect(key).toMatch(/^org-1\/page-1\/[0-9a-f-]+\.webm$/);
    expect(ordre).toEqual(['row', `upload:${key}:AB`, 'submit:srv-1:2']);
    expect(await h.store.listRecordings()).toEqual([]);
    expect(h.onSubmitted).toHaveBeenCalledWith('srv-1');
    expect(h.pistes.stopped).toBe(1);
    expect(h.createRow).toHaveBeenCalledWith(
      expect.objectContaining({ durationSeconds: 3, sizeBytes: 2, title: 'Réunion' }),
    );
  });

  it("un envoi qui échoue garde l'audio et l'URL de reprise ; la reprise ne recrée pas la ligne et finit le travail", async () => {
    let tentative = 0;
    const h = fabriquer({
      upload: vi.fn(async (p: ResumableUploadParams) => {
        tentative += 1;
        if (tentative === 1) {
          p.onUploadUrl?.('https://tus/reprise');
          await new Promise((r) => setTimeout(r, 0));
          throw new Error('Réseau coupé');
        }
        expect(p.uploadUrl).toBe('https://tus/reprise');
      }),
    });
    const recorder = await demarrer(h);
    act(() => {
      recorder.emit('AB');
      h.avancer(2000);
    });
    act(() => {
      h.result.current.stop();
    });
    await waitFor(() => expect(h.result.current.status).toBe('error'));
    expect(h.result.current.error).toBe('Réseau coupé');
    const enAttente = h.result.current.pending;
    expect(enAttente).toHaveLength(1);
    expect(enAttente[0]).toMatchObject({
      status: 'uploading',
      serverRecordingId: 'srv-1',
      uploadUrl: 'https://tus/reprise',
      interrupted: false,
      lastError: 'Réseau coupé',
    });
    expect(await (await h.store.readAudio(enAttente[0]!.key, 'audio/webm')).text()).toBe('AB');

    await act(async () => {
      await h.result.current.retry(enAttente[0]!.key);
    });
    expect(h.createRow).toHaveBeenCalledTimes(1);
    expect(h.submit).toHaveBeenCalledWith('srv-1', 2);
    expect(h.result.current.status).toBe('done');
    expect(h.result.current.pending).toEqual([]);
  });

  it('une soumission qui échoue après un fichier arrivé ne renvoie pas le fichier à la reprise', async () => {
    let refus = true;
    const h = fabriquer({
      submit: vi.fn(() => (refus ? Promise.reject(new Error('503')) : Promise.resolve({}))),
    });
    const recorder = await demarrer(h);
    act(() => {
      recorder.emit('AB');
      h.result.current.stop();
    });
    await waitFor(() => expect(h.result.current.status).toBe('error'));
    expect(h.result.current.pending[0]).toMatchObject({ status: 'uploaded' });
    refus = false;
    await act(async () => {
      await h.result.current.retry(h.result.current.pending[0]!.key);
    });
    expect(h.upload).toHaveBeenCalledTimes(1);
    expect(h.submit).toHaveBeenCalledTimes(2);
    expect(await h.store.listRecordings()).toEqual([]);
  });

  it('une capture retrouvée après fermeture est proposée comme interrompue, et se reprend avec ce qui a été capté', async () => {
    const store = new MemoryAudioStore();
    await store.putRecording({
      key: 'ancien',
      organizationId: 'org-1',
      pageId: 'page-1',
      mimeType: 'audio/webm',
      title: 'Avant la coupure',
      startedAt: '2026-09-21T10:00:00Z',
      durationSeconds: 42,
      chunkCount: 2,
      consentConfirmedAt: '2026-09-21T10:00:00Z',
      status: 'recording',
      updatedAt: '2026-09-21T10:00:42Z',
    });
    await store.appendChunk('ancien', 0, new Blob(['A']));
    await store.appendChunk('ancien', 1, new Blob(['B']));
    const h = fabriquer({ store });
    await waitFor(() => expect(h.result.current.pending).toHaveLength(1));
    expect(h.result.current.pending[0]).toMatchObject({ key: 'ancien', interrupted: true });
    await act(async () => {
      await h.result.current.retry('ancien');
    });
    expect(h.createRow).toHaveBeenCalledWith(
      expect.objectContaining({ durationSeconds: 42, title: 'Avant la coupure' }),
    );
    expect(h.result.current.status).toBe('done');
    expect(await store.listRecordings()).toEqual([]);
  });

  it("annuler efface le local et n'envoie rien ; écarter un enregistrement en attente l'efface", async () => {
    const h = fabriquer();
    const recorder = await demarrer(h);
    act(() => {
      recorder.emit('A');
    });
    await act(async () => {
      await h.result.current.cancel();
    });
    expect(h.result.current.status).toBe('idle');
    expect(await h.store.listRecordings()).toEqual([]);
    expect(h.createRow).not.toHaveBeenCalled();
    expect(h.pistes.stopped).toBeGreaterThan(0);

    await h.store.putRecording({
      key: 'k',
      organizationId: 'org-1',
      pageId: 'page-1',
      mimeType: 'audio/webm',
      title: 't',
      startedAt: '2026-09-21T10:00:00Z',
      durationSeconds: 5,
      chunkCount: 1,
      consentConfirmedAt: '2026-09-21T10:00:00Z',
      status: 'ready',
      updatedAt: '2026-09-21T10:00:05Z',
    });
    await act(async () => {
      await h.result.current.discard('k');
    });
    expect(await h.store.listRecordings()).toEqual([]);
    expect(h.result.current.pending).toEqual([]);
  });

  it('pause et reprise : le temps en pause ne compte pas', async () => {
    const h = fabriquer();
    const recorder = await demarrer(h);
    act(() => {
      h.avancer(4000);
      h.result.current.pause();
    });
    expect(h.result.current.status).toBe('paused');
    expect(recorder.state).toBe('paused');
    act(() => {
      h.avancer(10_000);
      h.result.current.resume();
    });
    expect(h.result.current.status).toBe('recording');
    act(() => {
      h.avancer(2000);
      recorder.emit('X');
      h.result.current.stop();
    });
    await waitFor(() => expect(h.result.current.status).toBe('done'));
    expect(h.createRow).toHaveBeenCalledWith(expect.objectContaining({ durationSeconds: 6 }));
  });

  it('les notes tapées pendant la capture sont gardées localement et partent avec la ligne', async () => {
    const h = fabriquer();
    const recorder = await demarrer(h);
    act(() => {
      h.result.current.setNotes('PTO au salon');
      recorder.emit('A');
    });
    expect(h.result.current.notes).toBe('PTO au salon');
    const cle = (await h.store.listRecordings())[0]!.key;
    await waitFor(async () =>
      expect((await h.store.getRecording(cle))?.notes).toBe('PTO au salon'),
    );
    act(() => {
      recorder.emit('B'); // une tranche après la frappe n'écrase pas les notes
    });
    await waitFor(async () =>
      expect((await h.store.getRecording(cle))?.notes).toBe('PTO au salon'),
    );
    act(() => {
      h.result.current.stop();
    });
    await waitFor(() => expect(h.result.current.status).toBe('done'));
    expect(h.createRow).toHaveBeenCalledWith(expect.objectContaining({ notes: 'PTO au salon' }));
    expect(h.updateNotes).not.toHaveBeenCalled();
    expect(h.result.current.notes).toBe('');
  });

  it("des notes tapées pendant l'envoi sont renvoyées avant la soumission", async () => {
    let liberer: () => void = () => {};
    const upload = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          liberer = resolve;
        }),
    );
    const h = fabriquer({ upload });
    const recorder = await demarrer(h);
    act(() => {
      recorder.emit('A');
      h.result.current.stop();
    });
    await waitFor(() => expect(h.result.current.status).toBe('uploading'));
    act(() => {
      h.result.current.setNotes('Ajouté pendant l’envoi');
    });
    await waitFor(async () =>
      expect((await h.store.listRecordings())[0]?.notes).toBe('Ajouté pendant l’envoi'),
    );
    act(() => liberer());
    await waitFor(() => expect(h.result.current.status).toBe('done'));
    expect(h.updateNotes).toHaveBeenCalledWith('srv-1', 'Ajouté pendant l’envoi');
    const ordre = (fn: unknown) =>
      (fn as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0] ?? -1;
    expect(ordre(h.updateNotes)).toBeLessThan(ordre(h.submit));
  });

  it('une capture interrompue garde ses notes ; annuler les efface', async () => {
    const store = new MemoryAudioStore();
    await store.putRecording({
      key: 'ancien',
      organizationId: 'org-1',
      pageId: 'page-1',
      mimeType: 'audio/webm',
      title: 'Avant la coupure',
      startedAt: '2026-09-21T10:00:00Z',
      durationSeconds: 42,
      chunkCount: 1,
      consentConfirmedAt: '2026-09-21T10:00:00Z',
      status: 'recording',
      notes: 'Karim repasse jeudi',
      updatedAt: '2026-09-21T10:00:42Z',
    });
    await store.appendChunk('ancien', 0, new Blob(['A']));
    const h = fabriquer({ store });
    await waitFor(() => expect(h.result.current.pending).toHaveLength(1));
    expect(h.result.current.pending[0]?.notes).toBe('Karim repasse jeudi');
    await act(async () => {
      await h.result.current.retry('ancien');
    });
    expect(h.createRow).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Karim repasse jeudi' }),
    );

    const recorder = await demarrer(h);
    act(() => {
      h.result.current.setNotes('brouillon');
      recorder.emit('A');
    });
    await act(async () => {
      await h.result.current.cancel();
    });
    expect(h.result.current.notes).toBe('');
    expect(await store.listRecordings()).toEqual([]);
  });
});

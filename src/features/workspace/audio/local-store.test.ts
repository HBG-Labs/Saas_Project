import { IDBFactory, IDBKeyRange as FakeKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import {
  IndexedDbAudioStore,
  MemoryAudioStore,
  type LocalAudioStore,
  type LocalRecording,
} from './local-store';

/*
  Les deux implémentations doivent se comporter pareil : ce que la mémoire
  fait, IndexedDB (simulée par fake-indexeddb) doit le faire — tranches dans
  l'ordre, liste par page, suppression qui emporte les tranches.
*/

const enregistrement = (key: string, pageId = 'page-1'): LocalRecording => ({
  key,
  organizationId: 'org-1',
  pageId,
  mimeType: 'audio/webm',
  title: 'Test',
  startedAt: `2026-09-21T10:00:0${key.slice(-1)}Z`,
  durationSeconds: 0,
  chunkCount: 0,
  consentConfirmedAt: '2026-09-21T10:00:00Z',
  status: 'recording',
  updatedAt: '2026-09-21T10:00:00Z',
});

function suite(nom: string, fabrique: () => LocalAudioStore) {
  describe(nom, () => {
    it('assemble les tranches dans leur ordre, même écrites dans le désordre', async () => {
      const store = fabrique();
      await store.putRecording(enregistrement('k1'));
      await store.appendChunk('k1', 2, new Blob(['C']));
      await store.appendChunk('k1', 0, new Blob(['A']));
      await store.appendChunk('k1', 1, new Blob(['B']));
      const audio = await store.readAudio('k1', 'audio/webm');
      expect(await audio.text()).toBe('ABC');
      expect(audio.type).toBe('audio/webm');
    });

    it('liste par page, trié par début, et met à jour une ligne', async () => {
      const store = fabrique();
      await store.putRecording(enregistrement('k2', 'page-1'));
      await store.putRecording(enregistrement('k1', 'page-1'));
      await store.putRecording(enregistrement('k3', 'page-2'));
      expect((await store.listRecordings({ pageId: 'page-1' })).map((r) => r.key)).toEqual([
        'k1',
        'k2',
      ]);
      expect((await store.listRecordings()).length).toBe(3);
      await store.putRecording({
        ...enregistrement('k1'),
        status: 'ready',
        serverRecordingId: 's-1',
      });
      expect(await store.getRecording('k1')).toMatchObject({
        status: 'ready',
        serverRecordingId: 's-1',
      });
    });

    it('supprimer un enregistrement emporte ses tranches, et pas celles des autres', async () => {
      const store = fabrique();
      await store.putRecording(enregistrement('k1'));
      await store.putRecording(enregistrement('k2'));
      await store.appendChunk('k1', 0, new Blob(['A']));
      await store.appendChunk('k2', 0, new Blob(['Z']));
      await store.deleteRecording('k1');
      expect(await store.getRecording('k1')).toBeUndefined();
      expect((await store.readAudio('k1', 'audio/webm')).size).toBe(0);
      expect(await (await store.readAudio('k2', 'audio/webm')).text()).toBe('Z');
    });
  });
}

suite('MemoryAudioStore', () => new MemoryAudioStore());
suite('IndexedDbAudioStore (fake-indexeddb)', () => {
  // Chaque test repart d'une base vide : une fabrique neuve à chaque fois.
  globalThis.IDBKeyRange = FakeKeyRange;
  return new IndexedDbAudioStore(new IDBFactory());
});

it('IndexedDbAudioStore se déclare durable, la mémoire non', () => {
  expect(new MemoryAudioStore().durable).toBe(false);
  expect(new IndexedDbAudioStore(new IDBFactory()).durable).toBe(true);
});

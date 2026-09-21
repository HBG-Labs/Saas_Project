/**
 * Le stockage local de l'audio en cours et en attente d'envoi.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ZÉRO PERTE : LA RÈGLE
 *
 * Chaque tranche produite par `MediaRecorder` est écrite ICI dans la seconde
 * qui suit, avant tout envoi. Un enregistrement n'est retiré du stockage local
 * qu'après la confirmation serveur (`submit_workspace_recording` accepté) —
 * jamais avant, jamais sur une erreur. Une fermeture accidentelle, un appel
 * entrant, une coupure réseau laissent donc un enregistrement « interrompu »
 * ou « à envoyer » que l'écran retrouve à l'ouverture suivante.
 *
 * IndexedDB en production (Web et WebView Capacitor, où elle est disponible),
 * une implémentation mémoire pour les tests et pour le cas où IndexedDB est
 * refusée (navigation privée sur certains navigateurs) : dans ce cas la
 * capture fonctionne, la garantie de reprise après fermeture ne tient pas, et
 * le hook le dit.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type LocalRecordingStatus =
  /** Capture en cours dans cet onglet. Retrouvé à l'ouverture = interrompu. */
  | 'recording'
  /** Capture terminée ou interrompue, audio complet localement, à envoyer. */
  | 'ready'
  /** Envoi commencé ; `uploadUrl` permet de reprendre là où on s'est arrêté. */
  | 'uploading'
  /** Fichier arrivé, ligne à soumettre (dernier pas, idempotent). */
  | 'uploaded';

export interface LocalRecording {
  /** Clé locale, stable, générée à la première tranche. */
  key: string;
  organizationId: string;
  pageId: string;
  mimeType: string;
  title: string;
  startedAt: string;
  /** Mis à jour à chaque tranche : ce que l'on a vraiment capté. */
  durationSeconds: number;
  chunkCount: number;
  consentConfirmedAt: string;
  status: LocalRecordingStatus;
  /** Posés au fil de l'envoi ; restent pour la reprise. */
  serverRecordingId?: string | undefined;
  audioPath?: string | undefined;
  uploadUrl?: string | undefined;
  lastError?: string | undefined;
  updatedAt: string;
}

export interface LocalAudioStore {
  readonly durable: boolean;
  putRecording(recording: LocalRecording): Promise<void>;
  getRecording(key: string): Promise<LocalRecording | undefined>;
  listRecordings(filter?: { pageId?: string }): Promise<LocalRecording[]>;
  appendChunk(key: string, index: number, chunk: Blob): Promise<void>;
  /** Toutes les tranches, dans l'ordre, assemblées. */
  readAudio(key: string, mimeType: string): Promise<Blob>;
  deleteRecording(key: string): Promise<void>;
}

// ─── Mémoire ─────────────────────────────────────────────────────────────────

export class MemoryAudioStore implements LocalAudioStore {
  readonly durable = false;
  private readonly recordings = new Map<string, LocalRecording>();
  private readonly chunks = new Map<string, Map<number, Blob>>();

  putRecording(recording: LocalRecording): Promise<void> {
    this.recordings.set(recording.key, { ...recording });
    return Promise.resolve();
  }

  getRecording(key: string): Promise<LocalRecording | undefined> {
    const r = this.recordings.get(key);
    return Promise.resolve(r ? { ...r } : undefined);
  }

  listRecordings(filter: { pageId?: string } = {}): Promise<LocalRecording[]> {
    return Promise.resolve(
      [...this.recordings.values()]
        .filter((r) => filter.pageId === undefined || r.pageId === filter.pageId)
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
        .map((r) => ({ ...r })),
    );
  }

  appendChunk(key: string, index: number, chunk: Blob): Promise<void> {
    if (!this.chunks.has(key)) this.chunks.set(key, new Map());
    this.chunks.get(key)?.set(index, chunk);
    return Promise.resolve();
  }

  readAudio(key: string, mimeType: string): Promise<Blob> {
    const parts = [...(this.chunks.get(key)?.entries() ?? [])]
      .sort((a, b) => a[0] - b[0])
      .map(([, blob]) => blob);
    return Promise.resolve(new Blob(parts, { type: mimeType }));
  }

  deleteRecording(key: string): Promise<void> {
    this.recordings.delete(key);
    this.chunks.delete(key);
    return Promise.resolve();
  }
}

// ─── IndexedDB ───────────────────────────────────────────────────────────────

const DB_NAME = 'rezo360-audio';
const DB_VERSION = 1;
const STORE_RECORDINGS = 'recordings';
const STORE_CHUNKS = 'chunks';

function requete<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB : requête échouée'));
  });
}

function transactionTerminee(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB : transaction échouée'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB : transaction annulée'));
  });
}

export class IndexedDbAudioStore implements LocalAudioStore {
  readonly durable = true;
  private db: Promise<IDBDatabase> | null = null;
  private readonly factory: IDBFactory;

  constructor(factory: IDBFactory) {
    this.factory = factory;
  }

  private ouvrir(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = this.factory.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_RECORDINGS)) {
          const s = db.createObjectStore(STORE_RECORDINGS, { keyPath: 'key' });
          s.createIndex('pageId', 'pageId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
          db.createObjectStore(STORE_CHUNKS, { keyPath: ['key', 'index'] });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB : ouverture refusée'));
      req.onblocked = () => reject(new Error('IndexedDB : ouverture bloquée'));
    });
    return this.db;
  }

  async putRecording(recording: LocalRecording): Promise<void> {
    const db = await this.ouvrir();
    const tx = db.transaction(STORE_RECORDINGS, 'readwrite');
    tx.objectStore(STORE_RECORDINGS).put(recording);
    await transactionTerminee(tx);
  }

  async getRecording(key: string): Promise<LocalRecording | undefined> {
    const db = await this.ouvrir();
    const tx = db.transaction(STORE_RECORDINGS, 'readonly');
    const r: unknown = await requete(tx.objectStore(STORE_RECORDINGS).get(key));
    return (r as LocalRecording | undefined) ?? undefined;
  }

  async listRecordings(filter: { pageId?: string } = {}): Promise<LocalRecording[]> {
    const db = await this.ouvrir();
    const tx = db.transaction(STORE_RECORDINGS, 'readonly');
    const store = tx.objectStore(STORE_RECORDINGS);
    const rows = (await requete(
      filter.pageId === undefined ? store.getAll() : store.index('pageId').getAll(filter.pageId),
    )) as LocalRecording[];
    return rows.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  async appendChunk(key: string, index: number, chunk: Blob): Promise<void> {
    // En ArrayBuffer, pas en Blob : un Blob dans IndexedDB a longtemps été
    // fragile sur iOS Safari, et il ne se clone pas partout ; des octets,
    // eux, se stockent et se relisent à l'identique.
    const octets = await chunk.arrayBuffer();
    const db = await this.ouvrir();
    const tx = db.transaction(STORE_CHUNKS, 'readwrite');
    tx.objectStore(STORE_CHUNKS).put({ key, index, octets });
    await transactionTerminee(tx);
  }

  async readAudio(key: string, mimeType: string): Promise<Blob> {
    const db = await this.ouvrir();
    const tx = db.transaction(STORE_CHUNKS, 'readonly');
    const rows = (await requete(
      tx
        .objectStore(STORE_CHUNKS)
        .getAll(IDBKeyRange.bound([key, 0], [key, Number.MAX_SAFE_INTEGER])),
    )) as Array<{ key: string; index: number; octets: ArrayBuffer }>;
    return new Blob(
      rows.sort((a, b) => a.index - b.index).map((r) => r.octets),
      { type: mimeType },
    );
  }

  async deleteRecording(key: string): Promise<void> {
    const db = await this.ouvrir();
    const tx = db.transaction([STORE_RECORDINGS, STORE_CHUNKS], 'readwrite');
    tx.objectStore(STORE_RECORDINGS).delete(key);
    tx.objectStore(STORE_CHUNKS).delete(
      IDBKeyRange.bound([key, 0], [key, Number.MAX_SAFE_INTEGER]),
    );
    await transactionTerminee(tx);
  }
}

/** IndexedDB si le navigateur la donne, mémoire sinon — et on sait laquelle. */
export function createLocalAudioStore(): LocalAudioStore {
  try {
    if (typeof indexedDB !== 'undefined') return new IndexedDbAudioStore(indexedDB);
  } catch {
    // Accès refusé (navigation privée, politique) : on retombe sur la mémoire.
  }
  return new MemoryAudioStore();
}

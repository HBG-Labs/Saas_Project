import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AUDIO_BUCKET, AUDIO_MAX_BYTES, AUDIO_MAX_SECONDS } from '../api/workspace.api';
import {
  createLocalAudioStore,
  type LocalAudioStore,
  type LocalRecording,
} from '../audio/local-store';
import { uploadResumable, type ResumableUploader } from '../audio/resumable-upload';
import { fixDuration, type DurationFixer } from '../audio/webm-duration';

/**
 * La mécanique de l'enregistrement vocal — capture, pause, tranches,
 * sauvegarde locale, envoi reprenable, reprise après interruption.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE HOOK GARANTIT
 *
 * 1. Chaque seconde d'audio est écrite dans le stockage local avant toute
 *    autre chose. Fermer l'onglet, recevoir un appel, perdre le réseau ne
 *    perd que la seconde en cours.
 * 2. L'envoi est en trois pas idempotents — la ligne serveur, le fichier
 *    (reprenable, TUS), la soumission — et chaque pas franchi est noté
 *    localement. Une reprise repart du dernier pas franchi.
 * 3. Le stockage local n'est vidé qu'après la soumission acceptée. Jamais sur
 *    une erreur : l'erreur est gardée, l'enregistrement attend, et il est
 *    proposé à la reprise (au retour du réseau, à l'ouverture suivante).
 *
 * CE QU'IL NE FAIT PAS
 *
 * Aucun rendu : l'écran (Codex) consomme `status`, `pending`, et appelle
 * `start`/`pause`/`resume`/`stop`/`cancel`/`retry`/`discard`. Tout ce qui
 * touche au navigateur ou au réseau est injectable, pour les tests.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type AudioRecorderStatus =
  | 'idle'
  | 'unsupported'
  | 'requesting'
  | 'recording'
  | 'paused'
  | 'saving'
  | 'uploading'
  | 'submitting'
  | 'done'
  | 'error';

export interface RecorderPage {
  id: string;
  organization_id: string;
}

export interface StartOptions {
  title: string;
  consentConfirmed: boolean;
  language?: string;
}

/** Ce que le hook demande au serveur — injecté, pour tester sans Supabase. */
export interface RecorderServerApi {
  createRow(input: {
    page: RecorderPage;
    audioPath: string;
    mimeType: string;
    durationSeconds: number;
    sizeBytes: number;
    consentConfirmedAt: string;
    title: string;
    language?: string;
    notes?: string;
  }): Promise<{ id: string }>;
  submit(recordingId: string, sizeBytes: number): Promise<unknown>;
  /** Les notes tapées après la création de la ligne (pendant l'envoi). */
  updateNotes?(recordingId: string, notes: string): Promise<unknown>;
}

/** Mesure le niveau du micro : `read()` rend l'amplitude efficace (0 → 1) de l'instant. */
export interface LevelMeter {
  read(): number;
  close(): void;
}

/** Ce que le hook demande au navigateur — injecté, pour tester sans micro. */
export interface RecorderMedia {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  isTypeSupported(mimeType: string): boolean;
  createRecorder(stream: MediaStream, options: MediaRecorderOptions): MediaRecorder;
  /** `null` quand le navigateur ne sait pas mesurer : on n'en déduit rien. */
  createLevelMeter(stream: MediaStream): LevelMeter | null;
}

/**
 * Sous ce niveau efficace, c'est du silence. Une voix normale au téléphone
 * donne 0,02 à 0,2 ; le bruit de fond d'une pièce, 0,001 à 0,005.
 */
export const SILENCE_RMS = 0.008;
/** Au-delà de cette durée sans aucun son, l'écran prévient. */
export const SILENCE_WARN_SECONDS = 6;
/** Attente d'une piste qui se déclare muette au départ avant de refuser. */
const MUTED_GRACE_MS = 1500;
const LEVEL_INTERVAL_MS = 250;
/** En dessous de ce nombre de mesures (2 s), on ne juge pas : trop court pour conclure au silence. */
const MIN_READINGS_TO_JUDGE = 8;

export const MESSAGE_MICRO_MUET =
  "Le micro est coupé par le système : aucun son n'arrive. Dans l'application installée, autorisez le micro pour REZO360 dans les réglages du téléphone (Applications → REZO360 → Autorisations), ou enregistrez depuis le navigateur.";
export const MESSAGE_AUCUN_SON =
  "Aucun son capté pendant l'enregistrement : il n'a pas été envoyé. Vérifiez le micro (autorisation de l'application, autre appli qui l'utilise), puis réessayez. L'audio reste sur cet appareil.";

export interface UseAudioRecorderOptions {
  page: RecorderPage;
  /** Appelé quand un enregistrement est soumis : l'écran rafraîchit ses listes. */
  onSubmitted?: (recordingId: string) => void;
  store?: LocalAudioStore;
  uploader?: ResumableUploader;
  /** Inscrit la durée dans l'en-tête WebM avant l'envoi ; injecté pour les tests. */
  durationFixer?: DurationFixer;
  api?: RecorderServerApi;
  media?: RecorderMedia;
  now?: () => number;
}

export interface PendingRecording extends LocalRecording {
  /** Retrouvé avec le statut « en cours » d'une session précédente : interrompu. */
  interrupted: boolean;
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

/**
 * Les contraintes de capture, explicites : mono (la voix n'a pas besoin de
 * stéréo, et ça divise le poids), annulation d'écho, suppression de bruit et
 * gain automatique — ce que Chrome applique déjà par défaut, ce que Safari
 * et la WebView Android n'appliquent pas tous. Si le navigateur refuse une
 * contrainte (`OverconstrainedError`), on retombe sur `{ audio: true }`
 * plutôt que d'échouer : un enregistrement sans suppression de bruit vaut
 * mieux que pas d'enregistrement.
 */
export const CAPTURE_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    channelCount: { ideal: 1 },
    echoCancellation: { ideal: true },
    noiseSuppression: { ideal: true },
    autoGainControl: { ideal: true },
  },
};

/** 48 kbit/s en Opus : de la voix lisible, ~20 Mo pour une heure. */
export const CAPTURE_BITRATE = 48_000;
const TIMESLICE_MS = 1000;

function extensionFor(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

function messageDe(e: unknown, defaut: string): string {
  return e instanceof Error && e.message ? e.message : defaut;
}

const defaultMedia: RecorderMedia = {
  getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c),
  isTypeSupported: (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t),
  createRecorder: (s, o) => new MediaRecorder(s, o),
  createLevelMeter: (stream) => {
    if (typeof AudioContext === 'undefined') return null;
    try {
      const contexte = new AudioContext();
      const source = contexte.createMediaStreamSource(stream);
      const analyseur = contexte.createAnalyser();
      analyseur.fftSize = 1024;
      source.connect(analyseur);
      const tampon = new Float32Array(analyseur.fftSize);
      return {
        read: () => {
          analyseur.getFloatTimeDomainData(tampon);
          let somme = 0;
          for (const v of tampon) somme += v * v;
          return Math.sqrt(somme / tampon.length);
        },
        close: () => {
          source.disconnect();
          void contexte.close();
        },
      };
    } catch {
      return null;
    }
  },
};

/** Une piste déclarée muette par le système au départ le reste presque toujours : on attend un peu, puis on tranche. */
function attendreDemutage(track: MediaStreamTrack, delaiMs: number): Promise<boolean> {
  if (!track.muted) return Promise.resolve(true);
  return new Promise((resolve) => {
    const fin = () => {
      track.removeEventListener('unmute', fin);
      resolve(!track.muted);
    };
    track.addEventListener('unmute', fin);
    setTimeout(fin, delaiMs);
  });
}

let defaultStore: LocalAudioStore | null = null;

export function useAudioRecorder(options: UseAudioRecorderOptions) {
  const { page, onSubmitted } = options;
  const store = useMemo(
    () => options.store ?? (defaultStore ??= createLocalAudioStore()),
    [options.store],
  );
  const uploader = options.uploader ?? uploadResumable;
  const fixer = options.durationFixer ?? fixDuration;
  const media = options.media ?? defaultMedia;
  const now = options.now ?? Date.now;
  const api = options.api;

  const [status, setStatus] = useState<AudioRecorderStatus>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRecording[]>([]);
  const [notes, setNotesState] = useState('');
  /** La capture en cours, pour l'écran (le ref `activeRef` ne déclenche pas de rendu). */
  const [current, setCurrent] = useState<{ key: string; title: string; startedAt: string } | null>(
    null,
  );
  /** Le niveau du micro à l'instant (0 → 1) ; `null` quand on ne sait pas mesurer. */
  const [level, setLevel] = useState<number | null>(null);
  /** `none` : rien n'a été capté depuis SILENCE_WARN_SECONDS ; `unknown` : pas de mesure possible. */
  const [signal, setSignal] = useState<'unknown' | 'ok' | 'none'>('unknown');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<LevelMeter | null>(null);
  const meterTimerRef = useRef<number | null>(null);
  /** Le plus fort niveau vu pendant la capture : décide, à l'arrêt, si quelque chose a été capté. */
  const peakRef = useRef(0);
  const readingsRef = useRef(0);
  const activeRef = useRef<LocalRecording | null>(null);
  /** L'enregistrement dont les notes s'éditent : le courant, jusqu'à son envoi confirmé. */
  const notesKeyRef = useRef<string | null>(null);
  const chunkIndexRef = useRef(0);
  const startedAtRef = useRef(0);
  const pausedAccumRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const envoisEnCoursRef = useRef(new Set<string>());

  const supported = typeof MediaRecorder !== 'undefined' || options.media !== undefined;

  const rafraichirPending = useCallback(async () => {
    const rows = await store.listRecordings({ pageId: page.id });
    const activeKey = activeRef.current?.key;
    setPending(
      rows
        .filter((r) => r.key !== activeKey)
        .map((r) => ({ ...r, interrupted: r.status === 'recording' })),
    );
  }, [store, page.id]);

  useEffect(() => {
    void rafraichirPending();
  }, [rafraichirPending]);

  // Le chronomètre : le temps effectivement capté, pauses exclues.
  useEffect(() => {
    if (status !== 'recording') return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.round((now() - startedAtRef.current - pausedAccumRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [status, now]);

  /**
   * L'envoi, en trois pas idempotents. Chaque pas franchi est écrit dans le
   * stockage local avant le suivant ; une reprise relit et continue.
   */
  const envoyer = useCallback(
    async (key: string): Promise<void> => {
      if (!api) throw new Error('API serveur absente.');
      if (envoisEnCoursRef.current.has(key)) return;
      envoisEnCoursRef.current.add(key);
      try {
        const initial = await store.getRecording(key);
        if (!initial) return;
        let rec: LocalRecording = initial;
        // Relire avant d'écrire : les notes peuvent avoir bougé entre-temps.
        const noter = async (patch: Partial<LocalRecording>) => {
          const actuel = (await store.getRecording(key)) ?? rec;
          rec = { ...actuel, ...patch, updatedAt: new Date(now()).toISOString() };
          await store.putRecording(rec);
        };
        const brut = await store.readAudio(key, rec.mimeType);
        if (brut.size === 0) throw new Error('Aucun audio capté.');
        // La durée dans l'en-tête, pour que le lecteur l'affiche juste.
        const audio = await fixer(brut, rec.durationSeconds * 1000);
        if (audio.size > AUDIO_MAX_BYTES)
          throw new Error('Enregistrement trop lourd (25 Mo au plus).');

        // Pas 1 — la ligne serveur (la règle du bucket l'exige avant le fichier).
        if (!rec.serverRecordingId) {
          const audioPath = `${rec.organizationId}/${rec.pageId}/${rec.key}.${extensionFor(rec.mimeType)}`;
          setStatus('uploading');
          const row = await api.createRow({
            page: { id: rec.pageId, organization_id: rec.organizationId },
            audioPath,
            mimeType: rec.mimeType,
            durationSeconds: Math.max(
              1,
              Math.min(AUDIO_MAX_SECONDS, Math.round(rec.durationSeconds)),
            ),
            sizeBytes: audio.size,
            consentConfirmedAt: rec.consentConfirmedAt,
            title: rec.title,
            ...(rec.notes && rec.notes.trim().length > 0 ? { notes: rec.notes } : {}),
          });
          await noter({
            serverRecordingId: row.id,
            audioPath,
            status: 'uploading',
            lastError: undefined,
            notesSynced: rec.notes ?? '',
          });
        }

        // Pas 2 — le fichier, reprenable.
        if (rec.status !== 'uploaded') {
          setStatus('uploading');
          setProgress(0);
          await uploader({
            bucket: AUDIO_BUCKET,
            path: rec.audioPath as string,
            blob: audio,
            contentType: rec.mimeType,
            uploadUrl: rec.uploadUrl,
            onUploadUrl: (url) => {
              void noter({ uploadUrl: url });
            },
            onProgress: (sent, total) => setProgress(total > 0 ? sent / total : null),
          });
          await noter({ status: 'uploaded', uploadUrl: undefined });
        }

        // Pas 3 — les notes tapées pendant l'envoi, puis la soumission ; puis
        // seulement, le local est vidé.
        setStatus('submitting');
        rec = (await store.getRecording(key)) ?? rec;
        const notesActuelles = rec.notes ?? '';
        if (api.updateNotes && notesActuelles !== (rec.notesSynced ?? '')) {
          await api.updateNotes(rec.serverRecordingId as string, notesActuelles);
          await noter({ notesSynced: notesActuelles });
        }
        await api.submit(rec.serverRecordingId as string, audio.size);
        if (notesKeyRef.current === key) {
          notesKeyRef.current = null;
          setNotesState('');
        }
        setCurrent((c) => (c?.key === key ? null : c));
        await store.deleteRecording(key);
        setProgress(null);
        setStatus('done');
        onSubmitted?.(rec.serverRecordingId as string);
      } catch (e) {
        const message = messageDe(e, 'Envoi impossible.');
        const rec = await store.getRecording(key);
        if (rec) {
          await store.putRecording({
            ...rec,
            status: rec.status === 'recording' ? 'ready' : rec.status,
            lastError: message,
            updatedAt: new Date(now()).toISOString(),
          });
        }
        setError(message);
        setStatus('error');
        setProgress(null);
        // L'enregistrement reste sur l'appareil : c'est `pending` qui le montre désormais.
        setCurrent((c) => (c?.key === key ? null : c));
      } finally {
        envoisEnCoursRef.current.delete(key);
        await rafraichirPending();
      }
    },
    [api, store, uploader, fixer, now, onSubmitted, rafraichirPending],
  );

  const arreterFlux = () => {
    if (meterTimerRef.current !== null) window.clearInterval(meterTimerRef.current);
    meterTimerRef.current = null;
    meterRef.current?.close();
    meterRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  };

  const start = useCallback(
    async (opts: StartOptions) => {
      setError(null);
      if (!opts.consentConfirmed) {
        setError('Confirmez que les personnes enregistrées sont informées.');
        return;
      }
      if (!supported) {
        setStatus('unsupported');
        setError("Ce navigateur ne sait pas enregistrer l'audio.");
        return;
      }
      const mimeType = MIME_CANDIDATES.find((t) => media.isTypeSupported(t));
      if (!mimeType) {
        setStatus('unsupported');
        setError('Ce navigateur ne produit aucun format audio pris en charge.');
        return;
      }
      setStatus('requesting');
      let stream: MediaStream;
      try {
        try {
          stream = await media.getUserMedia(CAPTURE_CONSTRAINTS);
        } catch (e) {
          // Contrainte refusée : on prend ce que le navigateur donne.
          if (e instanceof Error && (e.name === 'OverconstrainedError' || e.name === 'TypeError')) {
            stream = await media.getUserMedia({ audio: true });
          } else throw e;
        }
      } catch (e) {
        setStatus('idle');
        setError(messageDe(e, 'Micro inaccessible.'));
        return;
      }
      // Une piste muette au départ : le système livre du silence (permission
      // de l'application refusée sur Android, par exemple). On refuse tout de
      // suite plutôt que d'enregistrer deux minutes de rien.
      const piste = stream.getAudioTracks()[0];
      if (!piste || !(await attendreDemutage(piste, MUTED_GRACE_MS))) {
        stream.getTracks().forEach((t) => t.stop());
        setStatus('idle');
        setError(MESSAGE_MICRO_MUET);
        return;
      }
      streamRef.current = stream;

      // Le niveau sonore, pour l'écran et pour refuser un enregistrement muet.
      peakRef.current = 0;
      readingsRef.current = 0;
      const meter = media.createLevelMeter(stream);
      meterRef.current = meter;
      setLevel(meter ? 0 : null);
      setSignal(meter ? 'ok' : 'unknown');
      if (meter) {
        meterTimerRef.current = window.setInterval(() => {
          const v = meter.read();
          if (!Number.isFinite(v)) return;
          readingsRef.current += 1;
          setLevel(v);
          if (v > peakRef.current) peakRef.current = v;
          const muetDepuis = (readingsRef.current * LEVEL_INTERVAL_MS) / 1000;
          setSignal(
            peakRef.current < SILENCE_RMS && muetDepuis >= SILENCE_WARN_SECONDS ? 'none' : 'ok',
          );
        }, LEVEL_INTERVAL_MS);
      }

      const key = crypto.randomUUID();
      const startedAt = now();
      const rec: LocalRecording = {
        key,
        organizationId: page.organization_id,
        pageId: page.id,
        mimeType: mimeType.split(';')[0] ?? 'audio/webm',
        title: opts.title,
        startedAt: new Date(startedAt).toISOString(),
        durationSeconds: 0,
        chunkCount: 0,
        consentConfirmedAt: new Date(startedAt).toISOString(),
        status: 'recording',
        updatedAt: new Date(startedAt).toISOString(),
      };
      await store.putRecording(rec);
      activeRef.current = rec;
      notesKeyRef.current = key;
      setNotesState('');
      setCurrent({ key, title: rec.title, startedAt: rec.startedAt });
      chunkIndexRef.current = 0;
      startedAtRef.current = startedAt;
      pausedAccumRef.current = 0;
      pausedAtRef.current = null;
      cancelledRef.current = false;
      setElapsedSeconds(0);

      const recorder = media.createRecorder(stream, {
        mimeType,
        audioBitsPerSecond: CAPTURE_BITRATE,
      });
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size === 0 || cancelledRef.current) return;
        const index = chunkIndexRef.current;
        chunkIndexRef.current += 1;
        const duree = Math.round((now() - startedAtRef.current - pausedAccumRef.current) / 1000);
        void (async () => {
          await store.appendChunk(key, index, event.data);
          const courant = activeRef.current;
          if (courant && courant.key === key) {
            activeRef.current = {
              ...courant,
              chunkCount: index + 1,
              durationSeconds: duree,
              updatedAt: new Date(now()).toISOString(),
            };
            await store.putRecording(activeRef.current);
          }
        })();
      };
      recorder.onstop = () => {
        // On ne conclut au silence qu'avec assez de mesures : une capture d'une
        // seconde n'est pas jugée.
        const rienCapte =
          meterRef.current !== null &&
          readingsRef.current >= MIN_READINGS_TO_JUDGE &&
          peakRef.current < SILENCE_RMS;
        arreterFlux();
        setLevel(null);
        const courant = activeRef.current;
        activeRef.current = null;
        if (!courant || cancelledRef.current) return;
        void (async () => {
          setStatus('saving');
          if (rienCapte) {
            // Rien n'a été capté : on n'envoie pas. L'audio reste sur l'appareil,
            // marqué, et la personne décide (réessayer, envoyer quand même, jeter).
            await store.putRecording({
              ...((await store.getRecording(courant.key)) ?? courant),
              status: 'ready',
              lastError: MESSAGE_AUCUN_SON,
              updatedAt: new Date(now()).toISOString(),
            });
            setError(MESSAGE_AUCUN_SON);
            setStatus('error');
            setCurrent(null);
            await rafraichirPending();
            return;
          }
          // Laisser la dernière tranche s'écrire, puis marquer « prêt » — sur
          // l'état relu, pour ne pas écraser des notes tapées entre-temps.
          await store.putRecording({
            ...((await store.getRecording(courant.key)) ?? courant),
            durationSeconds: Math.max(
              1,
              Math.round((now() - startedAtRef.current - pausedAccumRef.current) / 1000),
            ),
            status: 'ready',
            updatedAt: new Date(now()).toISOString(),
          });
          await envoyer(courant.key);
        })();
      };
      recorder.onerror = () => {
        setError("L'enregistrement a été interrompu.");
        recorder.stop();
      };
      recorderRef.current = recorder;
      recorder.start(TIMESLICE_MS);
      setStatus('recording');
    },
    [supported, media, store, page, now, envoyer, rafraichirPending],
  );

  const pause = useCallback(() => {
    const r = recorderRef.current;
    if (!r || r.state !== 'recording') return;
    r.pause();
    pausedAtRef.current = now();
    setStatus('paused');
  }, [now]);

  const resume = useCallback(() => {
    const r = recorderRef.current;
    if (!r || r.state !== 'paused') return;
    if (pausedAtRef.current !== null) pausedAccumRef.current += now() - pausedAtRef.current;
    pausedAtRef.current = null;
    r.resume();
    setStatus('recording');
  }, [now]);

  const stop = useCallback(() => {
    const r = recorderRef.current;
    if (!r || r.state === 'inactive') return;
    if (r.state === 'paused' && pausedAtRef.current !== null) {
      pausedAccumRef.current += now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    r.stop();
  }, [now]);

  const cancel = useCallback(async () => {
    const courant = activeRef.current;
    cancelledRef.current = true;
    const r = recorderRef.current;
    if (r && r.state !== 'inactive') r.stop();
    arreterFlux();
    activeRef.current = null;
    notesKeyRef.current = null;
    setNotesState('');
    setCurrent(null);
    if (courant) await store.deleteRecording(courant.key);
    setStatus('idle');
    setElapsedSeconds(0);
    setProgress(null);
    await rafraichirPending();
  }, [store, rafraichirPending]);

  /** Reprendre l'envoi d'un enregistrement en attente (interrompu, ou en échec). */
  const retry = useCallback(
    async (key: string) => {
      const rec = await store.getRecording(key);
      if (!rec) return;
      if (rec.status === 'recording') {
        // Interrompu par une fermeture : ce qui est capté est complet à la seconde près.
        await store.putRecording({
          ...rec,
          status: 'ready',
          updatedAt: new Date(now()).toISOString(),
        });
      }
      setError(null);
      await envoyer(key);
    },
    [store, now, envoyer],
  );

  const discard = useCallback(
    async (key: string) => {
      await store.deleteRecording(key);
      await rafraichirPending();
    },
    [store, rafraichirPending],
  );

  /**
   * Les notes de l'enregistrement en cours (capture, puis envoi). Écrites
   * localement à chaque frappe ; elles partent avec la ligne serveur, ou
   * juste avant la soumission si elles ont bougé entre-temps.
   */
  const setNotes = useCallback(
    (texte: string) => {
      setNotesState(texte);
      const key = notesKeyRef.current;
      if (!key) return;
      if (activeRef.current?.key === key)
        activeRef.current = { ...activeRef.current, notes: texte };
      void (async () => {
        const rec = await store.getRecording(key);
        // Annulé ou envoyé entre-temps : ne pas recréer ce qui a été effacé.
        if (!rec || notesKeyRef.current !== key) return;
        await store.putRecording({
          ...rec,
          notes: texte,
          updatedAt: new Date(now()).toISOString(),
        });
      })();
    },
    [store, now],
  );

  // Au-delà d'une heure, on arrête : la base refuserait de toute façon.
  useEffect(() => {
    if (status === 'recording' && elapsedSeconds >= AUDIO_MAX_SECONDS) stop();
  }, [status, elapsedSeconds, stop]);

  // Le réseau revient : ce qui attend repart, sans clic.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const relancer = () => {
      void (async () => {
        const rows = await store.listRecordings({ pageId: page.id });
        for (const r of rows) {
          if (r.key === activeRef.current?.key) continue;
          if (r.status === 'ready' || r.status === 'uploading' || r.status === 'uploaded')
            await envoyer(r.key);
        }
      })();
    };
    window.addEventListener('online', relancer);
    return () => window.removeEventListener('online', relancer);
  }, [store, page.id, envoyer]);

  // Démontage pendant une capture : le flux s'arrête, le local reste — c'est
  // exactement le cas « interrompu » que `pending` proposera à la reprise.
  useEffect(() => () => arreterFlux(), []);

  return {
    status,
    elapsedSeconds,
    progress,
    error,
    /** Le stockage local survit-il à une fermeture ? (IndexedDB oui, mémoire non.) */
    durable: store.durable,
    pending,
    /** Les notes de l'enregistrement en cours ; vides hors capture/envoi. */
    notes,
    setNotes,
    /** La capture en cours (clé, titre, début) ; `null` hors capture/envoi. */
    current,
    /** Le niveau du micro (0 → 1) pendant la capture ; `null` hors capture ou sans mesure. */
    level,
    /** `none` = rien capté depuis plusieurs secondes : l'écran prévient. */
    signal,
    start,
    pause,
    resume,
    stop,
    cancel,
    retry,
    discard,
  };
}

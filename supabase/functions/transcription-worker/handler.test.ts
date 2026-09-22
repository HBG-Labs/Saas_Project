import { assertEquals } from 'jsr:@std/assert@1';

import { TranscriptionRejected } from '../_shared/transcription.ts';
import {
  createTranscriptionWorkerHandler,
  type ClaimedRecording,
  type TranscriptionWorkerConfig,
} from './handler.ts';

/*
  Aucun réseau : le client Supabase répond depuis la mémoire ; stockage et
  fournisseur sont injectés. Ce qui est vérifié : le secret ; la réservation
  refusée donne « quota » sans télécharger ; le chemin nominal donne « done »
  avec texte et résumé ; un refus définitif donne « rejected », une panne
  « error » ; la purge supprime le fichier PUIS marque ; le battement compte.
*/

const SECRET = 'transcription-secret';

function request(secret = SECRET): Request {
  return new Request('https://worker.local', {
    method: 'POST',
    headers: { 'x-worker-secret': secret },
  });
}

function enregistrement(partial: Partial<ClaimedRecording>): ClaimedRecording {
  return {
    id: crypto.randomUUID(),
    organization_id: 'org-1',
    page_id: 'page-1',
    created_by: 'u-1',
    title: 'Réunion',
    audio_path: 'org-1/page-1/a.webm',
    mime_type: 'audio/webm',
    duration_seconds: 90,
    language: 'fr',
    attempts: 0,
    created_at: '2026-09-20T10:00:00Z',
    stt_engine: 'legacy',
    ...partial,
  };
}

function fakeSupabase(
  claimed: ClaimedRecording[],
  options: { reserved?: boolean; purges?: Array<{ id: string; audio_path: string }> } = {},
) {
  const results: Array<Record<string, unknown>> = [];
  const marked: string[] = [];
  const heartbeats: Array<Record<string, unknown>> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const ok = (payload: unknown, status = 200) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    if (url.includes('/rpc/claim_workspace_recordings')) return ok(claimed);
    if (url.includes('/rpc/reserve_transcription_minutes')) {
      return ok({ reserved: options.reserved ?? true, reserved_minutes: 2, remaining_after: 118 });
    }
    if (url.includes('/rpc/record_workspace_recording_result')) {
      results.push(body);
      return ok(null);
    }
    if (url.includes('/rpc/claim_workspace_audio_purges')) return ok(options.purges ?? []);
    if (url.includes('/rpc/mark_workspace_audio_deleted')) {
      marked.push(String(body.p_id));
      return ok(null);
    }
    if (url.includes('/transcription_worker_runs')) {
      heartbeats.push(body);
      return ok([], 201);
    }
    return ok({}, 404);
  };
  return { fetchImpl, results, marked, heartbeats };
}

function config(partial: Partial<TranscriptionWorkerConfig>): TranscriptionWorkerConfig {
  return {
    url: 'https://project.supabase.co',
    serviceRoleKey: 'service-role',
    secret: SECRET,
    downloadAudio: () => Promise.resolve(new Blob(['audio'], { type: 'audio/webm' })),
    removeAudio: () => Promise.resolve(),
    transcribe: () =>
      Promise.resolve({
        text: 'Bonjour à tous. On pose le boîtier jeudi.',
        engine: 'gpt-4o-transcribe',
      }),
    buildPrompt: ({ engine }) => Promise.resolve(engine === 'v2' ? 'Contexte v2' : undefined),
    normalize: () => Promise.resolve(null),
    summarize: () =>
      Promise.resolve({ markdown: '## Décisions\n- Poser le boîtier jeudi', structured: null }),
    ...partial,
  };
}

Deno.test('un mauvais secret est refusé', async () => {
  const fake = fakeSupabase([enregistrement({})]);
  const response = await createTranscriptionWorkerHandler(config({ fetch: fake.fetchImpl }))(
    request('faux'),
  );
  assertEquals(response.status, 401);
  assertEquals(fake.results.length, 0);
});

Deno.test('chemin nominal : texte et résumé rendus à la base', async () => {
  const fake = fakeSupabase([enregistrement({ id: 'r-1' })]);
  const response = await createTranscriptionWorkerHandler(config({ fetch: fake.fetchImpl }))(
    request(),
  );
  assertEquals(response.status, 200);
  assertEquals(fake.results[0], {
    p_id: 'r-1',
    p_outcome: 'done',
    p_transcript: 'Bonjour à tous. On pose le boîtier jeudi.',
    p_summary: '## Décisions\n- Poser le boîtier jeudi',
    p_error: null,
    p_engine: 'gpt-4o-transcribe',
    p_raw: 'Bonjour à tous. On pose le boîtier jeudi.',
    p_normalization: null,
    p_segments: null,
    p_summary_json: null,
  });
  assertEquals(fake.heartbeats[0]?.done, 1);
});

Deno.test(
  'v2 : les paragraphes numérotés sont rendus à la base et au résumé ; le résumé structuré aussi',
  async () => {
    const fake = fakeSupabase([enregistrement({ id: 'seg', stt_engine: 'v2' })]);
    const recus: Array<{ engine: string; ids: string[] }> = [];
    const structure = {
      version: 1 as const,
      points_cles: [{ texte: 'Boîtier jeudi', citations: ['s1'] }],
      decisions: [],
      actions: [],
    };
    await createTranscriptionWorkerHandler(
      config({
        fetch: fake.fetchImpl,
        transcribe: () =>
          Promise.resolve({
            text: 'Premier paragraphe.\n\nSecond paragraphe.',
            engine: 'gpt-transcribe',
          }),
        summarize: ({ engine, segments }) => {
          recus.push({ engine, ids: segments.map((s) => s.id) });
          return Promise.resolve({
            markdown: '## Points clés\n- Boîtier jeudi [§1]',
            structured: structure,
          });
        },
      }),
    )(request());
    assertEquals(recus, [{ engine: 'v2', ids: ['s1', 's2'] }]);
    assertEquals(fake.results[0]?.p_segments, [
      { id: 's1', start: null, end: null, speaker: null, text: 'Premier paragraphe.' },
      { id: 's2', start: null, end: null, speaker: null, text: 'Second paragraphe.' },
    ]);
    assertEquals(fake.results[0]?.p_summary_json, structure);
    assertEquals(fake.results[0]?.p_summary, '## Points clés\n- Boîtier jeudi [§1]');
  },
);

Deno.test('legacy : ni segments ni résumé structuré — comme avant', async () => {
  const fake = fakeSupabase([enregistrement({ id: 'leg', stt_engine: 'legacy' })]);
  const recus: string[][] = [];
  await createTranscriptionWorkerHandler(
    config({
      fetch: fake.fetchImpl,
      summarize: ({ segments }) => {
        recus.push(segments.map((s) => s.id));
        return Promise.resolve({ markdown: '- Rien', structured: null });
      },
    }),
  )(request());
  assertEquals(recus, [[]]);
  assertEquals(fake.results[0]?.p_segments, null);
  assertEquals(fake.results[0]?.p_summary_json, null);
});

Deno.test(
  'normalisation : le brut, le texte normalisé et la trace sont rendus ; le résumé lit le texte normalisé',
  async () => {
    const fake = fakeSupabase([enregistrement({ id: 'n', stt_engine: 'v2' })]);
    const resumeDe: string[] = [];
    await createTranscriptionWorkerHandler(
      config({
        fetch: fake.fetchImpl,
        transcribe: () => Promise.resolve({ text: 'La pto est posée.', engine: 'gpt-transcribe' }),
        normalize: ({ engine, text }) =>
          Promise.resolve(
            engine === 'v2'
              ? {
                  texte: text.replace('pto', 'PTO'),
                  remplacements: [
                    { de: 'pto', vers: 'PTO', occurrences: 1, couche: 'orthographe' },
                  ],
                }
              : null,
          ),
        summarize: ({ transcript }) => {
          resumeDe.push(transcript);
          return Promise.resolve(null);
        },
      }),
    )(request());
    assertEquals(fake.results[0]?.p_raw, 'La pto est posée.');
    assertEquals(fake.results[0]?.p_transcript, 'La PTO est posée.');
    assertEquals(fake.results[0]?.p_normalization, [
      { de: 'pto', vers: 'PTO', occurrences: 1, couche: 'orthographe' },
    ]);
    assertEquals(resumeDe, ['La PTO est posée.']);
  },
);

Deno.test('normalisation en échec : le brut sert de texte, la transcription aboutit', async () => {
  const fake = fakeSupabase([enregistrement({ id: 'n', stt_engine: 'v2' })]);
  await createTranscriptionWorkerHandler(
    config({
      fetch: fake.fetchImpl,
      normalize: () => Promise.reject(new Error('modèle indisponible')),
    }),
  )(request());
  assertEquals(fake.results[0]?.p_outcome, 'done');
  assertEquals(fake.results[0]?.p_transcript, 'Bonjour à tous. On pose le boîtier jeudi.');
  assertEquals(fake.results[0]?.p_raw, 'Bonjour à tous. On pose le boîtier jeudi.');
  assertEquals(fake.results[0]?.p_normalization, null);
});

Deno.test('quota refusé : rien n’est téléchargé, « quota » est rendu', async () => {
  let telechargements = 0;
  const fake = fakeSupabase([enregistrement({ id: 'r-2' })], { reserved: false });
  await createTranscriptionWorkerHandler(
    config({
      fetch: fake.fetchImpl,
      downloadAudio: () => {
        telechargements += 1;
        return Promise.resolve(new Blob());
      },
    }),
  )(request());
  assertEquals(telechargements, 0);
  assertEquals(fake.results[0]?.p_outcome, 'quota');
});

Deno.test(
  'refus définitif → rejected ; panne → error ; résumé absent n’empêche pas done',
  async () => {
    const fake = fakeSupabase([
      enregistrement({ id: 'a' }),
      enregistrement({ id: 'b' }),
      enregistrement({ id: 'c' }),
    ]);
    let appel = 0;
    await createTranscriptionWorkerHandler(
      config({
        fetch: fake.fetchImpl,
        transcribe: () => {
          appel += 1;
          if (appel === 1) return Promise.reject(new TranscriptionRejected('Fichier illisible'));
          if (appel === 2) return Promise.reject(new Error('OpenAI 503'));
          return Promise.resolve({ text: 'Texte.', engine: 'whisper-1' });
        },
        summarize: () => Promise.resolve(null),
      }),
    )(request());
    assertEquals(fake.results[0]?.p_outcome, 'rejected');
    assertEquals(fake.results[0]?.p_error, 'Fichier illisible');
    assertEquals(fake.results[1]?.p_outcome, 'error');
    assertEquals(fake.results[1]?.p_error, 'OpenAI 503');
    assertEquals(fake.results[2]?.p_outcome, 'done');
    assertEquals(fake.results[2]?.p_summary, null);
    assertEquals(fake.heartbeats[0]?.failed, 2);
  },
);

Deno.test(
  'la purge supprime le fichier puis marque ; un échec de suppression ne marque pas',
  async () => {
    const supprimes: string[] = [];
    const fake = fakeSupabase([], {
      purges: [
        { id: 'p-1', audio_path: 'org/page/vieux.webm' },
        { id: 'p-2', audio_path: 'org/page/casse.webm' },
      ],
    });
    await createTranscriptionWorkerHandler(
      config({
        fetch: fake.fetchImpl,
        removeAudio: (paths) => {
          if (paths[0]?.includes('casse')) return Promise.reject(new Error('Storage 500'));
          supprimes.push(...paths);
          return Promise.resolve();
        },
      }),
    )(request());
    assertEquals(supprimes, ['org/page/vieux.webm']);
    assertEquals(fake.marked, ['p-1']);
    assertEquals(fake.heartbeats[0]?.purged, 1);
  },
);

Deno.test(
  'le moteur de l’organisation et son contexte sont transmis à la transcription',
  async () => {
    const recus: Array<{ engine: string; prompt: string | undefined }> = [];
    const fake = fakeSupabase([
      enregistrement({ id: 'l', stt_engine: 'legacy' }),
      enregistrement({ id: 'v', stt_engine: 'v2' }),
    ]);
    await createTranscriptionWorkerHandler(
      config({
        fetch: fake.fetchImpl,
        transcribe: (_audio, _nom, _langue, engine, prompt) => {
          recus.push({ engine, prompt });
          return Promise.resolve({
            text: 'x',
            engine: engine === 'v2' ? 'gpt-transcribe' : 'gpt-4o-transcribe',
          });
        },
      }),
    )(request());
    assertEquals(recus, [
      { engine: 'legacy', prompt: undefined },
      { engine: 'v2', prompt: 'Contexte v2' },
    ]);
    assertEquals(fake.results[0]?.p_engine, 'gpt-4o-transcribe');
    assertEquals(fake.results[1]?.p_engine, 'gpt-transcribe');
  },
);

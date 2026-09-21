import { assertEquals, assertRejects, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  SUMMARY_MAX_CHARS,
  TRANSCRIPTION_FALLBACK_MODEL,
  TRANSCRIPTION_MODEL,
  TranscriptionRejected,
  summaryQuery,
  transcribeAudio,
} from './transcription.ts';

/*
  Ce qui est vérifié : la requête multipart (modèle, langue, fichier) ; le
  repli vers Whisper quand le modèle est refusé ; un fichier trop lourd ou
  refusé est définitif, une panne ne l'est pas ; le résumé reçoit une
  transcription balisée, tronquée au-delà de la limite.
*/

function fauxFetch(reponses: Array<{ status: number; body: unknown }>) {
  const appels: Array<{ model: string | null; language: string | null; fileName: string | null }> =
    [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const form = init?.body as FormData;
    const file = form.get('file');
    appels.push({
      model: form.get('model') as string | null,
      language: form.get('language') as string | null,
      fileName: file instanceof File ? file.name : null,
    });
    const r = reponses.shift() ?? { status: 500, body: 'vide' };
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), {
      status: r.status,
    });
  };
  return { fetchImpl, appels };
}

const audio = new Blob(['bytes'], { type: 'audio/webm' });

Deno.test('envoie le fichier, le modèle et la langue, et rend le texte', async () => {
  const faux = fauxFetch([{ status: 200, body: { text: '  Bonjour.  ' } }]);
  const sortie = await transcribeAudio({
    apiKey: 'k',
    audio,
    fileName: 'a.webm',
    language: 'fr',
    fetchImpl: faux.fetchImpl,
  });
  assertEquals(sortie, { text: 'Bonjour.', engine: TRANSCRIPTION_MODEL });
  assertEquals(faux.appels[0], { model: TRANSCRIPTION_MODEL, language: 'fr', fileName: 'a.webm' });
});

Deno.test('modèle refusé : repli sur Whisper, une fois', async () => {
  const faux = fauxFetch([
    { status: 404, body: 'The model `gpt-4o-transcribe` does not exist' },
    { status: 200, body: { text: 'Via Whisper' } },
  ]);
  const sortie = await transcribeAudio({
    apiKey: 'k',
    audio,
    fileName: 'a.webm',
    language: 'fr',
    fetchImpl: faux.fetchImpl,
  });
  assertEquals(sortie, { text: 'Via Whisper', engine: TRANSCRIPTION_FALLBACK_MODEL });
  assertEquals(
    faux.appels.map((a) => a.model),
    [TRANSCRIPTION_MODEL, TRANSCRIPTION_FALLBACK_MODEL],
  );
});

Deno.test('un fichier refusé est définitif ; une panne ne l’est pas', async () => {
  const refus = fauxFetch([{ status: 400, body: 'Invalid file format' }]);
  await assertRejects(
    () =>
      transcribeAudio({
        apiKey: 'k',
        audio,
        fileName: 'a.webm',
        language: 'fr',
        fetchImpl: refus.fetchImpl,
      }),
    TranscriptionRejected,
  );
  const panne = fauxFetch([{ status: 503, body: 'overloaded' }]);
  const erreur = await assertRejects(() =>
    transcribeAudio({
      apiKey: 'k',
      audio,
      fileName: 'a.webm',
      language: 'fr',
      fetchImpl: panne.fetchImpl,
    }),
  );
  assertEquals(erreur instanceof TranscriptionRejected, false);
});

Deno.test('un fichier trop lourd est refusé avant tout appel', async () => {
  const faux = fauxFetch([]);
  const gros = new Blob([new Uint8Array(26 * 1024 * 1024)]);
  await assertRejects(
    () =>
      transcribeAudio({
        apiKey: 'k',
        audio: gros,
        fileName: 'a.webm',
        language: 'fr',
        fetchImpl: faux.fetchImpl,
      }),
    TranscriptionRejected,
  );
  assertEquals(faux.appels.length, 0);
});

Deno.test('le résumé reçoit la transcription balisée, tronquée au-delà de la limite', () => {
  assertStringIncludes(
    summaryQuery('Bonjour'),
    '<TRANSCRIPTION_UNTRUSTED>\nBonjour\n</TRANSCRIPTION_UNTRUSTED>',
  );
  const longue = summaryQuery('x'.repeat(SUMMARY_MAX_CHARS + 5));
  assertStringIncludes(longue, '[Transcription tronquée');
  assertEquals(longue.includes('x'.repeat(SUMMARY_MAX_CHARS + 1)), false);
});

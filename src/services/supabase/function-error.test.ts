import { describe, expect, it } from 'vitest';

import { messageDeLaFonction } from './function-error';

describe('messageDeLaFonction', () => {
  it('affiche le message utilisateur avant le code technique', async () => {
    const context = new Response(
      JSON.stringify({
        error: 'SOCIAL_CONTENT_GENERATION_FAILED',
        message: 'Social Studio AI est momentanément indisponible.',
      }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );

    await expect(messageDeLaFonction({ context }, 'Erreur de repli.')).resolves.toBe(
      'Social Studio AI est momentanément indisponible.',
    );
  });

  it('conserve le code serveur quand aucun message utilisateur existe', async () => {
    const context = new Response(JSON.stringify({ error: 'SERVER_ERROR' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });

    await expect(messageDeLaFonction({ context }, 'Erreur de repli.')).resolves.toBe(
      'SERVER_ERROR',
    );
  });

  it('utilise le message de repli quand le corps est illisible', async () => {
    const context = new Response('not-json', { status: 500 });

    await expect(messageDeLaFonction({ context }, 'Erreur de repli.')).resolves.toBe(
      'Erreur de repli.',
    );
  });
});

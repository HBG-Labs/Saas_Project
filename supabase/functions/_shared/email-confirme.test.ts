import assert from 'node:assert/strict';

import { emailAppelantConfirme } from './email-confirme.ts';

/*
  Ces tests tournent SANS permission Deno. Ils portent sur une garde dont
  l'échec ne produit aucune erreur visible : elle laisserait simplement passer
  ce qu'elle est censée arrêter.
*/

/** Faux client, réduit à ce que la garde interroge. */
function client(utilisateur: unknown, leve = false) {
  return {
    auth: {
      getUser: () => {
        if (leve) return Promise.reject(new Error('réseau indisponible'));
        return Promise.resolve({ data: { user: utilisateur as never } });
      },
    },
  };
}

Deno.test('une adresse confirmée par Supabase passe', async () => {
  assert.equal(
    await emailAppelantConfirme(client({ email_confirmed_at: '2026-09-09T10:00:00Z' })),
    true,
  );
});

Deno.test('un compte Google passe, via `confirmed_at`', async () => {
  /*
    LE DÉFAUT QUE CE TEST EXISTE POUR EMPÊCHER.

    Google vérifie l'adresse lui-même : Supabase n'envoie aucun message, et
    `email_confirmed_at` peut rester vide alors que `confirmed_at` est posé.

    Ne lire que le premier champ refuserait d'inviter à des comptes
    parfaitement légitimes, en leur demandant de confirmer un e-mail qu'ils
    n'ont jamais reçu — et l'utilisateur n'aurait aucun moyen de s'en sortir.
  */
  assert.equal(await emailAppelantConfirme(client({ confirmed_at: '2026-09-09T10:00:00Z' })), true);
});

Deno.test('une adresse non confirmée est refusée', async () => {
  assert.equal(await emailAppelantConfirme(client({ email_confirmed_at: null })), false);
  assert.equal(
    await emailAppelantConfirme(client({ email_confirmed_at: null, confirmed_at: null })),
    false,
  );
  assert.equal(await emailAppelantConfirme(client({})), false);
});

Deno.test('la garde se ferme quand l’utilisateur est introuvable', async () => {
  assert.equal(await emailAppelantConfirme(client(null)), false);
});

Deno.test('la garde se ferme quand la lecture échoue', async () => {
  /*
    Une panne réseau, un jeton expiré, Supabase indisponible : dans le doute on
    refuse. Une garde qui s'ouvre quand elle ne sait pas ne garde rien — et
    c'est précisément dans ces moments-là qu'on ne le remarquerait pas.
  */
  assert.equal(await emailAppelantConfirme(client({ confirmed_at: 'x' }, true)), false);
});

import type { User } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { emailEstConfirme } from './email-confirmation';

/** Un utilisateur réduit aux seuls champs que la fonction consulte. */
function utilisateur(champs: Partial<User>): User {
  return { id: 'u1', app_metadata: {}, user_metadata: {}, aud: '', created_at: '', ...champs };
}

describe('emailEstConfirme', () => {
  it('reconnaît une adresse confirmée par Supabase', () => {
    expect(emailEstConfirme(utilisateur({ email_confirmed_at: '2026-09-09T10:00:00Z' }))).toBe(true);
  });

  it('reconnaît un compte Google, confirmé par le fournisseur', () => {
    /*
      LE DÉFAUT QUE CE TEST EXISTE POUR EMPÊCHER.

      Google vérifie l'adresse lui-même : Supabase n'envoie aucun message, et
      `email_confirmed_at` peut rester vide alors que `confirmed_at` est posé.

      Ne lire que le premier champ afficherait à ces comptes un bandeau leur
      demandant de confirmer un e-mail qu'ils n'ont jamais reçu, et leur
      refuserait d'inviter leur équipe sans qu'aucune action ne puisse les
      débloquer.
    */
    expect(emailEstConfirme(utilisateur({ confirmed_at: '2026-09-09T10:00:00Z' }))).toBe(true);
  });

  it('refuse une adresse non confirmée', () => {
    // Les deux champs absents : c'est l'état d'un compte tout juste créé
    // pendant que la confirmation est facultative.
    expect(emailEstConfirme(utilisateur({}))).toBe(false);
  });

  it('refuse quand il n’y a pas d’utilisateur', () => {
    // Fermé par défaut : le bandeau ne doit pas s'afficher hors session, et
    // aucune garde ne doit s'ouvrir faute d'information.
    expect(emailEstConfirme(null)).toBe(false);
  });
});

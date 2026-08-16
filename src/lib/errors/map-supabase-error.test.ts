import { describe, expect, it } from 'vitest';

import { AppError } from './app-error';
import { mapAuthError, mapPostgrestError } from './map-supabase-error';

describe('mapPostgrestError', () => {
  it('traduit les codes Postgres en codes applicatifs', () => {
    expect(mapPostgrestError({ message: 'x', code: '23505' }).code).toBe('conflict');
    expect(mapPostgrestError({ message: 'x', code: '42501' }).code).toBe('forbidden');
    expect(mapPostgrestError({ message: 'x', code: 'PGRST116' }).code).toBe('not_found');
    expect(mapPostgrestError({ message: 'x', code: '23503' }).code).toBe('validation');
    expect(mapPostgrestError({ message: 'x', code: '23514' }).code).toBe('validation');
  });

  it('laisse passer les messages rédigés par nos triggers', () => {
    // Ces phrases sont écrites pour l'utilisateur : les remplacer par un
    // libellé générique lui retire la seule information qui dit quoi faire.
    const transition = mapPostgrestError({
      message: 'Transition interdite : in_progress → submitted.',
      code: '23514',
    });
    expect(transition.message).toBe('Transition interdite : in_progress → submitted.');

    const owner = mapPostgrestError({
      message: 'Seul un propriétaire peut nommer un autre propriétaire.',
      code: '42501',
    });
    expect(owner.message).toBe('Seul un propriétaire peut nommer un autre propriétaire.');
  });

  it('écarte les messages produits par PostgreSQL lui-même', () => {
    // Même code, mais la phrase vient du moteur et nomme la table.
    const rls = mapPostgrestError({
      message: 'new row violates row-level security policy for table "missions"',
      code: '42501',
    });

    expect(rls.message).not.toContain('missions');
    expect(rls.message).toBe("Vous n'avez pas les droits nécessaires pour accéder à cette ressource.");
  });

  it('retombe sur le statut HTTP quand le code est inconnu', () => {
    expect(mapPostgrestError({ message: 'x', status: 401 }).code).toBe('unauthenticated');
    expect(mapPostgrestError({ message: 'x', status: 503 }).code).toBe('network');
    expect(mapPostgrestError({ message: 'x' }).code).toBe('unknown');
  });

  it("n'expose jamais le message brut de Postgres", () => {
    const raw = 'duplicate key value violates unique constraint "tools_slug_key"';
    const mapped = mapPostgrestError({ message: raw, code: '23505' });

    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped.message).not.toContain('tools_slug_key');
    expect(mapped.message).toBe('Cet élément existe déjà.');
    // L'erreur d'origine reste disponible pour la journalisation.
    expect(mapped.cause).toMatchObject({ message: raw });
  });
});

describe('mapAuthError', () => {
  it('distingue identifiants invalides et limitation de débit', () => {
    expect(mapAuthError({ message: 'x', status: 400 }).message).toBe('Identifiants incorrects.');
    expect(mapAuthError({ message: 'x', status: 429 }).code).toBe('network');
  });

  it('traduit les erreurs de mot de passe identique ou trop faible', () => {
    expect(
      mapAuthError({ message: 'New password should be different from the old password.', status: 422 }).message,
    ).toBe("Le nouveau mot de passe doit être différent de l'ancien mot de passe.");

    expect(
      mapAuthError({ code: 'weak_password', message: 'Password should be at least 6 characters' }).message,
    ).toBe('Le mot de passe est trop simple ou ne respecte pas les critères de sécurité.');
  });
});


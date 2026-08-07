import { describe, expect, it } from 'vitest';

import { AppError } from './app-error';
import { mapAuthError, mapPostgrestError } from './map-supabase-error';

describe('mapPostgrestError', () => {
  it('traduit les codes Postgres en codes applicatifs', () => {
    expect(mapPostgrestError({ message: 'x', code: '23505' }).code).toBe('conflict');
    expect(mapPostgrestError({ message: 'x', code: '42501' }).code).toBe('forbidden');
    expect(mapPostgrestError({ message: 'x', code: 'PGRST116' }).code).toBe('not_found');
    expect(mapPostgrestError({ message: 'x', code: '23503' }).code).toBe('validation');
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
});

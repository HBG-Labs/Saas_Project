import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runProductionHealthCheck } from './production-healthcheck';

/*
  Les doublures sont déclarées ICI plutôt que retrouvées par `vi.mocked()`.

  Passer par `vi.mocked(supabase.from)` revient à référencer une méthode
  détachée de son objet — ce que `unbound-method` signale à juste titre, même si
  Vitest s'en accommode. Et comme le client réel est typé, chaque doublure
  partielle réclamait un `as any` pour ressembler à un `PostgrestQueryBuilder`
  complet.

  En tenant les fonctions par le bout, on n'a ni l'un ni l'autre : ce sont de
  simples fonctions, et elles acceptent la forme minimale dont le code a
  réellement besoin.
*/
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getSession: vi.fn(),
  listBuckets: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    from: mocks.from,
    auth: { getSession: mocks.getSession },
    storage: { listBuckets: mocks.listBuckets },
  },
}));

describe('runProductionHealthCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('génère un rapport sain quand tous les services répondent', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [{ code: 'pro', name: 'Pro' }], error: null }),
      }),
    });

    mocks.getSession.mockResolvedValue({
      data: { session: { user: { email: 'admin@rezo360.com' } } },
      error: null,
    });

    mocks.listBuckets.mockResolvedValue({
      data: [{ name: 'intervention-attachments' }],
      error: null,
    });

    const report = await runProductionHealthCheck();

    expect(report.checks).toHaveLength(4);
    expect(report.checks.find((c) => c.id === 'database_postgrest')?.status).toBe('healthy');
    expect(report.checks.find((c) => c.id === 'supabase_auth')?.status).toBe('healthy');
    expect(report.checks.find((c) => c.id === 'supabase_storage')?.status).toBe('healthy');
  });

  it('remonte une alerte en cas d’erreur PostgREST', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Timeout' } }),
      }),
    });

    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    mocks.listBuckets.mockResolvedValue({
      data: [],
      error: null,
    });

    const report = await runProductionHealthCheck();

    expect(report.allHealthy).toBe(false);
    expect(report.checks.find((c) => c.id === 'database_postgrest')?.status).toBe('error');
  });
});

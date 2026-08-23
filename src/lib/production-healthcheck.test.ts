import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runProductionHealthCheck } from './production-healthcheck';
import { supabase } from '@/services/supabase';

vi.mock('@/services/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
    storage: {
      listBuckets: vi.fn(),
    },
  },
}));

describe('runProductionHealthCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('génère un rapport sain quand tous les services répondent', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [{ code: 'pro', name: 'Pro' }], error: null }),
      }),
    } as any);

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { email: 'admin@rezo360.com' } } as any },
      error: null,
    });

    vi.mocked(supabase.storage.listBuckets).mockResolvedValue({
      data: [{ name: 'intervention-attachments' }] as any,
      error: null,
    });

    const report = await runProductionHealthCheck();

    expect(report.checks).toHaveLength(4);
    expect(report.checks.find((c) => c.id === 'database_postgrest')?.status).toBe('healthy');
    expect(report.checks.find((c) => c.id === 'supabase_auth')?.status).toBe('healthy');
    expect(report.checks.find((c) => c.id === 'supabase_storage')?.status).toBe('healthy');
  });

  it('remonte une alerte en cas d’erreur PostgREST', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Timeout' } }),
      }),
    } as any);

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    vi.mocked(supabase.storage.listBuckets).mockResolvedValue({
      data: [],
      error: null,
    });

    const report = await runProductionHealthCheck();

    expect(report.allHealthy).toBe(false);
    expect(report.checks.find((c) => c.id === 'database_postgrest')?.status).toBe('error');
  });
});

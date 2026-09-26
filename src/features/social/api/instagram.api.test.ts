import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getInstagramAccount,
  startInstagramConnection,
  instagramAccountColumns,
} from './instagram.api';

const { getSession, refreshSession, invoke, from, unwrapMaybe, messageDeLaFonction } = vi.hoisted(
  () => ({
    getSession: vi.fn(),
    refreshSession: vi.fn(),
    invoke: vi.fn(),
    from: vi.fn(),
    unwrapMaybe: vi.fn(),
    messageDeLaFonction: vi.fn().mockResolvedValue('Erreur précise Instagram.'),
  }),
);

vi.mock('@/services/supabase', () => ({
  supabase: { auth: { getSession, refreshSession }, functions: { invoke }, from },
  unwrapMaybe,
  messageDeLaFonction,
}));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({
    data: { session: { access_token: 'fresh-token', expires_at: Date.now() / 1000 + 3600 } },
    error: null,
  });
  refreshSession.mockResolvedValue({
    data: { session: { access_token: 'renewed-token', expires_at: Date.now() / 1000 + 3600 } },
    error: null,
  });
});

describe('API Instagram frontend', () => {
  it('lit uniquement des colonnes non sensibles de social_accounts', async () => {
    const maybeSingle = vi.fn();
    const secondEq = vi.fn(() => ({ maybeSingle }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const select = vi.fn(() => ({ eq: firstEq }));
    from.mockReturnValue({ select });
    unwrapMaybe.mockResolvedValue(null);

    await expect(getInstagramAccount('org-1')).resolves.toBeNull();

    expect(from).toHaveBeenCalledWith('social_accounts');
    expect(select).toHaveBeenCalledWith(instagramAccountColumns);
    expect(instagramAccountColumns).not.toMatch(/token|secret|ciphertext|refresh/i);
  });

  it('démarre OAuth via la fonction Edge et accepte uniquement instagram.com', async () => {
    invoke.mockResolvedValue({
      data: { url: 'https://www.instagram.com/oauth/authorize?state=abc' },
      error: null,
    });

    await expect(startInstagramConnection('org-1')).resolves.toContain('instagram.com');
    expect(invoke).toHaveBeenCalledWith('instagram-connection', {
      headers: { Authorization: 'Bearer fresh-token' },
      body: {
        organizationId: 'org-1',
        action: 'start',
        returnUrl: `${window.location.origin}/settings`,
      },
    });

    invoke.mockResolvedValue({ data: { url: 'https://example.org/oauth/authorize' }, error: null });
    await expect(startInstagramConnection('org-1')).rejects.toThrow('invalide');
  });

  it('remonte le message précis de la fonction Edge', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('forbidden') });

    await expect(startInstagramConnection('org-1')).rejects.toThrow('Erreur précise Instagram');
    expect(messageDeLaFonction).toHaveBeenCalled();
  });
});

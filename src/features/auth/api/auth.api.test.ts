import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSignInWithOAuth } = vi.hoisted(() => ({
  mockSignInWithOAuth: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  },
}));

import { signInWithGoogle } from './auth.api';

describe('signInWithGoogle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ouvre Google avec le callback PKCE de l’application', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ data: { url: 'https://accounts.google.com' } });

    await signInWithGoogle();

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  });

  it('traduit une erreur Supabase avant de la présenter à l’utilisateur', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({
      data: { url: null },
      error: {
        code: 'validation_failed',
        message: 'Unsupported provider: provider is not enabled',
        status: 400,
      },
    });

    await expect(signInWithGoogle()).rejects.toMatchObject({
      code: 'validation',
      message: expect.stringContaining('Google'),
    });
  });
});

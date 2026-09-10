import { beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '@/config/env';

const { mockResetPasswordForEmail, mockSignInWithOAuth } = vi.hoisted(() => ({
  mockResetPasswordForEmail: vi.fn(),
  mockSignInWithOAuth: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
      signInWithOAuth: mockSignInWithOAuth,
    },
  },
}));

import { requestPasswordReset, signInWithGoogle } from './auth.api';

const appOrigin = (env.VITE_PUBLIC_APP_URL ?? window.location.origin).replace(/\/$/, '');

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
        redirectTo: `${appOrigin}/auth/callback`,
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

describe('requestPasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirige le lien vers le formulaire de nouveau mot de passe', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });

    await requestPasswordReset('jean@exemple.fr');

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('jean@exemple.fr', {
      redirectTo: `${appOrigin}/reset-password`,
    });
  });
});

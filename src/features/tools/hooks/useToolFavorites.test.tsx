import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '@/features/auth';
import { useToolFavorites } from './useToolFavorites';

const mockUseFavorites = vi.fn();
const mockUseCatalogTools = vi.fn();
const mockAddFavorite = vi.fn();
const mockRemoveFavorite = vi.fn();

vi.mock('@/features/catalog', () => ({
  useFavorites: () => mockUseFavorites(),
  useCatalogTools: () => mockUseCatalogTools(),
  addFavorite: (...args: unknown[]) => mockAddFavorite(...args),
  removeFavorite: (...args: unknown[]) => mockRemoveFavorite(...args),
}));

function createWrapper(userId: string | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const authValue = {
    status: userId ? ('authenticated' as const) : ('unauthenticated' as const),
    user: userId ? ({ id: userId, email: 'test@example.com' } as any) : null,
    session: null,
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
  };

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    );
  };
}

describe('useToolFavorites', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockUseFavorites.mockReturnValue({ data: [], isPending: false, error: null });
    mockUseCatalogTools.mockReturnValue({
      data: [{ id: 'tool-1', slug: 'ohm-law', name: 'Loi d’Ohm' }],
      isPending: false,
      error: null,
    });
  });

  it('ajoute et retire un favori en mode invité (localStorage)', () => {
    const { result } = renderHook(() => useToolFavorites(), {
      wrapper: createWrapper(null),
    });

    expect(result.current.isFavorite('ohm-law')).toBe(false);

    act(() => {
      result.current.toggleFavorite('ohm-law');
    });

    expect(result.current.isFavorite('ohm-law')).toBe(true);
    expect(result.current.favorites).toContain('ohm-law');

    act(() => {
      result.current.toggleFavorite('ohm-law');
    });

    expect(result.current.isFavorite('ohm-law')).toBe(false);
    expect(result.current.favorites).not.toContain('ohm-law');
  });

  it('synchronise avec le serveur lorsque l’utilisateur est connecté', async () => {
    const { result } = renderHook(() => useToolFavorites(), {
      wrapper: createWrapper('user-123'),
    });

    await act(async () => {
      result.current.toggleFavorite('ohm-law');
    });

    expect(result.current.isFavorite('ohm-law')).toBe(true);
    expect(mockAddFavorite).toHaveBeenCalledWith('user-123', 'tool-1');

    await act(async () => {
      result.current.toggleFavorite('ohm-law');
    });

    expect(result.current.isFavorite('ohm-law')).toBe(false);
    expect(mockRemoveFavorite).toHaveBeenCalledWith('user-123', 'tool-1');
  });
});

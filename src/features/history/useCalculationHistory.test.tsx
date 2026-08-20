import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '@/features/auth/context/auth-context';
import { useCalculationHistory } from './useCalculationHistory';

vi.mock('@/features/billing', () => ({
  FEATURES: { calculationHistory: 'calculation_history' },
  useUserEntitlements: () => ({
    planCode: 'free',
    limit: () => Infinity,
  }),
}));

describe('useCalculationHistory — Isolation stricte par compte', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const createWrapper = (userId: string | null) => {
    const mockAuth: AuthContextValue = {
      status: userId ? 'authenticated' : 'unauthenticated',
      session: null,
      user: userId ? ({ id: userId, email: `${userId}@test.com` } as any) : null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    };

    return ({ children }: { children: ReactNode }) => (
      <AuthContext value={mockAuth}>{children}</AuthContext>
    );
  };

  it('isole l’historique de la calculatrice entre deux comptes distincts', () => {
    // 1. Utilisateur A calcule une formule dans la calculatrice
    const { result: hookUserA } = renderHook(
      () => useCalculationHistory('scientific-calculator'),
      { wrapper: createWrapper('user_leduc') },
    );

    act(() => {
      hookUserA.current.addEntry({
        toolSlug: 'scientific-calculator',
        toolTitle: 'Calculatrice Scientifique',
        expression: '125 * 8',
        formattedResult: '1 000',
      });
    });

    expect(hookUserA.current.entries).toHaveLength(1);
    expect(hookUserA.current.entries[0]?.formattedResult).toBe('1 000');

    // 2. Utilisateur B se connecte sur la même machine
    const { result: hookUserB } = renderHook(
      () => useCalculationHistory('scientific-calculator'),
      { wrapper: createWrapper('user_nouveau_compte') },
    );

    // L'utilisateur B a un historique VIERGE
    expect(hookUserB.current.entries).toHaveLength(0);

    // 3. Vérification du stockage local
    expect(localStorage.getItem('rezo360_calculation_history_user_leduc')).toContain('1 000');
    expect(localStorage.getItem('rezo360_calculation_history_user_nouveau_compte')).toBeNull();
  });
});

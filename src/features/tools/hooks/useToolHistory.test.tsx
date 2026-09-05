import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '@/features/auth/context/auth-context';
import { useToolHistory } from './useToolHistory';

describe('useToolHistory — Isolation stricte par compte utilisateur', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const createWrapper = (userId: string | null) => {
    const mockAuth: AuthContextValue = {
      status: userId ? 'authenticated' : 'unauthenticated',
      session: null,
      // Seuls `id` et `email` sont lus ici : le reste de `User` n'a pas à être
      // inventé, d'où l'assertion — mais sur le type réel, pas sur `any`.
      user: userId
        ? ({ id: userId, email: `${userId}@test.com` } as AuthContextValue['user'])
        : null,
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    };

    return ({ children }: { children: ReactNode }) => (
      <AuthContext value={mockAuth}>{children}</AuthContext>
    );
  };

  it('isole totalement l’historique entre deux comptes distincts', () => {
    // 1. Utilisateur A (ex: leduc@live.fr) calcule une valeur
    const { result: resultUserA } = renderHook(() => useToolHistory(), {
      wrapper: createWrapper('user_leduc'),
    });

    act(() => {
      resultUserA.current.addHistoryEntry({
        toolSlug: 'scientific-calculator',
        toolName: 'Calculatrice Scientifique',
        summary: '2 * 42',
        result: '84',
        inputs: { expression: '2 * 42' },
      });
    });

    expect(resultUserA.current.history).toHaveLength(1);
    expect(resultUserA.current.history[0]?.result).toBe('84');

    // 2. Un nouvel utilisateur B se connecte sur le même navigateur
    const { result: resultUserB } = renderHook(() => useToolHistory(), {
      wrapper: createWrapper('user_new_account'),
    });

    // L'utilisateur B ne doit ABSOLUMENT PAS voir l'historique de l'utilisateur A
    expect(resultUserB.current.history).toHaveLength(0);

    // 3. L'utilisateur B ajoute son propre calcul
    act(() => {
      resultUserB.current.addHistoryEntry({
        toolSlug: 'power-calculator',
        toolName: 'Calculateur de Puissance',
        summary: 'P = 3 kW',
        result: '3000 W',
        inputs: { kw: 3 },
      });
    });

    expect(resultUserB.current.history).toHaveLength(1);
    expect(resultUserB.current.history[0]?.result).toBe('3000 W');

    // 4. Vérification dans localStorage : 2 clés distinctes et étanches
    expect(localStorage.getItem('rezo360_tools_history_user_leduc')).toContain('84');
    expect(localStorage.getItem('rezo360_tools_history_user_new_account')).toContain('3000 W');
  });

  it('gère le mode anonyme sans écraser les comptes connectés', () => {
    const { result: resultAnon } = renderHook(() => useToolHistory(), {
      wrapper: createWrapper(null),
    });

    act(() => {
      resultAnon.current.addHistoryEntry({
        toolSlug: 'distance-calculator',
        toolName: 'Calculateur de Distance',
        summary: '100 m',
        result: '0.1 km',
        inputs: { meters: 100 },
      });
    });

    expect(resultAnon.current.history).toHaveLength(1);
    expect(localStorage.getItem('rezo360_tools_history_anonymous')).toContain('0.1 km');
  });
});

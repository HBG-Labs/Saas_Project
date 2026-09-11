import type { User } from '@supabase/supabase-js';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useContext, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '@/features/auth';
import { createQueryClient } from '@/lib/query-client';
import type { Organization, OrganizationMember } from '@/types/domain';

import { OrganizationContext } from './organization-context';
import { OrganizationProvider } from './OrganizationProvider';

const mocks = vi.hoisted(() => ({
  listMyOrganizations: vi.fn(),
  getMyMembership: vi.fn(),
}));

vi.mock('../api/organizations.api', () => ({
  listMyOrganizations: mocks.listMyOrganizations,
  getMyMembership: mocks.getMyMembership,
}));

const USER_ID = 'user-1';

function organization(id: string, name: string): Organization {
  return { id, name } as unknown as Organization;
}

function membership(organizationId: string): OrganizationMember {
  return {
    id: `member-${organizationId}`,
    organization_id: organizationId,
    user_id: USER_ID,
    role: 'owner',
    status: 'active',
  } as unknown as OrganizationMember;
}

function createWrapper() {
  const queryClient = createQueryClient();
  const authValue = {
    status: 'authenticated' as const,
    user: { id: USER_ID, email: 'owner@example.com' } as unknown as User,
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
        <AuthContext.Provider value={authValue}>
          <OrganizationProvider>{children}</OrganizationProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
  };
}

function renderProvider() {
  return renderHook(() => useContext(OrganizationContext), { wrapper: createWrapper() });
}

/*
  CE QUE CES DEUX CAS PROTÈGENT.

  La purge du cache au changement d'organisation retirait les requêtes ENCORE
  MONTÉES. Une requête retirée pendant que sa promesse est en vol n'a plus où
  écrire son résultat : `isPending` ne redevient jamais `false`, `status` reste
  `loading`, et le tableau de bord ne quitte plus son squelette — indéfiniment.

  Le test de `query-client.test.ts` ne pouvait pas le voir : il ne pose ses
  entrées qu'avec `setQueryData`, donc sans observateur. C'est ici, à travers le
  provider réel, que la requête d'appartenance est effectivement montée au
  moment où la purge tombe.
*/
describe('OrganizationProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.getMyMembership.mockImplementation((organizationId: string) =>
      Promise.resolve(membership(organizationId)),
    );
  });

  it('atteint « ready » quand la première organisation arrive', async () => {
    mocks.listMyOrganizations.mockResolvedValue([organization('org-a', 'Alpha')]);

    const { result } = renderProvider();

    await waitFor(() => expect(result.current?.status).toBe('ready'));
    expect(result.current?.organization?.id).toBe('org-a');
    expect(result.current?.role).toBe('owner');
  });

  it('atteint « ready » après un changement d’organisation', async () => {
    mocks.listMyOrganizations.mockResolvedValue([
      organization('org-a', 'Alpha'),
      organization('org-b', 'Beta'),
    ]);

    const { result } = renderProvider();
    await waitFor(() => expect(result.current?.status).toBe('ready'));

    result.current?.select('org-b');

    await waitFor(() => expect(result.current?.organization?.id).toBe('org-b'));
    await waitFor(() => expect(result.current?.status).toBe('ready'));
    expect(result.current?.membership?.organization_id).toBe('org-b');
  });
});

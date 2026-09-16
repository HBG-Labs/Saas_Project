import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';
import type { ProspectFollowup } from '@/types/domain';

const { scheduleFollowup, completeFollowup, canManage } = vi.hoisted(() => ({
  scheduleFollowup: vi.fn(),
  completeFollowup: vi.fn(),
  canManage: { current: true },
}));

vi.mock('../api/prospecting.api', async () => {
  const actual = await vi.importActual<typeof import('../api/prospecting.api')>('../api/prospecting.api');
  return { ...actual, scheduleFollowup, completeFollowup };
});

vi.mock('../hooks/usePlatformAdmin', () => ({
  usePlatformAdmin: () => ({
    isAdmin: true,
    isLoading: false,
    can: (permission: string) => permission === 'prospecting.manage' && canManage.current,
  }),
}));

// `useScheduleFollowup` lit `useAuth()` pour l'auteur — mocké pour éviter la
// dépendance à un vrai `<AuthProvider>`, absent de `renderWithProviders`.
vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth')>('@/features/auth');
  return { ...actual, useAuth: () => ({ user: { id: 'admin-1' } }) };
});

import { ProspectFollowupsPanel } from './ProspectFollowupsPanel';

const SIREN = '123456789';

function followup(overrides: Partial<ProspectFollowup> = {}): ProspectFollowup {
  return {
    id: 'followup-1',
    siren: SIREN,
    due_at: '2026-09-30T09:00:00Z',
    note: null,
    kind: null,
    completed_at: null,
    created_by: null,
    created_at: '2026-09-24T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  canManage.current = true;
  scheduleFollowup.mockResolvedValue(followup());
  completeFollowup.mockResolvedValue(undefined);
});

describe('ProspectFollowupsPanel', () => {
  it('marque une relance comme traitée au clic', async () => {
    renderWithProviders(<ProspectFollowupsPanel siren={SIREN} followups={[followup()]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Traitée' }));

    await waitFor(() => {
      expect(completeFollowup).toHaveBeenCalledWith('followup-1');
    });
  });

  it('masque la programmation et le bouton « Traitée » pour un administrateur sans prospecting.manage', () => {
    canManage.current = false;
    renderWithProviders(<ProspectFollowupsPanel siren={SIREN} followups={[followup()]} />);

    expect(screen.queryByRole('button', { name: 'Traitée' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Programmer une relance')).not.toBeInTheDocument();
    expect(screen.getByText(/lecture seule/i)).toBeInTheDocument();
  });
});

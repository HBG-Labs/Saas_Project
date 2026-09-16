import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';
import type { ProspectNote } from '@/types/domain';

const { addProspectNote, canManage } = vi.hoisted(() => ({
  addProspectNote: vi.fn(),
  canManage: { current: true },
}));

vi.mock('../api/prospecting.api', async () => {
  const actual = await vi.importActual<typeof import('../api/prospecting.api')>('../api/prospecting.api');
  return { ...actual, addProspectNote };
});

vi.mock('../hooks/usePlatformAdmin', () => ({
  usePlatformAdmin: () => ({
    isAdmin: true,
    isLoading: false,
    can: (permission: string) => permission === 'prospecting.manage' && canManage.current,
  }),
}));

// `useAddProspectNote` lit `useAuth()` pour l'auteur — mocké pour éviter la
// dépendance à un vrai `<AuthProvider>`, absent de `renderWithProviders`.
vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth')>('@/features/auth');
  return { ...actual, useAuth: () => ({ user: { id: 'admin-1' } }) };
});

import { ProspectNotesPanel } from './ProspectNotesPanel';

const SIREN = '123456789';

function note(overrides: Partial<ProspectNote> = {}): ProspectNote {
  return {
    id: 'note-1',
    siren: SIREN,
    body: 'Rappelé, ne répond pas.',
    author_id: null,
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  canManage.current = true;
  addProspectNote.mockResolvedValue(note());
});

describe('ProspectNotesPanel', () => {
  it('ajoute une note au clic', async () => {
    renderWithProviders(<ProspectNotesPanel siren={SIREN} notes={[]} />);

    fireEvent.change(screen.getByPlaceholderText('Ajouter une note interne…'), {
      target: { value: 'Nouvelle note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter la note' }));

    await waitFor(() => {
      expect(addProspectNote).toHaveBeenCalledWith({ siren: SIREN, body: 'Nouvelle note', authorId: 'admin-1' });
    });
  });

  it('masque le formulaire pour un administrateur sans prospecting.manage, sans cacher les notes existantes', () => {
    canManage.current = false;
    renderWithProviders(<ProspectNotesPanel siren={SIREN} notes={[note()]} />);

    expect(screen.getByText('Rappelé, ne répond pas.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Ajouter une note interne…')).not.toBeInTheDocument();
    expect(screen.getByText(/lecture seule/i)).toBeInTheDocument();
  });
});

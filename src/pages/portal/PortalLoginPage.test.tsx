import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors';
import PortalLoginPage from '@/pages/portal/PortalLoginPage';
import { renderWithProviders } from '@/test/utils';

const api = vi.hoisted(() => ({
  requestAccessCode: vi.fn(),
  verifyAccessCode: vi.fn(),
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ status: 'unauthenticated', user: null, session: null }),
}));

vi.mock('@/features/portal', () => ({
  requestAccessCode: api.requestAccessCode,
  verifyAccessCode: api.verifyAccessCode,
}));

describe('PortalLoginPage — connexion par code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.requestAccessCode.mockResolvedValue(undefined);
  });

  it('AC04 — une adresse, puis un code : la réponse est la même pour toute adresse', async () => {
    renderWithProviders(<PortalLoginPage />, { route: '/portail/connexion' });

    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: 'jean@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /recevoir un code/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/code reçu par e-mail/i)).toBeInTheDocument();
    });
    expect(api.requestAccessCode).toHaveBeenCalledWith('jean@example.com');
    // Le message ne dit pas si l'adresse a accès : « si … a accès ».
    expect(screen.getByText(/si jean@example.com a accès/i)).toBeInTheDocument();
  });

  it('AC05 — un code faux ou expiré est refusé avec un message, sans révéler davantage', async () => {
    api.verifyAccessCode.mockRejectedValue(new AppError('validation', 'Code invalide ou expiré. Demandez-en un nouveau.'));
    renderWithProviders(<PortalLoginPage />, { route: '/portail/connexion' });

    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: 'jean@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /recevoir un code/i }));
    const champ = await screen.findByLabelText(/code reçu par e-mail/i);
    fireEvent.change(champ, { target: { value: '12345678' } });
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => {
      expect(screen.getByText(/code invalide ou expiré/i)).toBeInTheDocument();
    });
    expect(api.verifyAccessCode).toHaveBeenCalledWith('jean@example.com', '12345678');
  });

  it('le champ du code n’accepte que des chiffres et exige au moins six', async () => {
    renderWithProviders(<PortalLoginPage />, { route: '/portail/connexion' });
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: 'jean@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /recevoir un code/i }));
    const champ = await screen.findByLabelText(/code reçu par e-mail/i);
    fireEvent.change(champ, { target: { value: '12a4' } });
    expect((champ as HTMLInputElement).value).toBe('124');
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeDisabled();
  });
});

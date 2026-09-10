import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ResetPasswordPage from './ResetPasswordPage';

const auth = vi.hoisted(() => ({
  status: 'unauthenticated',
  signOut: vi.fn(),
  updatePassword: vi.fn(),
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ status: auth.status, signOut: auth.signOut }),
  updatePassword: auth.updatePassword,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

describe('réinitialisation du mot de passe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.status = 'unauthenticated';
    auth.signOut.mockResolvedValue(undefined);
    auth.updatePassword.mockResolvedValue(undefined);
  });

  it('refuse un lien qui n’a ouvert aucune session de récupération', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Lien invalide ou expiré' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Demander un nouveau lien' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('valide la confirmation avant tout appel à Supabase', async () => {
    auth.status = 'authenticated';
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), 'MotDePasseSolide123!');
    await user.type(
      screen.getByLabelText(/^Confirmer le nouveau mot de passe/),
      'AutreMotDePasse!',
    );
    await user.click(screen.getByRole('button', { name: 'Enregistrer le nouveau mot de passe' }));

    expect(await screen.findByText(/Les mots de passe ne correspondent pas/)).toBeInTheDocument();
    expect(auth.updatePassword).not.toHaveBeenCalled();
  });

  it('met à jour le mot de passe puis ferme la session de récupération', async () => {
    auth.status = 'authenticated';
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), 'MotDePasseSolide123!');
    await user.type(
      screen.getByLabelText(/^Confirmer le nouveau mot de passe/),
      'MotDePasseSolide123!',
    );
    await user.click(screen.getByRole('button', { name: 'Enregistrer le nouveau mot de passe' }));

    await waitFor(() => expect(auth.updatePassword).toHaveBeenCalledWith('MotDePasseSolide123!'));
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole('heading', { name: 'Mot de passe modifié' }),
    ).toBeInTheDocument();
  });
});

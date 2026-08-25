import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors';
import RegisterPage from '@/pages/RegisterPage';
import { renderWithProviders } from '@/test/utils';

const mockSignUp = vi.fn();

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
    status: 'unauthenticated',
    user: null,
    session: null,
  }),
}));

describe('RegisterPage (Tunnel d’inscription)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le formulaire d’inscription complet avec le plan Free par défaut', () => {
    renderWithProviders(<RegisterPage />, { route: '/register' });

    expect(screen.getByRole('heading', { name: /Créer un compte/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nom affiché/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Adresse e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mot de passe/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirmer le mot de passe/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créer mon compte gratuit/i })).toBeInTheDocument();
  });

  it('pré-sélectionne le plan spécifié dans l’URL (?plan=pro)', () => {
    renderWithProviders(<RegisterPage />, { route: '/register?plan=pro' });

    expect(screen.getAllByText(/Formule Pro/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Démarrer avec Pro/i })).toBeInTheDocument();
    expect(screen.getByText(/39 € \/ mois/i)).toBeInTheDocument();
  });

  it('permet de basculer dynamiquement entre les différentes formules', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: '/register' });

    // Clic sur Starter (19€/m)
    const starterBtn = screen.getByRole('button', { name: /Starter/i });
    await user.click(starterBtn);

    expect(screen.getAllByText(/Formule Starter/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Démarrer avec Starter/i })).toBeInTheDocument();

    // Clic sur Business (79€/m)
    const businessBtn = screen.getByRole('button', { name: /Business/i });
    await user.click(businessBtn);

    expect(screen.getAllByText(/Formule Business/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Démarrer avec Business/i })).toBeInTheDocument();
  });

  it('bloque la soumission et affiche les erreurs de validation si les champs sont vides', async () => {
    renderWithProviders(<RegisterPage />, { route: '/register' });

    const submitBtn = screen.getByRole('button', { name: /Créer mon compte gratuit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Le nom doit contenir au moins 2 caractères/i)).toBeInTheDocument();
      expect(screen.getByText(/Adresse e-mail invalide/i)).toBeInTheDocument();
      expect(screen.getByText(/Le mot de passe doit contenir au moins 8 caractères/i)).toBeInTheDocument();
    });

    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('valide le format de l’email et la concordance des mots de passe', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: '/register' });

    await user.type(screen.getByLabelText(/Nom affiché/i), 'Jean Dupont');
    await user.type(screen.getByLabelText(/Adresse e-mail/i), 'email-invalide');
    await user.type(screen.getByLabelText(/^Mot de passe/i), 'Password123!');
    await user.type(screen.getByLabelText(/Confirmer le mot de passe/i), 'DifferentPassword123!');

    await user.click(screen.getByRole('button', { name: /Créer mon compte gratuit/i }));

    await waitFor(() => {
      expect(screen.getByText(/Adresse e-mail invalide/i)).toBeInTheDocument();
      expect(screen.getByText(/Les mots de passe ne correspondent pas/i)).toBeInTheDocument();
    });

    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('soumet les informations valides et affiche la page de confirmation mail', async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValueOnce(undefined);

    renderWithProviders(<RegisterPage />, { route: '/register' });

    await user.type(screen.getByLabelText(/Nom affiché/i), 'Alexandre Martin');
    await user.type(screen.getByLabelText(/Adresse e-mail/i), 'alex.martin@example.com');
    await user.type(screen.getByLabelText(/^Mot de passe/i), 'SuperMotDePasse123!');
    await user.type(screen.getByLabelText(/Confirmer le mot de passe/i), 'SuperMotDePasse123!');

    await user.click(screen.getByRole('button', { name: /Créer mon compte gratuit/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'alex.martin@example.com',
        'SuperMotDePasse123!',
        'Alexandre Martin',
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Vérifiez votre boîte mail/i)).toBeInTheDocument();
      expect(screen.getByText(/Un lien de confirmation vous a été envoyé/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Aller à la connexion/i })).toBeInTheDocument();
    });
  });

  it('affiche un message d’erreur en cas d’échec du service d’authentification', async () => {
    const user = userEvent.setup();
    mockSignUp.mockRejectedValueOnce(new AppError('conflict', 'Cet utilisateur existe déjà.'));

    renderWithProviders(<RegisterPage />, { route: '/register' });

    await user.type(screen.getByLabelText(/Nom affiché/i), 'Alexandre Martin');
    await user.type(screen.getByLabelText(/Adresse e-mail/i), 'deja.pris@example.com');
    await user.type(screen.getByLabelText(/^Mot de passe/i), 'SuperMotDePasse123!');
    await user.type(screen.getByLabelText(/Confirmer le mot de passe/i), 'SuperMotDePasse123!');

    await user.click(screen.getByRole('button', { name: /Créer mon compte gratuit/i }));

    await waitFor(() => {
      expect(screen.getByText(/Cet utilisateur existe déjà/i)).toBeInTheDocument();
    });
  });
});

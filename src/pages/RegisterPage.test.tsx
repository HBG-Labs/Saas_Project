import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors';
import RegisterPage from '@/pages/RegisterPage';
import { renderWithProviders } from '@/test/utils';

const mockSignUp = vi.fn();
const mockSignInWithGoogle = vi.fn();

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
    signInWithGoogle: mockSignInWithGoogle,
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
    expect(screen.getByRole('button', { name: /Continuer avec Google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créer mon compte gratuit/i })).toBeInTheDocument();
  });

  it('ouvre le parcours Google sans valider les champs du formulaire', async () => {
    const user = userEvent.setup();
    mockSignInWithGoogle.mockResolvedValueOnce(undefined);

    renderWithProviders(<RegisterPage />, { route: '/register?plan=pro' });

    await user.click(screen.getByRole('button', { name: /Continuer avec Google/i }));

    expect(mockSignInWithGoogle).toHaveBeenCalledOnce();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('explique un échec du parcours Google sans masquer le formulaire e-mail', async () => {
    const user = userEvent.setup();
    mockSignInWithGoogle.mockRejectedValueOnce(
      new AppError('validation', 'La connexion avec Google n’est pas encore activée.'),
    );

    renderWithProviders(<RegisterPage />, { route: '/register' });

    await user.click(screen.getByRole('button', { name: /Continuer avec Google/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La connexion avec Google n’est pas encore activée.',
    );
    expect(screen.getByLabelText(/Adresse e-mail/i)).toBeInTheDocument();
  });

  it('rappelle la formule visée quand on arrive depuis les tarifs', () => {
    renderWithProviders(<RegisterPage />, { route: '/register?plan=pro' });

    // L'intention portée par l'URL est conservée et affichée…
    expect(screen.getByText(/Vous pourrez activer la formule/i)).toBeInTheDocument();
    expect(screen.getByText(/Aucun paiement à cette étape/i)).toBeInTheDocument();
    // …mais elle n'est plus une décision à prendre ici.
    expect(screen.queryByRole('button', { name: /Démarrer mon essai/i })).not.toBeInTheDocument();
  });

  it('ne fait plus arbitrer entre cinq formules avant de s’inscrire', () => {
    /*
      LE DÉFAUT QUE CE TEST EXISTE POUR EMPÊCHER.

      Le formulaire présentait cinq formules cliquables juste avant le bouton
      de validation. Deux problèmes, dont le second est le pire :

        • une décision commerciale imposée au moment le plus coûteux du
          tunnel, alors que le visiteur n'a encore rien vu du produit ;
        • `selectedPlan` n'était JAMAIS transmis à `signUp`. Quelle que soit
          la carte cliquée, le compte créé était identique — on faisait
          arbitrer sur un choix qui ne tenait pas au-delà de l'écran.

      Le bouton annonçait même « Démarrer mon essai Pro (0 €) » sans qu'aucun
      essai ne démarre. Promettre un acte que le clic n'accomplit pas est le
      plus sûr moyen de perdre la confiance gagnée sur la page précédente.
    */
    renderWithProviders(<RegisterPage />, { route: '/register' });

    for (const formule of ['Starter', 'Business', 'Enterprise']) {
      expect(screen.queryByRole('button', { name: new RegExp(formule, 'i') })).not.toBeInTheDocument();
    }

    expect(screen.getByRole('button', { name: /Créer mon compte gratuit/i })).toBeInTheDocument();
    expect(screen.getByText(/Sans carte bancaire/i)).toBeInTheDocument();
  });

  it('bloque la soumission et affiche les erreurs de validation si les champs sont vides', async () => {
    renderWithProviders(<RegisterPage />, { route: '/register' });

    const submitBtn = screen.getByRole('button', { name: /Créer mon compte gratuit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Le nom doit contenir au moins 2 caractères/i)).toBeInTheDocument();
      expect(screen.getByText(/Adresse e-mail invalide/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Le mot de passe doit contenir au moins 8 caractères/i),
      ).toBeInTheDocument();
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

  it('permet d’afficher séparément le mot de passe et sa confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: '/register' });

    const password = screen.getByLabelText(/^Mot de passe/i);
    const confirmation = screen.getByLabelText(/Confirmer le mot de passe/i);

    expect(password).toHaveAttribute('type', 'password');
    expect(confirmation).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(confirmation).toHaveAttribute('type', 'password');

    await user.click(
      screen.getByRole('button', { name: 'Afficher la confirmation du mot de passe' }),
    );
    expect(confirmation).toHaveAttribute('type', 'text');
  });

  it('renvoie vers la boite mail quand la confirmation est exigee', async () => {
    const user = userEvent.setup();
    // Reglage « Confirm email » actif cote Supabase : aucune session n'est
    // ouverte, il y a donc bien un message a aller chercher.
    mockSignUp.mockResolvedValueOnce({ sessionOuverte: false });

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

  it('n’annonce aucun e-mail quand la session s’ouvre immediatement', async () => {
    /*
      LE DEFAUT QUE CE TEST EXISTE POUR EMPECHER.

      Le mur de la boite mail etait le plus gros point de perte du tunnel
      publicitaire : le visiteur arrive du navigateur integre a Facebook, et le
      lien de confirmation s'ouvre dans un AUTRE navigateur — session perdue,
      attribution perdue.

      Quand le projet n'exige plus la confirmation, `signUp` ouvre une session
      sur-le-champ et `PublicOnlyRoute` conduit au tableau de bord. Afficher
      malgre tout « Verifiez votre boite mail » renverrait chercher un message
      inutile quelqu'un qui est deja entre — le mur qu'on vient de retirer,
      reconstruit par inadvertance.
    */
    const user = userEvent.setup();
    mockSignUp.mockResolvedValueOnce({ sessionOuverte: true });

    renderWithProviders(<RegisterPage />, { route: '/register' });

    await user.type(screen.getByLabelText(/Nom affiché/i), 'Alexandre Martin');
    await user.type(screen.getByLabelText(/Adresse e-mail/i), 'alex.martin@example.com');
    await user.type(screen.getByLabelText(/^Mot de passe/i), 'SuperMotDePasse123!');
    await user.type(screen.getByLabelText(/Confirmer le mot de passe/i), 'SuperMotDePasse123!');
    await user.click(screen.getByRole('button', { name: /Créer mon compte gratuit/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalled();
    });

    expect(screen.queryByText(/Vérifiez votre boîte mail/i)).not.toBeInTheDocument();
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

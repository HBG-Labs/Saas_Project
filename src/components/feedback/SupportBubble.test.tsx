import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportBubble } from './SupportBubble';

/**
 * Le centre d'assistance.
 *
 * Ce qui est éprouvé ici n'est pas la mise en page : c'est qu'un écran de
 * succès ne s'affiche QUE si quelque chose est réellement parti. La version
 * précédente attendait neuf cents millisecondes et affirmait « envoyé » sans
 * rien transmettre — le client attendait ensuite une réponse impossible.
 */

const envoi = vi.hoisted(() => ({ fn: vi.fn<(input: unknown) => Promise<unknown>>() }));

vi.mock('@/features/support', () => ({
  submitSupportRequest: (input: unknown) => envoi.fn(input),
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'patron@exemple.fr' } }),
}));

/**
 * Le nom, l'adresse et le message sont `required` : un champ vide fait refuser
 * la soumission par le navigateur avant que `onSubmit` ne s'exécute. L'adresse
 * est préremplie depuis le compte, les deux autres non.
 */
async function ouvrirEtRemplir(user: ReturnType<typeof userEvent.setup>, texte = 'Mon souci') {
  render(<SupportBubble />);
  await user.click(screen.getByRole('button', { name: /aide|assistance/i }));
  await user.type(screen.getByPlaceholderText('Votre nom'), 'Harry Bergoz');
  await user.type(screen.getByPlaceholderText(/Décrivez votre question/i), texte);
}

describe('SupportBubble', () => {
  beforeEach(() => {
    envoi.fn.mockReset();
  });

  it('transmet réellement la demande, et n’annonce le succès qu’ensuite', async () => {
    const user = userEvent.setup();
    envoi.fn.mockResolvedValue({ stored: true, notified: true });

    await ouvrirEtRemplir(user, 'La facturation affiche un mauvais montant');
    await user.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(envoi.fn).toHaveBeenCalledTimes(1);
    });
    expect(envoi.fn.mock.calls[0]?.[0]).toMatchObject({
      message: 'La facturation affiche un mauvais montant',
      userId: 'user-1',
    });
    expect(await screen.findByText(/Message envoyé avec succès/)).toBeInTheDocument();
  });

  it('distingue « enregistré » de « transmis » quand la notification échoue', async () => {
    const user = userEvent.setup();
    envoi.fn.mockResolvedValue({ stored: true, notified: false, reason: 'SMTP muet' });

    await ouvrirEtRemplir(user);
    await user.click(screen.getByRole('button', { name: /Envoyer/i }));

    // La demande n'est pas perdue, mais nous ne l'avons pas reçue : annoncer
    // « transmise » serait retomber dans le travers corrigé.
    expect(await screen.findByText(/Message enregistré/)).toBeInTheDocument();
    expect(screen.getByText(/contact@rezo360\.fr/)).toBeInTheDocument();
    expect(screen.queryByText(/envoyé avec succès/)).not.toBeInTheDocument();
  });

  it('n’annonce aucun succès si l’envoi échoue, et conserve la saisie', async () => {
    const user = userEvent.setup();
    envoi.fn.mockRejectedValue(new Error('Trop de demandes envoyées depuis cette adresse.'));

    await ouvrirEtRemplir(user, 'Un message que je ne veux pas retaper');
    await user.click(screen.getByRole('button', { name: /Envoyer/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de demandes');
    expect(screen.queryByText(/succès|enregistré/i)).not.toBeInTheDocument();
    // Faire retaper son message à quelqu'un qui écrivait pour se plaindre
    // achèverait de l'exaspérer.
    expect(screen.getByDisplayValue('Un message que je ne veux pas retaper')).toBeInTheDocument();
  });

  it('n’envoie rien quand le message est vide', async () => {
    const user = userEvent.setup();
    render(<SupportBubble />);
    await user.click(screen.getByRole('button', { name: /aide|assistance/i }));
    await user.type(screen.getByPlaceholderText('Votre nom'), 'Harry Bergoz');

    // Tout est rempli SAUF le message : le garde est bien celui-là, et non le
    // refus du navigateur sur un autre champ obligatoire.
    await user.click(screen.getByRole('button', { name: /Envoyer/i }));

    expect(envoi.fn).not.toHaveBeenCalled();
  });
});

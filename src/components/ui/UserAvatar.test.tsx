import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UserAvatar } from './UserAvatar';

/**
 * Deux états possibles, et rien d'autre.
 *
 * Radix `Avatar.Fallback` ne s'affiche qu'après un délai — même à `delayMs={0}`,
 * le rendu passe par un minuteur, jamais de façon synchrone. En jsdom, qui ne
 * charge jamais d'image réseau, ces tests attendent donc l'état stabilisé
 * plutôt que le rendu immédiat — c'est le comportement de Radix, pas une
 * garantie de ce composant, mais c'est ce que l'utilisateur voit à l'écran.
 */
describe('UserAvatar', () => {
  it('affiche les initiales, sans requête image, quand aucun avatar n’est choisi', async () => {
    render(<UserAvatar avatarId={null} name="Harry Bergoz" />);

    await waitFor(() => expect(screen.getByText('HB')).toBeInTheDocument());
    expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
  });

  it('retombe sur les initiales pour un identifiant inconnu — jamais une image cassée', async () => {
    // Le cas réel : un ancien `avatar_id` écrit par une bibliothèque
    // supprimée, ou une valeur corrompue. Charger quand même produirait un
    // cercle vide plutôt qu'un repli lisible.
    render(<UserAvatar avatarId="tech-male-1" name="Ancien Compte" />);

    expect(document.querySelector('img')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('AC')).toBeInTheDocument());
  });

  it('ne garde que deux initiales, au-delà elles deviennent illisibles', async () => {
    render(<UserAvatar avatarId={null} name="Jean Pierre Dupont Martin" />);

    await waitFor(() => expect(screen.getByText('JP')).toBeInTheDocument());
  });
});

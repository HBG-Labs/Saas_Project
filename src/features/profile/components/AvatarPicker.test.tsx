import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AvatarPicker } from './AvatarPicker';

/**
 * Sélectionner n'enregistre pas : c'est la distinction centrale de ce
 * composant, et celle que ces tests protègent. Un clic sur une vignette ne
 * doit JAMAIS appeler la mutation seul — seul « Enregistrer » le fait.
 */
const profil = vi.hoisted(() => ({ avatarId: null as string | null }));
const mutate = vi.hoisted(() => vi.fn());

vi.mock('../hooks', () => ({
  useMyProfile: () => ({
    data: { identity: { avatar_id: profil.avatarId }, details: null },
  }),
  useUpdateMyProfile: () => ({ mutate, isPending: false }),
}));

beforeEach(() => {
  profil.avatarId = null;
  mutate.mockReset();
});

describe('AvatarPicker', () => {
  it('affiche les 50 avatars de la collection', () => {
    render(<AvatarPicker open onOpenChange={() => {}} />);

    // Chaque vignette porte `aria-pressed` (true ou false) ; les boutons du
    // pied de page (Annuler, Enregistrer, Utiliser mes initiales) n'en ont
    // pas et sont donc naturellement exclus par ce filtre.
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(50);
  });

  it('sélectionner une vignette ne sauvegarde pas seul', async () => {
    const user = userEvent.setup();
    render(<AvatarPicker open onOpenChange={() => {}} />);

    await user.click(screen.getAllByRole('button', { pressed: false })[4]!);

    expect(mutate).not.toHaveBeenCalled();
  });

  it('« Enregistrer » persiste le choix, avec l’identifiant sélectionné', async () => {
    const user = userEvent.setup();
    render(<AvatarPicker open onOpenChange={() => {}} />);

    await user.click(screen.getAllByRole('button', { pressed: false })[4]!);
    await user.click(screen.getByRole('button', { name: /^Enregistrer$/ }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      { identity: { avatar_id: expect.stringMatching(/^avatar-[0-9]{2}$/) } },
      expect.anything(),
    );
  });

  it('désactive « Enregistrer » tant que la sélection n’a pas changé', () => {
    profil.avatarId = 'avatar-05';
    render(<AvatarPicker open onOpenChange={() => {}} />);

    expect(screen.getByRole('button', { name: /^Enregistrer$/ })).toBeDisabled();
  });

  it('marque l’avatar déjà enregistré comme sélectionné à l’ouverture', () => {
    profil.avatarId = 'avatar-05';
    render(<AvatarPicker open onOpenChange={() => {}} />);

    const boutons = screen.getAllByRole('button', { pressed: true });
    expect(boutons).toHaveLength(1);
    expect(boutons[0]).toHaveAttribute('title', 'avatar-05');
  });

  it('« Utiliser mes initiales » vide la sélection sans écraser la base tant que non enregistré', async () => {
    profil.avatarId = 'avatar-05';
    const user = userEvent.setup();
    render(<AvatarPicker open onOpenChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: /initiales/i }));

    // Le retrait devient une sélection en attente, elle aussi soumise au bouton
    // « Enregistrer » — jamais appliquée toute seule.
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Enregistrer$/ })).toBeEnabled();
  });
});

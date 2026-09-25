import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import LandingPage from './LandingPage';

// Scroll synchronization is checked in the browser; these tests cover conversion contracts.
vi.mock('@/components/marketing/LandingNarratives', () => ({
  VoiceNarrative: () => <section id="voix" />,
}));

describe('Landing ALIVE', () => {
  it('explicite le compte gratuit et garde le produit accessible depuis le hero', () => {
    const { container } = renderWithProviders(<LandingPage />);
    const hero = within(
      screen.getByRole('region', { name: 'Votre activité en mieux. Tout simplement.' }),
    );
    expect(hero.getByRole('link', { name: 'Créer mon compte gratuit' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(hero.getByRole('link', { name: 'Explorer les écrans' })).toHaveAttribute(
      'href',
      '#produit',
    );
    expect(
      screen.getByRole('img', { name: 'Interface réelle REZO360 — Planning' }),
    ).toBeInTheDocument();
    expect(
      hero.getByText(/Compte Free sans carte, pour les outils techniques/),
    ).toBeInTheDocument();
    expect(container.querySelector('.lp-workflow')).toBeNull();
    expect(container.querySelector('.lp-mobile')).toBeNull();
    expect(container.querySelector('.ln-finance')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
    expect(
      screen.getByRole('img', { name: 'Une intervention REZO360 sur smartphone' }),
    ).toBeInTheDocument();
  });

  it('explore les écrans et leur agrandissement sans déplacer la page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LandingPage />);
    await user.click(screen.getByRole('button', { name: '04 Facture' }));
    expect(screen.getByRole('img', { name: 'Interface réelle REZO360 — Facture' })).toHaveAttribute(
      'src',
      '/images/product/premium/invoice.webp',
    );
    expect(screen.getByRole('button', { name: '04 Facture' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Agrandir l’écran' }));
    expect(screen.getByRole('dialog', { name: 'Facture · REZO360' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('présente un seul espace à la fois et conserve la FAQ commerciale', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LandingPage />);
    await user.click(screen.getByRole('button', { name: '02 Workspace' }));
    expect(
      screen.getByRole('img', { name: 'Véritable espace Workspace de REZO360' }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Quand commence l’essai et faut-il une carte ?' }),
    );
    expect(screen.getByText(/L’essai ne commence pas à la création du compte/)).toBeVisible();
  });
});

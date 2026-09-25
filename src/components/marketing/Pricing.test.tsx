import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PRICING_PLANS, formatPrice } from '@/config/pricing';
import { renderWithProviders } from '@/test/utils';

import { Pricing } from './Pricing';

describe('Tarifs de la landing', () => {
  it('reprend les montants et les liens de la configuration commerciale', () => {
    renderWithProviders(<Pricing />);
    expect(screen.getAllByRole('article')).toHaveLength(4);

    for (const plan of PRICING_PLANS.filter((tier) => tier.priceMonthly > 0)) {
      const card = within(screen.getByRole('article', { name: plan.name }));
      expect(card.getByText(formatPrice(plan.priceMonthly))).toBeInTheDocument();
      expect(card.getByText(`${plan.includedUsers} utilisateurs inclus`)).toBeInTheDocument();
      expect(card.getByRole('link')).toHaveAttribute('href', plan.ctaLink);
    }

    expect(screen.getByRole('link', { name: 'Créer mon compte gratuit' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.queryByText('Le plus choisi')).not.toBeInTheDocument();
    expect(screen.getByText(/Une carte est demandée pour les offres payantes/)).toBeInTheDocument();
    expect(screen.getByText('Tout Starter inclus')).toBeInTheDocument();
    expect(screen.getByText('Tout Pro inclus')).toBeInTheDocument();
    expect(screen.getByText('Tout Business inclus')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Une formule adaptée à votre équipe.' }),
    ).toBeInTheDocument();
  });
});

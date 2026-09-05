import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TrialBanner } from './TrialBanner';

const abonnement = vi.hoisted(() => ({
  current: {
    status: 'trialing',
    trial_ends_at: '2026-09-13T12:00:00Z',
    current_period_end: null,
    provider_subscription_id: null,
  },
}));

vi.mock('../hooks/useEntitlements', () => ({
  useOrganizationSubscription: () => ({ data: abonnement.current }),
}));

function afficher(urgentOnly = false) {
  return render(
    <MemoryRouter>
      <TrialBanner organizationId="org-1" urgentOnly={urgentOnly} />
    </MemoryRouter>,
  );
}

describe('TrialBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-05T12:00:00Z'));
    abonnement.current = {
      status: 'trialing',
      trial_ends_at: '2026-09-13T12:00:00Z',
      current_period_end: null,
      provider_subscription_id: null,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reste visible sur le tableau de bord pendant un essai normal', () => {
    afficher();

    expect(screen.getByRole('status')).toHaveTextContent('Essai : 8 jours restants');
  });

  it('reste absent des autres pages tant qu’il reste plus de trois jours', () => {
    const { container } = afficher(true);

    expect(container).toBeEmptyDOMElement();
  });

  it('réapparaît partout dans les trois derniers jours', () => {
    abonnement.current = { ...abonnement.current, trial_ends_at: '2026-09-08T12:00:00Z' };
    afficher(true);

    expect(screen.getByRole('status')).toHaveTextContent('Essai : 3 jours restants');
  });

  it('reste global une fois l’essai expiré', () => {
    abonnement.current = { ...abonnement.current, trial_ends_at: '2026-09-04T12:00:00Z' };
    afficher(true);

    expect(screen.getByRole('alert')).toHaveTextContent('Votre période d’essai a pris fin');
  });
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FEATURES, PLAN_FEATURES } from '../entitlements';
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

  /*
    Ces deux cas protègent d'une phrase fausse, pas d'une phrase absente.

    La version précédente annonçait « Missions, Clients, Équipes et Interventions
    suspendus » alors que la formule Gratuite gardait ces modules avec un
    plafond. Le texte était en dur : la grille a changé, lui non, et rien ne
    l'a signalé. Les chiffres attendus sont donc LUS dans le miroir — le même
    que celui d'où le composant les tire, et qu'un autre test compare à la
    migration. Écrire « 5 missions » ici recréerait exactement la dérive.
  */
  it('annonce les plafonds de la formule Gratuite, lus dans le miroir', () => {
    abonnement.current = { ...abonnement.current, trial_ends_at: '2026-09-04T12:00:00Z' };
    afficher();

    const texte = screen.getByRole('alert').textContent ?? '';
    const gratuit = PLAN_FEATURES.free;
    for (const [cle, mot] of [
      [FEATURES.customers, 'client'],
      [FEATURES.missions, 'mission'],
      [FEATURES.interventions, 'intervention'],
    ] as const) {
      const plafond = gratuit[cle];
      expect(typeof plafond).toBe('number');
      expect(texte).toContain(`${String(plafond)} ${mot}`);
    }
  });

  it('ne prétend plus que les missions ou les clients sont suspendus', () => {
    abonnement.current = { ...abonnement.current, trial_ends_at: '2026-09-04T12:00:00Z' };
    afficher();

    const texte = screen.getByRole('alert').textContent ?? '';
    expect(texte).not.toMatch(/Missions, Clients, Équipes et Interventions sont suspendus/);
    expect(texte).toContain('Vous êtes en formule Gratuite');
  });

  it('prévient, avant l’échéance, du retour en Gratuit plutôt que d’une coupure totale', () => {
    afficher();

    const texte = screen.getByRole('status').textContent ?? '';
    expect(texte).toContain('vous repasserez en formule Gratuite');
    expect(texte).not.toContain('les modules professionnels sont suspendus');
  });
});

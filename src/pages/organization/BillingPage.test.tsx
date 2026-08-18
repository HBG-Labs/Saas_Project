import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BillingPage from './BillingPage';

/**
 * L'écran qui manipule l'argent.
 *
 * Ce qu'on éprouve ici n'est pas la mise en page mais les CHIFFRES : ce que
 * chaque formule inclut, et ce que l'entreprise paierait réellement. Une
 * première version affichait l'effectif courant sur les quatre formules —
 * « 19 € pour 2 utilisateurs », « 99 € pour 2 utilisateurs » — ce qui n'apprend
 * rien et laisse croire que Starter et Enterprise logent autant de monde.
 */

const resume = vi.hoisted(() => ({
  current: null as null | { activeSeats: number; totalCents: number; extraSeats: number },
}));
const abonnement = vi.hoisted(() => ({ current: { status: 'active', provider: 'stripe' } }));
const droit = vi.hoisted(() => ({ current: true }));

vi.mock('@/features/billing', () => ({
  useBillingSummary: () => ({ data: resume.current, isPending: false, error: null }),
  useOrganizationSubscription: () => ({
    data: abonnement.current,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useOrganizationEntitlements: () => ({ planCode: 'business' }),
  useCheckout: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useBillingPortal: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

vi.mock('@/features/organizations', () => ({
  useCurrentOrganization: () => ({ organization: { id: 'org-1' } }),
  useMembers: () => ({ data: [], isPending: false }),
  usePermission: () => ({ can: () => droit.current }),
  PERMISSIONS: { billingManage: 'billing.manage' },
  MemberQuotaBar: () => null,
}));

function afficher() {
  return render(
    <MemoryRouter>
      <BillingPage />
    </MemoryRouter>,
  );
}

describe('BillingPage — le choix de formule', () => {
  beforeEach(() => {
    resume.current = { activeSeats: 2, totalCents: 6900, extraSeats: 0 };
    abonnement.current = { status: 'active', provider: 'stripe' };
    droit.current = true;
  });

  it('annonce ce que chaque formule inclut, et non l’effectif courant', () => {
    afficher();

    // La grille officielle : 2 / 5 / 10 / 20. Quatre chiffres DIFFÉRENTS —
    // c'est tout l'intérêt du choix qu'on propose.
    expect(screen.getByText(/19 € \/ mois/)).toHaveTextContent('2 utilisateurs inclus');
    expect(screen.getByText(/39 € \/ mois/)).toHaveTextContent('5 utilisateurs inclus');
    expect(screen.getByText(/69 € \/ mois/)).toHaveTextContent('10 utilisateurs inclus');
    expect(screen.getByText(/99 € \/ mois/)).toHaveTextContent('20 utilisateurs inclus');
  });

  it('ne parle pas de dépassement quand l’effectif tient dans le forfait', () => {
    // Deux comptes : aucune formule payante n'est dépassée. Répéter le total à
    // l'identique sur les quatre lignes ferait du bruit.
    afficher();

    expect(screen.queryByText(/au-delà à/)).not.toBeInTheDocument();
  });

  it('chiffre le dépassement, formule par formule, quand l’effectif le dépasse', () => {
    resume.current = { activeSeats: 7, totalCents: 4900, extraSeats: 2 };
    afficher();

    // Starter inclut 2 : cinq comptes en supplément → 19 + 25 = 44 €.
    expect(screen.getByText(/44 € pour vos 7/)).toHaveTextContent('5 au-delà à 5 €');
    // Pro inclut 5 : deux en supplément → 39 + 10 = 49 €.
    expect(screen.getByText(/49 € pour vos 7/)).toHaveTextContent('2 au-delà à 5 €');
    // Business (10) et Enterprise (20) absorbent sept comptes sans supplément.
    expect(screen.queryByText(/pour vos 7 — 0/)).not.toBeInTheDocument();
  });

  it('ne propose pas de souscrire à qui n’en a pas le droit', () => {
    droit.current = false;
    afficher();

    // Le serveur refuserait de toute façon ; l'interface ne doit pas pour autant
    // proposer un geste qui sera rejeté.
    for (const nom of ['Starter', 'Pro', 'Enterprise']) {
      expect(screen.getByRole('button', { name: new RegExp(nom) })).toBeDisabled();
    }
  });
});

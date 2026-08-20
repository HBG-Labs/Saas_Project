import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
interface Abo {
  status: string;
  provider: string | null;
  provider_subscription_id: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
}
const abonnement = vi.hoisted(() => ({
  current: {} as Abo,
}));
const resilier = vi.hoisted(() => ({ mutate: vi.fn() }));
const reprendre = vi.hoisted(() => ({ mutate: vi.fn() }));
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
  useCancelSubscription: () => ({ ...resilier, isPending: false, error: null }),
  useResumeSubscription: () => ({ ...reprendre, isPending: false, error: null }),
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
    abonnement.current = {
      status: 'trialing',
      provider: null,
      provider_subscription_id: null,
      cancel_at_period_end: false,
      // Midi UTC, et non minuit : à minuit la date bascule d'un jour selon le
      // fuseau de la machine, et le test passerait ici pour échouer ailleurs.
      current_period_end: '2026-09-01T12:00:00Z',
    };
    resilier.mutate.mockClear();
    reprendre.mutate.mockClear();
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

  it('annonce le coût des utilisateurs supplémentaires (+5 € / mois) sur toutes les formules', () => {
    afficher();

    const supplements = screen.getAllByText(/\+5 € \/ mois par utilisateur supplémentaire/);
    expect(supplements).toHaveLength(4);
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

describe('BillingPage — l’essai et son issue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T12:00:00Z'));
    resume.current = { activeSeats: 2, totalCents: 6900, extraSeats: 0 };
    abonnement.current = {
      status: 'trialing',
      provider: null,
      provider_subscription_id: null,
      cancel_at_period_end: false,
      current_period_end: '2026-09-01T12:00:00Z',
    };
    droit.current = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('promet de garder les jours d’essai à qui souscrit maintenant', () => {
    // Le frein levé : jusqu'ici, souscrire au jour 3 fermait l'essai et
    // débitait aussitôt — quatorze jours perdus, mesurés. Le dire AVANT le clic
    // est tout l'intérêt du changement.
    afficher();

    const promesse = screen.getByText(/rien n’est prélevé avant/);
    expect(promesse).toHaveTextContent('14 jours');
    expect(promesse).toHaveTextContent('1 septembre 2026');
  });

  it('sans carte, annonce le retour en Gratuit et non un prélèvement', () => {
    afficher();

    const phrase = screen.getByText(/Gratuit jusqu’au/);
    expect(phrase).toHaveTextContent('repasse en formule Gratuite');
    // Le travers déjà corrigé ailleurs : annoncer un prix qui ne sera pas réclamé.
    expect(phrase).not.toHaveTextContent('prélevés automatiquement');
  });

  it('avec carte, annonce le prélèvement automatique et la sortie possible', () => {
    abonnement.current.provider = 'stripe';
    abonnement.current.provider_subscription_id = 'sub_essai';
    afficher();

    const phrase = screen.getByText(/Gratuit jusqu’au/);
    expect(phrase).toHaveTextContent('prélevés automatiquement');
    expect(phrase).toHaveTextContent('Résiliable jusque-là');
    // L'incitation n'a plus lieu d'être : la carte est déjà posée.
    expect(screen.queryByText(/rien n’est prélevé avant/)).not.toBeInTheDocument();
  });

  it('se tait quand l’essai est trop court pour que Stripe le reprenne', () => {
    // Moins de 48 h : le serveur ne transmet aucun report, le prélèvement est
    // immédiat. Promettre l'inverse serait pire que se taire.
    abonnement.current.current_period_end = new Date(Date.now() + 3_600_000).toISOString();
    afficher();

    expect(screen.queryByText(/rien n’est prélevé avant/)).not.toBeInTheDocument();
  });
});

describe('BillingPage — la sortie', () => {
  beforeEach(() => {
    resume.current = { activeSeats: 2, totalCents: 6900, extraSeats: 0 };
    abonnement.current = {
      status: 'trialing',
      provider: null,
      provider_subscription_id: null,
      cancel_at_period_end: false,
      // Midi UTC, et non minuit : à minuit la date bascule d'un jour selon le
      // fuseau de la machine, et le test passerait ici pour échouer ailleurs.
      current_period_end: '2026-09-01T12:00:00Z',
    };
    droit.current = true;
    resilier.mutate.mockClear();
    reprendre.mutate.mockClear();
  });

  it('offre de résilier pendant l’essai, quand aucun portail Stripe n’existe', async () => {
    // Le défaut d'origine : « Gérer mon abonnement » grisé, et aucune autre
    // sortie. Une entreprise en essai n'avait AUCUN moyen de dire non.
    const user = userEvent.setup();
    afficher();

    expect(screen.queryByRole('button', { name: /Gérer mon abonnement/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Résilier' }));

    // Rien n'est engagé avant confirmation, et la fenêtre annonce la date
    // jusqu'à laquelle l'accès est garanti — c'est tout l'objet du choix.
    expect(resilier.mutate).not.toHaveBeenCalled();
    const fenetre = within(screen.getByRole('dialog'));
    expect(fenetre.getByText(/jusqu’au/)).toHaveTextContent('1 septembre 2026');

    await user.click(screen.getByRole('button', { name: /Confirmer la résiliation/ }));
    expect(resilier.mutate).toHaveBeenCalledTimes(1);
  });

  it('annonce la date de fin d’accès et permet de se raviser', () => {
    abonnement.current.cancel_at_period_end = true;
    afficher();

    expect(screen.getByText(/Résiliation programmée/)).toHaveTextContent('1 septembre 2026');
    expect(screen.getByRole('button', { name: /Reprendre l’abonnement/ })).toBeEnabled();
    // On ne propose pas de résilier deux fois.
    expect(screen.queryByRole('button', { name: 'Résilier' })).not.toBeInTheDocument();
  });

  it('renvoie au portail Stripe, et pas à la résiliation locale, quand Stripe encaisse', () => {
    abonnement.current.provider = 'stripe';
    abonnement.current.provider_subscription_id = 'sub_123';
    afficher();

    // Stripe fait autorité sur ce qu'il encaisse : le serveur refuserait de
    // toute façon une résiliation locale.
    expect(screen.getByRole('button', { name: /Gérer mon abonnement/ })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Résilier' })).not.toBeInTheDocument();
  });

  it('ne propose aucune sortie à qui n’a pas le droit de facturer', () => {
    droit.current = false;
    afficher();

    expect(screen.queryByRole('button', { name: 'Résilier' })).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FirstStepsCard } from './FirstStepsCard';

/**
 * Ce guide se déduit des données ; il n'a pas d'état à lui.
 * Le tester revient donc à décrire des organisations et à vérifier ce qu'on leur
 * montre — y compris le cas d'une entreprise aguerrie, à qui on ne doit RIEN
 * montrer du tout.
 */

const membres = vi.hoisted(() => ({ current: [] as { status: string }[] }));
const clients = vi.hoisted(() => ({ current: [] as { id: string }[] }));
const statuts = vi.hoisted<{ current: Record<string, number> }>(() => ({ current: {} }));
const chargement = vi.hoisted(() => ({ current: false }));
const moduleOuvert = vi.hoisted(() => ({ current: true }));

vi.mock('@/features/billing', () => ({
  FEATURES: { missions: 'missions' },
  useOrganizationEntitlements: () => ({
    has: () => moduleOuvert.current,
    isLoading: chargement.current,
  }),
}));

vi.mock('@/features/organizations', () => ({
  useCurrentOrganization: () => ({ organization: { id: 'org-1' } }),
  useMembers: () => ({ data: membres.current, isPending: chargement.current }),
}));
vi.mock('@/features/customers', () => ({
  useCustomers: () => ({ data: clients.current, isPending: chargement.current }),
}));
vi.mock('@/features/missions', () => ({
  useMissionStatusCounts: () => ({ data: statuts.current, isPending: chargement.current }),
}));
vi.mock('@/features/industries', () => ({
  useLabel: (terme: string, pluriel?: boolean) =>
    terme === 'worker' ? (pluriel === true ? 'Techniciens' : 'Technicien') : 'Mission',
}));

function afficher() {
  return render(
    <MemoryRouter>
      <FirstStepsCard />
    </MemoryRouter>,
  );
}

describe('FirstStepsCard', () => {
  beforeEach(() => {
    membres.current = [{ status: 'active' }];
    clients.current = [];
    statuts.current = {};
    chargement.current = false;
    moduleOuvert.current = true;
  });

  it('guide une entreprise qui vient de s’inscrire, en commençant par l’équipe', () => {
    afficher();

    expect(screen.getByText('Vos premiers pas')).toBeInTheDocument();
    expect(screen.getByText('0 / 5')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ajouter/ })).toBeInTheDocument();
  });

  it('n’affiche rien tant que les données ne sont pas arrivées', () => {
    chargement.current = true;
    const { container } = afficher();

    // Une carte qui clignote au chargement est pire qu'une absence.
    expect(container).toBeEmptyDOMElement();
  });

  it('avance d’une étape dès qu’un collaborateur existe', () => {
    membres.current = [{ status: 'active' }, { status: 'active' }];
    afficher();

    expect(screen.getByText('1 / 5')).toBeInTheDocument();
    // Une seule étape est développée à la fois : celle qui reste à faire.
    expect(screen.getByText(/rattache un chantier à une adresse/)).toBeInTheDocument();
  });

  it('ne compte pas l’invité tant qu’il n’a pas accepté', () => {
    membres.current = [{ status: 'active' }, { status: 'invited' }];
    afficher();

    // Même règle que la facturation : un siège se compte à l'acceptation.
    expect(screen.getByText('0 / 5')).toBeInTheDocument();
  });

  it('disparaît quand le cycle complet a été bouclé', () => {
    membres.current = [{ status: 'active' }, { status: 'active' }];
    clients.current = [{ id: 'c-1' }];
    statuts.current = { approved: 1 };
    const { container } = afficher();

    expect(container).toBeEmptyDOMElement();
  });

  it('disparaît quand l’organisation retombe sur Gratuit', () => {
    // Une entreprise dont l'essai s'achève garde ses données, mais ne les voit
    // plus : missions et clients renvoient du vide. Sans ce garde, elle verrait
    // « 0 / 5 » l'inviter à recréer ce qu'elle possède déjà — chaque étape
    // butant sur le mur de RequirePlan.
    moduleOuvert.current = false;
    const { container } = afficher();

    expect(container).toBeEmptyDOMElement();
  });

  it('reste absent chez une entreprise dont les missions récentes sont toutes en cours', () => {
    // LE DÉFAUT CORRIGÉ : une première version lisait une page de 50 missions.
    // Ici, mille missions validées et deux cents en attente — si l'on ne lisait
    // qu'une tranche, on pourrait n'y voir aucune validation et resservir le
    // guide des premiers pas à un client installé depuis un an.
    membres.current = [{ status: 'active' }, { status: 'active' }];
    clients.current = [{ id: 'c-1' }];
    statuts.current = { pending: 200, approved: 1000 };
    const { container } = afficher();

    expect(container).toBeEmptyDOMElement();
  });

  it('renvoie vers le contrôle quand seule la validation manque', () => {
    membres.current = [{ status: 'active' }, { status: 'active' }];
    clients.current = [{ id: 'c-1' }];
    statuts.current = { submitted: 3 };
    afficher();

    expect(screen.getByText('4 / 5')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ouvrir le contrôle/ })).toHaveAttribute(
      'href',
      '/controle',
    );
  });
});

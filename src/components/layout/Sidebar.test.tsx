import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';

const { useCurrentOrganization, useVisibleNavGroups, useCurrentIndustry, usePlatformAdmin } =
  vi.hoisted(() => ({
    useCurrentOrganization: vi.fn(),
    useVisibleNavGroups: vi.fn(),
    useCurrentIndustry: vi.fn(),
    usePlatformAdmin: vi.fn(),
  }));

vi.mock('@/features/organizations', () => ({ useCurrentOrganization, useVisibleNavGroups }));
vi.mock('@/features/industries', () => ({ useCurrentIndustry }));
vi.mock('@/features/prospecting', () => ({ usePlatformAdmin }));

import { Sidebar } from './Sidebar';

const TENANT_GROUPS = [
  {
    id: 'interventions',
    label: 'Interventions',
    icon: 'clipboard',
    items: [{ label: 'Tableau de bord', to: '/dashboard', icon: 'dashboard', locked: false }],
  },
  {
    id: 'stock',
    label: 'Stock',
    icon: 'package',
    items: [{ label: 'Consommables', to: '/stock', icon: 'package', locked: false }],
  },
];

describe('Sidebar — volet métier vs administration plateforme', () => {
  it('masque les volets métier (Interventions, Stock…) pour un administrateur plateforme sans organisation', () => {
    useCurrentOrganization.mockReturnValue({ organization: null, role: null, status: 'none' });
    useVisibleNavGroups.mockReturnValue(TENANT_GROUPS);
    useCurrentIndustry.mockReturnValue({
      label: 'Autre métier de terrain',
      isResolved: true,
      code: 'general',
    });
    usePlatformAdmin.mockReturnValue({ isAdmin: true, isLoading: false, can: () => true });

    renderWithProviders(<Sidebar />, { route: '/admin/prospection/liste' });

    expect(screen.queryByText('Interventions')).not.toBeInTheDocument();
    expect(screen.queryByText('Stock')).not.toBeInTheDocument();
    expect(screen.getByText('Administration REZO360')).toBeInTheDocument();
    // Sans organisation, le libellé de métier générique ne doit jamais laisser
    // croire à une appartenance qui n'existe pas.
    expect(screen.queryByText('Autre métier de terrain')).not.toBeInTheDocument();
  });

  it('affiche normalement les volets métier pour un membre d’une organisation', () => {
    useCurrentOrganization.mockReturnValue({
      organization: { id: 'org-1', name: 'HBG Labs', industry: 'general' },
      role: 'owner',
      status: 'active',
    });
    useVisibleNavGroups.mockReturnValue(TENANT_GROUPS);
    useCurrentIndustry.mockReturnValue({
      label: 'Autre métier de terrain',
      isResolved: true,
      code: 'general',
    });
    usePlatformAdmin.mockReturnValue({ isAdmin: false, isLoading: false, can: () => false });

    renderWithProviders(<Sidebar />, { route: '/dashboard' });

    expect(screen.getByText('Interventions')).toBeInTheDocument();
    expect(screen.getByText('Stock')).toBeInTheDocument();
    expect(screen.getByText('Autre métier de terrain')).toBeInTheDocument();
    expect(screen.queryByText('Administration REZO360')).not.toBeInTheDocument();
  });
});

/** Sections rangées comme dans `SIDEBAR_GROUPS`, réduites à une entrée chacune. */
const GROUPES_PAR_UNIVERS = [
  {
    id: 'interventions',
    label: 'Interventions',
    icon: 'clipboard',
    universe: 'gestion',
    items: [{ label: 'Missions', to: '/missions', icon: 'clipboard', locked: false }],
  },
  {
    id: 'ventes',
    label: 'Ventes & facturation',
    icon: 'file-text',
    universe: 'finance',
    items: [{ label: 'Devis & Chiffrage', to: '/devis', icon: 'calculator', locked: false }],
  },
  {
    id: 'resources',
    label: 'Documents & formation',
    icon: 'book',
    universe: 'workspace',
    items: [{ label: 'Bloc-notes', to: '/bloc-notes', icon: 'file-text', locked: false }],
  },
  {
    id: 'outils',
    label: 'Boîte à outils',
    icon: 'wrench',
    items: [{ label: 'Catalogue Universel', to: '/tools', icon: 'wrench', locked: false }],
  },
];

function membreDeHbg() {
  useCurrentOrganization.mockReturnValue({
    organization: { id: 'org-1', name: 'HBG Labs', industry: 'general' },
    role: 'owner',
    status: 'active',
  });
  useCurrentIndustry.mockReturnValue({
    label: 'Autre métier de terrain',
    isResolved: true,
    code: 'general',
  });
  usePlatformAdmin.mockReturnValue({ isAdmin: false, isLoading: false, can: () => false });
}

describe('Sidebar — univers', () => {
  beforeEach(() => {
    localStorage.clear();
    membreDeHbg();
    useVisibleNavGroups.mockReturnValue(GROUPES_PAR_UNIVERS);
  });

  it('atterrit dans l’univers de la page courante, sans rien demander', () => {
    // Un lien profond, un favori, un retour arrière : /devis appartient à
    // Finance, la barre doit s'y ouvrir directement.
    renderWithProviders(<Sidebar />, { route: '/devis' });

    expect(screen.getByRole('radio', { name: /Finance/ })).toBeChecked();
    expect(screen.getByText('Ventes & facturation')).toBeInTheDocument();
    expect(screen.queryByText('Interventions')).not.toBeInTheDocument();
    expect(screen.queryByText('Documents & formation')).not.toBeInTheDocument();
  });

  it('garde les sections transversales visibles dans chaque univers', () => {
    // C'est la seule façon dont un univers pourrait retirer un accès : en
    // cachant ce dont on a besoin partout. La boîte à outils reste.
    renderWithProviders(<Sidebar />, { route: '/devis' });

    expect(screen.getByText('Boîte à outils')).toBeInTheDocument();
  });

  it('change de volet quand on choisit un autre univers', async () => {
    /*
      Le choix à la main doit l'emporter sur la page courante, sinon cliquer
      « Finance » depuis /missions ne servirait à rien : la page, qui
      appartient à Gestion, ramènerait aussitôt le volet en arrière.
    */
    const user = userEvent.setup();
    renderWithProviders(<Sidebar />, { route: '/missions' });

    expect(screen.getByRole('radio', { name: /Gestion/ })).toBeChecked();
    expect(screen.getByText('Interventions')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Workspace/ }));

    expect(screen.getByRole('radio', { name: /Workspace/ })).toBeChecked();
    expect(screen.getByText('Documents & formation')).toBeInTheDocument();
    expect(screen.queryByText('Interventions')).not.toBeInTheDocument();
    expect(localStorage.getItem('rezo360-universe')).toBe('workspace');
  });

  it('retrouve le dernier univers choisi sur une page transversale', () => {
    // /tools n'appartient à personne. Sans mémoire, ouvrir la boîte à outils
    // depuis Finance ramènerait la barre sur Gestion.
    localStorage.setItem('rezo360-universe', 'finance');

    renderWithProviders(<Sidebar />, { route: '/tools' });

    expect(screen.getByRole('radio', { name: /Finance/ })).toBeChecked();
    expect(screen.getByText('Ventes & facturation')).toBeInTheDocument();
  });

  it('ne montre aucun sélecteur quand les sections n’ont pas d’univers', () => {
    // La barre technicien ne déclare aucun univers : il n'y a rien à choisir,
    // et toutes ses sections restent affichées.
    useVisibleNavGroups.mockReturnValue(TENANT_GROUPS);

    renderWithProviders(<Sidebar />, { route: '/dashboard' });

    expect(screen.queryByRole('radiogroup', { name: 'Univers' })).not.toBeInTheDocument();
    expect(screen.getByText('Interventions')).toBeInTheDocument();
    expect(screen.getByText('Stock')).toBeInTheDocument();
  });
});

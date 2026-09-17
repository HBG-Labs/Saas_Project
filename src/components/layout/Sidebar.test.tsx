import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';

const { useCurrentOrganization, useVisibleNavGroups, useCurrentIndustry, usePlatformAdmin } = vi.hoisted(() => ({
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
  { id: 'interventions', label: 'Interventions', icon: 'clipboard', items: [{ label: 'Tableau de bord', to: '/dashboard', icon: 'dashboard', locked: false }] },
  { id: 'stock', label: 'Stock', icon: 'package', items: [{ label: 'Consommables', to: '/stock', icon: 'package', locked: false }] },
];

describe('Sidebar — volet métier vs administration plateforme', () => {
  it('masque les volets métier (Interventions, Stock…) pour un administrateur plateforme sans organisation', () => {
    useCurrentOrganization.mockReturnValue({ organization: null, role: null, status: 'none' });
    useVisibleNavGroups.mockReturnValue(TENANT_GROUPS);
    useCurrentIndustry.mockReturnValue({ label: 'Autre métier de terrain', isResolved: true, code: 'general' });
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
    useCurrentIndustry.mockReturnValue({ label: 'Autre métier de terrain', isResolved: true, code: 'general' });
    usePlatformAdmin.mockReturnValue({ isAdmin: false, isLoading: false, can: () => false });

    renderWithProviders(<Sidebar />, { route: '/dashboard' });

    expect(screen.getByText('Interventions')).toBeInTheDocument();
    expect(screen.getByText('Stock')).toBeInTheDocument();
    expect(screen.getByText('Autre métier de terrain')).toBeInTheDocument();
    expect(screen.queryByText('Administration REZO360')).not.toBeInTheDocument();
  });
});

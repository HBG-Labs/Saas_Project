import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MapPage from './MapPage';

vi.mock('@/features/organizations', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useCurrentOrganization: () => ({
      organization: { id: 'org-1', name: 'Tech Telecom SAS' },
    }),
    useMembers: () => ({
      data: [{ id: 'm-1', profile: { display_name: 'Jean Dupont' }, role: 'technician' }],
      isPending: false,
    }),
  };
});

vi.mock('@/features/industries', () => ({
  useCurrentIndustry: () => ({
    code: 'telecom_fiber',
    label: 'Fibre & Télécoms',
  }),
}));

vi.mock('@/features/missions', () => ({
  useMissions: () => ({
    data: [
      {
        id: 'mission-1',
        title: 'Raccordement D3',
        reference: 'MIS-001',
        status: 'assigned',
        priority: 'high',
        latitude: 48.8566,
        longitude: 2.3522,
        address_line1: '10 Rue de la Paix',
        postal_code: '75002',
        city: 'Paris',
        assigned_member: null,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/features/customers', () => ({
  useCustomers: () => ({
    data: [],
    isLoading: false,
  }),
  useOrganizationSites: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock('@/features/geo', () => ({
  useGeolocation: () => ({
    position: null,
    isLoading: false,
    error: null,
    requestPosition: vi.fn(),
  }),
  useGeocodedAddresses: () => ({
    coordinates: {},
    failedCount: 0,
  }),
  calculateDistanceKm: vi.fn(() => 5),
  formatDistance: vi.fn(() => '5 km'),
  openNavigationApp: vi.fn(),
}));

// Leaflet mock to prevent DOM canvas / map errors in jsdom
vi.mock('@/features/map', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/map');
  return {
    ...actual,
    GoogleMapView: () => <div data-testid="google-map-view">GoogleMapView</div>,
  };
});

describe('MapPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rend la page de cartographie avec le titre et les contrôles sans erreur', () => {
    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Cartographie & Chantiers')).toBeInTheDocument();
    expect(screen.getByText('Autour de moi')).toBeInTheDocument();
    expect(screen.getByTestId('google-map-view')).toBeInTheDocument();
  });
});

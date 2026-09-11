import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CreateOrganizationPage from './CreateOrganizationPage';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  searchFrenchCompanies: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/features/organizations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/organizations')>();
  return {
    ...actual,
    useCreateOrganization: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
  };
});

vi.mock('@/features/organizations/api/company-directory.api', () => ({
  searchFrenchCompanies: mocks.searchFrenchCompanies,
}));

vi.mock('@/features/industries', () => ({
  useIndustries: () => ({ data: [{ code: 'hvac', label: 'Génie climatique' }], isPending: false }),
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

const CARREFOUR = {
  id: 'etab-1',
  name: 'CARREFOUR',
  legalName: 'CARREFOUR SA',
  siret: '51076150500013',
  commercialName: 'CARREFOUR (CTIM)',
  city: 'LE CANNET',
  postalCode: '06110',
};

function afficher() {
  return render(
    <MemoryRouter>
      <CreateOrganizationPage />
    </MemoryRouter>,
  );
}

/** Ouvre la liste de l'annuaire et retient la première proposition. */
async function choisirDansAnnuaire(utilisateur: ReturnType<typeof userEvent.setup>) {
  await utilisateur.type(screen.getByLabelText(/Nom de l’entreprise/), 'carrefour');
  const proposition = await screen.findByRole('option', {}, { timeout: 5000 });
  await utilisateur.click(proposition);
}

describe('CreateOrganizationPage — reprise depuis l’annuaire officiel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchFrenchCompanies.mockResolvedValue([CARREFOUR]);
    mocks.mutateAsync.mockResolvedValue({ id: 'org-1' });
  });

  it('remplit le nom, le SIRET et la ville à partir de la fiche retenue', async () => {
    const utilisateur = userEvent.setup();
    afficher();

    await choisirDansAnnuaire(utilisateur);

    await waitFor(() => {
      expect(screen.getByLabelText(/Nom de l’entreprise/)).toHaveValue('CARREFOUR (CTIM)');
    });
    // Le nom COMMERCIAL prime : c'est sous celui-là que l'entreprise est connue.
    expect(screen.getByLabelText(/^SIRET/)).toHaveValue('51076150500013');
    expect(screen.getByLabelText(/^Ville/)).toHaveValue('LE CANNET');
    expect(screen.getByLabelText(/^Identifiant/)).toHaveValue('carrefour-ctim');
    expect(screen.getByRole('status')).toHaveTextContent('CARREFOUR (CTIM)');
  });

  it('transmet la raison sociale et le code postal, jamais montrés à l’écran', async () => {
    const utilisateur = userEvent.setup();
    afficher();

    await choisirDansAnnuaire(utilisateur);
    await waitFor(() => {
      expect(screen.getByLabelText(/^SIRET/)).toHaveValue('51076150500013');
    });
    await utilisateur.click(screen.getByRole('button', { name: /Créer l’entreprise/ }));

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'CARREFOUR (CTIM)',
          legalName: 'CARREFOUR SA',
          registrationNumber: '51076150500013',
          postalCode: '06110',
          city: 'LE CANNET',
        }),
      );
    });
  });

  it('n’écrase pas un identifiant saisi à la main', async () => {
    const utilisateur = userEvent.setup();
    afficher();

    // L'ordre compte : c'est la modification PRÉALABLE de l'identifiant qui doit
    // survivre à la reprise. Sans le repère `slugEdited`, la fiche de l'annuaire
    // effacerait ce choix sans prévenir.
    await utilisateur.type(screen.getByLabelText(/^Identifiant/), 'mon-identifiant');
    await choisirDansAnnuaire(utilisateur);

    await waitFor(() => {
      expect(screen.getByLabelText(/Nom de l’entreprise/)).toHaveValue('CARREFOUR (CTIM)');
    });
    expect(screen.getByLabelText(/^Identifiant/)).toHaveValue('mon-identifiant');
  });

  it('retire la confirmation dès que le nom est retouché', async () => {
    const utilisateur = userEvent.setup();
    afficher();

    await choisirDansAnnuaire(utilisateur);
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    await utilisateur.type(screen.getByLabelText(/Nom de l’entreprise/), ' Nord');

    // Une identité « vérifiée » qui survit à une saisie manuelle certifierait
    // quelque chose que l'annuaire n'a jamais dit.
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('laisse créer l’entreprise quand l’annuaire ne répond pas', async () => {
    mocks.searchFrenchCompanies.mockRejectedValue(new Error('annuaire indisponible'));
    const utilisateur = userEvent.setup();
    afficher();

    await utilisateur.type(screen.getByLabelText(/Nom de l’entreprise/), 'Plomberie Martin');
    await utilisateur.click(screen.getByRole('button', { name: /Créer l’entreprise/ }));

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Plomberie Martin', slug: 'plomberie-martin' }),
      );
    });
    // Rien de l'annuaire ne doit être inventé quand il est muet.
    expect(mocks.mutateAsync.mock.calls[0]?.[0]).not.toHaveProperty('registrationNumber');
  });
});

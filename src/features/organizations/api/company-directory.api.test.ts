import { afterEach, describe, expect, it, vi } from 'vitest';

import { searchFrenchCompanies } from './company-directory.api';

function directoryResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('searchFrenchCompanies', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retourne le nom officiel et le SIRET du siège pour une recherche par nom', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      directoryResponse({
        results: [
          {
            siren: '915303705',
            nom_complet: 'PRIAM',
            nom_raison_sociale: 'PRIAM',
            siege: {
              siret: '91530370500018',
              nom_commercial: 'PRIAM ATLANTIQUE',
              code_postal: '44100',
              libelle_commune: 'NANTES',
            },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(searchFrenchCompanies('Priam')).resolves.toEqual([
      {
        id: '91530370500018',
        name: 'PRIAM',
        legalName: 'PRIAM',
        commercialName: 'PRIAM ATLANTIQUE',
        siret: '91530370500018',
        postalCode: '44100',
        city: 'NANTES',
      },
    ]);

    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain('q=Priam');
    expect(calledUrl).toContain('minimal=true');
  });

  it('conserve l’établissement exact lors d’une recherche par SIRET', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        directoryResponse({
          results: [
            {
              siren: '915303705',
              nom_complet: 'PRIAM',
              nom_raison_sociale: 'PRIAM',
              siege: { siret: '91530370500018' },
              matching_etablissements: [
                {
                  siret: '91530370500026',
                  code_postal: '75001',
                  libelle_commune: 'PARIS',
                },
              ],
            },
          ],
        }),
      ),
    );

    const companies = await searchFrenchCompanies('915 303 705 00026');

    expect(companies[0]).toMatchObject({
      name: 'PRIAM',
      siret: '91530370500026',
      city: 'PARIS',
    });
  });

  it('signale une indisponibilité sans fabriquer de résultat', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(directoryResponse({}, 503)));

    await expect(searchFrenchCompanies('Priam')).rejects.toThrow(
      'Recherche d’entreprise indisponible (503)',
    );
  });
});

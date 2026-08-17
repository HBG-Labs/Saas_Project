import { describe, expect, it, vi, beforeEach } from 'vitest';
import { reverseGeocode, forwardGeocode } from './reverse-geocoding';

describe('reverseGeocode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('convertit les coordonnées en adresse via BAN', async () => {
    const mockBanResponse = {
      features: [
        {
          properties: {
            name: '12 Rue Victor Hugo',
            postcode: '97200',
            city: 'Fort-de-France',
            label: '12 Rue Victor Hugo 97200 Fort-de-France',
          },
        },
      ],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBanResponse),
      }),
    );

    const result = await reverseGeocode(14.6035, -61.0712);

    expect(result?.latitude).toBe(14.6035);
    expect(result?.longitude).toBe(-61.0712);
    expect(result?.addressLine1).toBe('12 Rue Victor Hugo');
    expect(result?.postalCode).toBe('97200');
    expect(result?.city).toBe('Fort-de-France');
  });

  it('LÈVE quand les deux services sont injoignables', async () => {
    // Ce test remplace un ancien, qui vérifiait que la fonction renvoyait alors
    // un objet dont le `label` valait « 14.603500, -61.071200 ». L'appelant
    // croyait tenir une adresse ; il tenait des coordonnées formatées, et les
    // enregistrait comme telles dans la fiche du client.
    //
    // Une panne réseau doit se voir. C'est le seul moyen pour l'utilisateur de
    // savoir qu'il doit ressaisir l'adresse à la main.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await expect(reverseGeocode(14.6035, -61.0712)).rejects.toThrow(/service d'adresses/i);
  });

  it('renvoie undefined quand les services répondent sans connaître le lieu', async () => {
    // Un point en pleine mer n'est pas une panne : la distinction compte, car
    // elle sépare « saisissez l'adresse » de « réessayez ».
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ features: [] }) }),
    );

    await expect(reverseGeocode(0, 0)).resolves.toBeUndefined();
  });

  it('ignore des coordonnées GeoJSON aberrantes', async () => {
    // L'ordre GeoJSON est [longitude, latitude]. Une inversion place un chantier
    // nantais au large de la Somalie ; une latitude hors bornes la trahit.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            features: [
              { geometry: { coordinates: [2.35, 148.86] }, properties: { city: 'Nulle' } },
            ],
          }),
      }),
    );

    await expect(forwardGeocode('adresse quelconque')).resolves.toEqual([]);
  });
});

describe('forwardGeocode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('recherche les suggestions d’adresses', async () => {
    const mockBanResponse = {
      features: [
        {
          geometry: {
            coordinates: [-61.0712, 14.6035],
          },
          properties: {
            name: 'Mairie de Fort-de-France',
            postcode: '97200',
            city: 'Fort-de-France',
            label: 'Mairie de Fort-de-France, Boulevard Général de Gaulle 97200 Fort-de-France',
          },
        },
      ],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBanResponse),
      }),
    );

    const results = await forwardGeocode('Mairie Fort-de-France');

    expect(results.length).toBe(1);
    expect(results[0]?.latitude).toBe(14.6035);
    expect(results[0]?.longitude).toBe(-61.0712);
    expect(results[0]?.city).toBe('Fort-de-France');
  });

  it('renvoie une liste vide pour une requête trop courte', async () => {
    const results = await forwardGeocode('a');
    expect(results).toEqual([]);
  });
});

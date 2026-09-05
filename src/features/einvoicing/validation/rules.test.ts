import { describe, expect, it } from 'vitest';

import {
  preparationEmetteur,
  validerDestinataire,
  validerEmetteur,
  validerEmission,
  validerFacture,
  type DestinataireAValider,
  type EmetteurAValider,
  type FactureAValider,
} from './rules';

/**
 * Ces règles décident de bloquer une émission — et une facture émise ne se
 * corrige plus qu'avec un avoir. Une règle trop lâche laisse partir un document
 * irrécupérable ; une règle trop stricte immobilise un artisan un vendredi
 * soir. Les deux erreurs se paient, d'où des tests qui vérifient AUSSI ce qui
 * ne doit PAS bloquer.
 */

const EMETTEUR_COMPLET: EmetteurAValider = {
  name: 'Élec Antilles',
  legal_name: 'Élec Antilles SARL',
  registration_number: '12345678900012',
  vat_number: 'FR12345678901',
  address_line1: '12 rue des Écoles',
  postal_code: '97212',
  city: 'Saint-Joseph',
  country: 'FR',
  legal_form: 'SARL',
  share_capital_cents: 100000,
  vat_regime: 'reel_normal',
  iban: 'FR7630001007941234567890185',
};

const CLIENT_COMPLET: DestinataireAValider = {
  name: 'Mairie du Marin',
  customer_type: 'public_body',
  registration_number: '21972012300015',
  vat_number: 'FR00219720123',
  address_line1: '1 place de la Mairie',
  postal_code: '97290',
  city: 'Le Marin',
  country: 'FR',
};

const FACTURE_COMPLETE: FactureAValider = {
  reference: 'FAC-2026-00001',
  issued_at: null,
  due_date: '2026-10-03',
  payment_terms: 'Paiement à 30 jours. Pénalités de retard : 3 fois le taux légal.',
  items: [
    { description: 'Pose de luminaires', quantity: 4, unit_price_cents: 12000, vat_rate: 20 },
  ],
};

const codes = (manques: { code: string }[]) => manques.map((m) => m.code);

describe('formats des identifiants avant émission', () => {
  it.each(['company', 'public_body'] as const)(
    'bloque les deux identifiants invalides d’un client %s français',
    (customer_type) => {
      const verdict = validerEmission(
        FACTURE_COMPLETE,
        {
          ...CLIENT_COMPLET,
          customer_type,
          registration_number: '109198440054594',
          vat_number: '0919191951',
        },
        EMETTEUR_COMPLET,
      );
      expect(verdict.emissionPossible).toBe(false);
      expect(codes(verdict.bloquants)).toEqual(['client.siret_format', 'client.tva_format']);
    },
  );
  it('accepte les espaces de présentation et les minuscules dans la TVA', () => {
    expect(
      validerDestinataire({
        ...CLIENT_COMPLET,
        registration_number: '219 720\u00a0123\u202f00015',
        vat_number: 'fr 00 219720123',
      }),
    ).toEqual([]);
  });
  it('garde la TVA client absente en avertissement', () => {
    const verdict = validerEmission(
      FACTURE_COMPLETE,
      { ...CLIENT_COMPLET, vat_number: null },
      EMETTEUR_COMPLET,
    );
    expect(verdict.emissionPossible).toBe(true);
    expect(codes(verdict.avertissements)).toContain('client.tva_intracom');
  });
  it('n’impose pas le format français aux entreprises étrangères', () => {
    expect(
      validerDestinataire({
        ...CLIENT_COMPLET,
        country: 'BE',
        registration_number: '0123.456.789',
        vat_number: 'BE0123456789',
      }),
    ).toEqual([]);
  });
  it('ne réclame pas d’identifiant professionnel à un particulier', () => {
    expect(
      validerDestinataire({
        ...CLIENT_COMPLET,
        customer_type: 'individual',
        registration_number: null,
        vat_number: null,
      }),
    ).toEqual([]);
  });
  it('signale une TVA émetteur mal formée, même sous franchise si renseignée', () => {
    for (const vat_regime of ['franchise', 'reel_normal'] as const) {
      const emetteur = { ...EMETTEUR_COMPLET, vat_regime, vat_number: '0919191951' };
      expect(codes(validerEmetteur(emetteur))).toContain('emetteur.tva_format');
      expect(preparationEmetteur(emetteur).find((step) => step.code === 'tva_intracom')?.fait).toBe(
        false,
      );
    }
  });
});

describe('validerEmetteur', () => {
  it('ne reproche rien à une entreprise complète', () => {
    expect(validerEmetteur(EMETTEUR_COMPLET)).toEqual([]);
  });

  it('réclame le SIRET et l’adresse, qui sont des mentions obligatoires', () => {
    const manques = validerEmetteur({ ...EMETTEUR_COMPLET, registration_number: '', city: null });

    expect(codes(manques)).toContain('emetteur.siret');
    expect(codes(manques)).toContain('emetteur.adresse');
    expect(manques.every((m) => m.gravite === 'bloquant')).toBe(true);
  });

  it('bloque tant que le régime de TVA est inconnu', () => {
    const manques = validerEmetteur({ ...EMETTEUR_COMPLET, vat_regime: null });

    expect(codes(manques)).toContain('emetteur.regime_tva');
  });

  it('n’exige PAS de numéro de TVA sous la franchise en base', () => {
    // Un micro-entrepreneur n'en a pas. Le réclamer bloquerait l'émission sur
    // une donnée qui n'existe pas.
    const manques = validerEmetteur({
      ...EMETTEUR_COMPLET,
      vat_regime: 'franchise',
      vat_number: null,
    });

    expect(codes(manques)).not.toContain('emetteur.tva_intracom');
  });

  it('exige le numéro de TVA hors franchise', () => {
    const manques = validerEmetteur({
      ...EMETTEUR_COMPLET,
      vat_regime: 'reel_simplifie',
      vat_number: '',
    });

    expect(codes(manques)).toContain('emetteur.tva_intracom');
  });

  it('exige la forme juridique et signale l’IBAN manquant', () => {
    const manques = validerEmetteur({ ...EMETTEUR_COMPLET, legal_form: null, iban: null });

    expect(codes(manques)).toEqual(['emetteur.forme_juridique', 'emetteur.iban']);
    expect(manques.find((m) => m.code === 'emetteur.forme_juridique')?.gravite).toBe('bloquant');
    expect(manques.find((m) => m.code === 'emetteur.iban')?.gravite).toBe('avertissement');
  });
});

describe('validerDestinataire', () => {
  it('ne reproche rien à un client professionnel complet', () => {
    expect(validerDestinataire(CLIENT_COMPLET)).toEqual([]);
  });

  it('bloque tant que le type de client est inconnu, et s’arrête là', () => {
    const manques = validerDestinataire({ ...CLIENT_COMPLET, customer_type: null });

    // Un seul manque : réclamer le SIRET d'un client dont on ignore s'il est
    // un particulier serait une question sans réponse possible.
    expect(codes(manques)).toEqual(['client.type']);
  });

  it('n’exige PAS de SIRET pour un particulier', () => {
    const manques = validerDestinataire({
      ...CLIENT_COMPLET,
      customer_type: 'individual',
      registration_number: null,
      vat_number: null,
    });

    expect(codes(manques)).not.toContain('client.siret');
    expect(codes(manques)).not.toContain('client.tva_intracom');
  });

  it('exige le SIRET d’une entreprise', () => {
    const manques = validerDestinataire({
      ...CLIENT_COMPLET,
      customer_type: 'company',
      registration_number: '   ',
    });

    expect(codes(manques)).toContain('client.siret');
  });

  it('exige l’adresse même d’un particulier', () => {
    const manques = validerDestinataire({
      ...CLIENT_COMPLET,
      customer_type: 'individual',
      postal_code: null,
    });

    expect(codes(manques)).toContain('client.adresse');
  });
});

describe('validerFacture', () => {
  it('ne reproche rien à une facture complète', () => {
    expect(validerFacture(FACTURE_COMPLETE, EMETTEUR_COMPLET)).toEqual([]);
  });

  it('réclame l’échéance et les conditions de règlement', () => {
    const manques = validerFacture(
      { ...FACTURE_COMPLETE, due_date: null, payment_terms: '' },
      EMETTEUR_COMPLET,
    );

    expect(codes(manques)).toContain('facture.echeance');
    expect(codes(manques)).toContain('facture.conditions_reglement');
  });

  it('refuse une facture sans ligne', () => {
    const manques = validerFacture({ ...FACTURE_COMPLETE, items: [] }, EMETTEUR_COMPLET);

    expect(codes(manques)).toContain('facture.lignes');
  });

  it('bloque la TVA facturée sous franchise en base', () => {
    // Le cas le plus coûteux pour un micro-entrepreneur : la TVA collectée par
    // erreur est due au Trésor, et la facture est à refaire. Le taux par défaut
    // de l'application étant 20 %, l'erreur est à un clic.
    const manques = validerFacture(FACTURE_COMPLETE, {
      ...EMETTEUR_COMPLET,
      vat_regime: 'franchise',
      vat_number: null,
    });

    const tva = manques.find((m) => m.code === 'facture.tva_sous_franchise');
    expect(tva?.gravite).toBe('bloquant');
    expect(tva?.message).toContain('293 B');
  });

  it('laisse passer une facture à 0 % sous franchise', () => {
    const manques = validerFacture(
      {
        ...FACTURE_COMPLETE,
        items: [{ description: 'Dépannage', quantity: 1, unit_price_cents: 9000, vat_rate: 0 }],
      },
      { ...EMETTEUR_COMPLET, vat_regime: 'franchise', vat_number: null },
    );

    expect(codes(manques)).not.toContain('facture.tva_sous_franchise');
  });

  it('signale un montant nul sans bloquer', () => {
    const manques = validerFacture(
      {
        ...FACTURE_COMPLETE,
        items: [
          { description: 'Geste commercial', quantity: 1, unit_price_cents: 0, vat_rate: 20 },
        ],
      },
      EMETTEUR_COMPLET,
    );

    expect(manques.find((m) => m.code === 'facture.montant_nul')?.gravite).toBe('avertissement');
  });
});

describe('validerEmission', () => {
  it('autorise l’émission quand tout est complet', () => {
    const verdict = validerEmission(FACTURE_COMPLETE, CLIENT_COMPLET, EMETTEUR_COMPLET);

    expect(verdict.emissionPossible).toBe(true);
    expect(verdict.bloquants).toEqual([]);
  });

  it('un simple avertissement n’empêche pas d’émettre', () => {
    const verdict = validerEmission(FACTURE_COMPLETE, CLIENT_COMPLET, {
      ...EMETTEUR_COMPLET,
      iban: null,
    });

    expect(verdict.avertissements.length).toBeGreaterThan(0);
    expect(verdict.emissionPossible).toBe(true);
  });

  it('un seul manque bloquant suffit à interdire l’émission', () => {
    const verdict = validerEmission(
      FACTURE_COMPLETE,
      { ...CLIENT_COMPLET, registration_number: null },
      EMETTEUR_COMPLET,
    );

    expect(verdict.emissionPossible).toBe(false);
    expect(codes(verdict.bloquants)).toEqual(['client.siret']);
  });

  it('range les manques dans l’ordre de correction : entreprise, client, facture', () => {
    // L'entreprise d'abord : un manque s'y corrige une fois pour toutes, alors
    // qu'un manque côté client se répétera à chaque facture.
    const verdict = validerEmission(
      { ...FACTURE_COMPLETE, due_date: null },
      { ...CLIENT_COMPLET, address_line1: null },
      { ...EMETTEUR_COMPLET, registration_number: null },
    );

    expect(verdict.bloquants.map((m) => m.cible)).toEqual(['organisation', 'client', 'facture']);
  });
});

describe('preparationEmetteur', () => {
  it('coche tout pour une entreprise complète', () => {
    const etapes = preparationEmetteur(EMETTEUR_COMPLET);

    expect(etapes.every((e) => e.fait)).toBe(true);
    expect(etapes).toHaveLength(7);
  });

  it('considère la TVA intracommunautaire satisfaite sous franchise', () => {
    // L'étape ne s'applique pas — la cocher n'est pas de la complaisance, c'est
    // refuser d'afficher un défaut à qui n'en a aucun.
    const etapes = preparationEmetteur({
      ...EMETTEUR_COMPLET,
      vat_regime: 'franchise',
      vat_number: null,
    });

    expect(etapes.find((e) => e.code === 'tva_intracom')?.fait).toBe(true);
  });

  it('décoche ce qui manque réellement', () => {
    const etapes = preparationEmetteur({ name: 'Solo' });
    const faites = etapes.filter((e) => e.fait).map((e) => e.code);

    expect(faites).toEqual(['denomination']);
  });
});

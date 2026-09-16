import { describe, expect, it } from 'vitest';

import { buildProspectMessageDraft, isRecentCreation, joinFrench } from './message-draft';

const TEMPLATE = {
  opening_variant: 'Félicitations pour le lancement de votre activité de plomberie.',
  features: ['centraliser vos clients et chantiers', 'planifier vos interventions', 'générer devis et factures'],
  body_template:
    "Je me permets de vous contacter car j'ai développé REZO360.\n\nElle permet notamment de {{FEATURES}}.\n\nPertinent pour votre activité{{TERRITOIRE}}.",
};

describe('joinFrench', () => {
  it('gère 0, 1, 2 et 3+ éléments', () => {
    expect(joinFrench([])).toBe('');
    expect(joinFrench(['a'])).toBe('a');
    expect(joinFrench(['a', 'b'])).toBe('a et b');
    expect(joinFrench(['a', 'b', 'c'])).toBe('a, b et c');
  });
});

describe('isRecentCreation', () => {
  const now = new Date('2026-09-16T00:00:00Z');

  it('vrai pour une création de moins de 6 mois', () => {
    expect(isRecentCreation('2026-06-01', now)).toBe(true);
  });

  it('faux pour une création de plus de 6 mois', () => {
    expect(isRecentCreation('2025-01-01', now)).toBe(false);
  });

  it('faux quand la date de création est inconnue — jamais une supposition', () => {
    expect(isRecentCreation(null, now)).toBe(false);
  });
});

describe('buildProspectMessageDraft', () => {
  const now = new Date('2026-09-16T00:00:00Z');

  it('inclut l’ouverture « félicitations » seulement pour une création récente', () => {
    const recent = buildProspectMessageDraft({
      createdOn: '2026-08-01',
      commune: null,
      template: TEMPLATE,
      now,
    });
    expect(recent).toContain('Félicitations pour le lancement');

    const ancienne = buildProspectMessageDraft({
      createdOn: '2010-01-01',
      commune: null,
      template: TEMPLATE,
      now,
    });
    expect(ancienne).not.toContain('Félicitations');
  });

  it('assemble la liste des fonctionnalités en français naturel', () => {
    const message = buildProspectMessageDraft({ createdOn: null, commune: null, template: TEMPLATE, now });
    expect(message).toContain(
      'centraliser vos clients et chantiers, planifier vos interventions et générer devis et factures',
    );
  });

  it('ajoute le territoire seulement si la commune est connue', () => {
    const avecCommune = buildProspectMessageDraft({
      createdOn: null,
      commune: 'Fort-de-France',
      template: TEMPLATE,
      now,
    });
    expect(avecCommune).toContain('Pertinent pour votre activité à Fort-de-France.');

    const sansCommune = buildProspectMessageDraft({ createdOn: null, commune: null, template: TEMPLATE, now });
    expect(sansCommune).toContain('Pertinent pour votre activité.');
  });

  it('ne mentionne JAMAIS la détection ou SIRENE, quel que soit l’état d’entrée', () => {
    const cas = [
      buildProspectMessageDraft({ createdOn: '2026-09-10', commune: 'Fort-de-France', template: TEMPLATE, now }),
      buildProspectMessageDraft({ createdOn: null, commune: null, template: TEMPLATE, now }),
      buildProspectMessageDraft({ createdOn: '2000-01-01', commune: 'Le Lamentin', template: TEMPLATE, now }),
    ];
    for (const message of cas) {
      expect(message.toLowerCase()).not.toContain('sirene');
      expect(message.toLowerCase()).not.toContain('détecté');
      expect(message.toLowerCase()).not.toContain('detecte');
    }
  });
});

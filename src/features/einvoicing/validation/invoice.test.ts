import { describe, expect, it } from 'vitest';
import type { InvoiceWithItems, Organization } from '@/types/domain';
import { emetteurFacture } from './invoice';
import { validerEmission, validerFacture } from './rules';

describe('lecture des identités de facturation', () => {
  it('conserve les informations émises après un changement de nom et de banque', () => {
    const invoice = {
      status: 'issued',
      seller_name: 'Entreprise d’origine',
      seller_iban: 'IBAN original',
      seller_city: 'Ville originale',
      seller_vat_regime: 'franchise',
    } as InvoiceWithItems;
    const current = {
      name: 'Nouveau nom',
      iban: 'Nouvelle banque',
      city: 'Nouvelle ville',
      vat_regime: 'reel_normal',
    } as Organization;
    expect(emetteurFacture(invoice, current)).toMatchObject({
      name: 'Entreprise d’origine',
      iban: 'IBAN original',
      city: 'Ville originale',
      vat_regime: 'franchise',
    });
  });
  it('lit les informations courantes tant que le document reste un brouillon', () => {
    const current = { name: 'Nom corrigé', iban: 'Banque corrigée' } as Organization;
    expect(emetteurFacture({ status: 'draft' } as InvoiceWithItems, current)).toBe(current);
  });
  it('ne remplace pas un ancien instantané incomplet par les informations actuelles', () => {
    const invoice = { status: 'issued', seller_name: null, seller_iban: null } as InvoiceWithItems;
    expect(
      emetteurFacture(invoice, { name: 'Nom actuel', iban: 'Banque actuelle' } as Organization),
    ).toMatchObject({ name: '', iban: null });
  });
});

describe('contrôles avant émission', () => {
  it.each([NaN, Infinity, 0, -1])('refuse une quantité invalide : %s', (quantity) => {
    const result = validerFacture(
      {
        due_date: '2026-10-01',
        payment_terms: 'À réception',
        items: [{ description: 'Prestation', quantity, unit_price_cents: 1000, vat_rate: 20 }],
      },
      {},
    );
    expect(result.some((m) => m.code === 'facture.lignes_invalides')).toBe(true);
  });
  it('refuse une échéance vide même si elle provient d’un formulaire', () => {
    expect(
      validerFacture({ due_date: '', payment_terms: 'À réception', items: [] }, {}).some(
        (m) => m.code === 'facture.echeance',
      ),
    ).toBe(true);
  });
  it('bloque une émission avec une adresse sans pays', () => {
    const result = validerEmission(
      {
        due_date: '2026-10-01',
        payment_terms: 'À réception',
        items: [{ description: 'Prestation', quantity: 1, unit_price_cents: 1000, vat_rate: 0 }],
      },
      {
        name: 'Particulier',
        customer_type: 'individual',
        address_line1: 'Rue',
        postal_code: '97200',
        city: 'Ville',
      },
      {
        name: 'Entreprise',
        legal_form: 'EI',
        registration_number: '12345678900012',
        address_line1: 'Rue',
        postal_code: '97200',
        city: 'Ville',
        vat_regime: 'franchise',
      },
    );
    expect(result.bloquants.map((m) => m.code)).toEqual(['emetteur.adresse', 'client.adresse']);
  });
});

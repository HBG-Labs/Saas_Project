import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSeatBilling } from './useSeatBilling';

/**
 * La règle qui décide si l'on annonce « +5 € / mois ».
 *
 * Elle avait été écrite deux fois — une en base, une dans l'écran des membres —
 * et les deux versions ne comptaient pas la même chose. Ces cas fixent celle qui
 * fait foi : celle du serveur.
 */

const synthese = vi.hoisted(() => ({
  current: null as null | Record<string, unknown>,
  isPending: false,
}));

vi.mock('./useCheckout', () => ({
  useBillingSummary: () => ({ data: synthese.current, isPending: synthese.isPending }),
}));

function lire() {
  return renderHook(() => useSeatBilling('org-1')).result.current;
}

function resume(over: Record<string, unknown> = {}) {
  return {
    planCode: 'business',
    planName: 'Business',
    includedSeats: 10,
    activeSeats: 2,
    extraSeats: 0,
    extraSeatCents: 500,
    baseCents: 6900,
    totalCents: 6900,
    maxUsers: null,
    subscriptionStatus: 'active',
    isBilled: true,
    ...over,
  };
}

describe('useSeatBilling', () => {
  beforeEach(() => {
    synthese.current = resume();
    synthese.isPending = false;
  });

  it('n’annonce aucun supplément tant que la formule absorbe l’effectif', () => {
    expect(lire().isExtraSeat).toBe(false);
  });

  it('annonce le supplément dès que les sièges inclus sont tous occupés', () => {
    // Dix actifs pour dix inclus : c'est le ONZIÈME qui coûte, et c'est
    // maintenant qu'il faut le dire — pas une fois le prélèvement passé.
    synthese.current = resume({ activeSeats: 10 });
    expect(lire().isExtraSeat).toBe(true);
  });

  it('ne compte QUE les actifs, jamais les invitations en attente', () => {
    // Le défaut corrigé : l'écran comptait les lignes non retirées. Une
    // entreprise à huit actifs et deux invitations, sur dix sièges inclus,
    // s'entendait annoncer un supplément pour un compte encore gratuit.
    // La synthèse serveur, elle, ne connaît que les actifs — huit ici.
    synthese.current = resume({ activeSeats: 8 });
    expect(lire().isExtraSeat).toBe(false);
  });

  it('bloque au lieu de facturer sur la formule Gratuite', () => {
    synthese.current = resume({ planCode: 'free', includedSeats: 1, activeSeats: 1, maxUsers: 1 });
    const r = lire();

    expect(r.quotaBlocked).toBe(true);
    // Gratuit ne facture rien : le dépassement y est refusé, pas vendu.
    expect(r.isExtraSeat).toBe(false);
  });

  it('ne bloque jamais une formule payante : le dépassement se facture', () => {
    synthese.current = resume({ activeSeats: 40 });
    const r = lire();

    expect(r.quotaBlocked).toBe(false);
    expect(r.isExtraSeat).toBe(true);
  });

  it('n’affirme rien tant que le serveur n’a pas répondu', () => {
    synthese.current = null;
    synthese.isPending = true;
    const r = lire();

    // Annoncer un prix avant de le connaître, c'est le deviner.
    expect(r.isExtraSeat).toBe(false);
    expect(r.quotaBlocked).toBe(false);
    expect(r.includedSeats).toBeNull();
    expect(r.isLoading).toBe(true);
  });

  it('distingue un supplément DÛ d’un supplément à venir', () => {
    // Le cas qui a fait conclure à une panne : onze comptes pour dix inclus,
    // pendant l'essai. Le montant est juste, mais aucun abonnement Stripe
    // n'existe — rien n'y sera modifié, et rien ne sera prélevé avant la
    // souscription. L'écran doit pouvoir le dire.
    synthese.current = resume({
      activeSeats: 11,
      extraSeats: 1,
      subscriptionStatus: 'trialing',
      isBilled: false,
    });
    const r = lire();

    expect(r.isExtraSeat).toBe(true);
    expect(r.isBilled).toBe(false);
  });

  it('signale un supplément réellement prélevé quand un prestataire encaisse', () => {
    synthese.current = resume({ activeSeats: 11, extraSeats: 1, isBilled: true });
    const r = lire();

    expect(r.isExtraSeat).toBe(true);
    expect(r.isBilled).toBe(true);
  });

  it('ne suppose jamais qu’on est facturé faute de réponse', () => {
    synthese.current = null;
    synthese.isPending = true;

    // Le défaut sûr est l'absence de prélèvement : annoncer à tort un débit
    // inquiète, taire un débit réel se corrige à la réponse suivante.
    expect(lire().isBilled).toBe(false);
  });

  it('prend le prix du siège dans la synthèse, et non dans une constante', () => {
    synthese.current = resume({ extraSeatCents: 700 });
    expect(lire().extraSeatPrice).toBe(7);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
  Ce qui est vérifié ici, c'est la REQUÊTE ENVOYÉE, pas la réponse : quels
  paramètres partent vers `record_payment`, et surtout lesquels n'y partent
  pas. Un `p_amount_cents: undefined` sérialisé en `null` déclencherait le
  mode « reste dû » alors qu'un montant explicite était voulu — ou l'inverse.
*/
const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());

/** Reproduit `unwrap` : une erreur PostgREST devient une Error qui garde son code. */
async function deballer(q: PromiseLike<{ data: unknown; error: unknown }>) {
  const { data, error } = await q;
  if (error) {
    const e = error as { message?: string; code?: string };
    throw Object.assign(new Error(e.message ?? 'Erreur'), { code: e.code });
  }
  return data;
}

vi.mock('@/services/supabase', () => ({
  supabase: { rpc, from },
  unwrap: deballer,
  unwrapMaybe: deballer,
}));

import { recordPayment } from './invoices.api';

const LIGNE = {
  id: 'p-1',
  organization_id: 'org-1',
  invoice_id: 'inv-1',
  amount_cents: 7000,
  paid_on: '2026-09-20',
  method: 'other',
  reference: null,
  note: null,
  created_by: 'u-1',
  created_at: '',
  updated_at: '',
};

describe('recordPayment', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: LIGNE, error: null });
  });

  it('« Marquer payée » n’envoie que la facture : le montant reste à la base', async () => {
    // Sans `p_amount_cents`, la fonction SQL encaisse ce qui manque au livre.
    // Envoyer `null` explicitement reviendrait au même ; envoyer `undefined`
    // sérialisé pourrait ne pas — on ne laisse pas la question se poser.
    await recordPayment({ invoiceId: 'inv-1' });

    expect(rpc).toHaveBeenCalledWith('record_payment', { p_invoice_id: 'inv-1' });
  });

  it('transmet chaque champ renseigné sous son nom SQL', async () => {
    await recordPayment({
      invoiceId: 'inv-1',
      amountCents: 5000,
      paidOn: '2026-09-18',
      method: 'transfer',
      reference: 'VIR-001',
      note: 'Acompte',
    });

    expect(rpc).toHaveBeenCalledWith('record_payment', {
      p_invoice_id: 'inv-1',
      p_amount_cents: 5000,
      p_paid_on: '2026-09-18',
      p_method: 'transfer',
      p_reference: 'VIR-001',
      p_note: 'Acompte',
    });
  });

  it('laisse remonter le refus de la base tel quel', async () => {
    // Trop-perçu, facture soldée, brouillon : c'est la base qui décide et qui
    // formule le message. Le client ne réinterprète pas.
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'Facture F-0001 : ce règlement dépasserait le total', code: '23514' },
    });

    await expect(recordPayment({ invoiceId: 'inv-1', amountCents: 999999 })).rejects.toMatchObject({
      code: '23514',
    });
  });
});

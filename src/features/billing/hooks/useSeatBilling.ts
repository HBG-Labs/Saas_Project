import { useBillingSummary } from './useCheckout';

/**
 * Le prochain compte sera-t-il facturé, et à partir de quand ?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE HOOK EXISTE
 *
 * L'écran des membres décidait seul d'annoncer « +5 € / mois », en comparant le
 * nombre de lignes non retirées à la limite lue dans le miroir TypeScript. Deux
 * écarts avec la facturation réelle, tous deux silencieux :
 *
 *   • il comptait les INVITÉS. Or une invitation en attente n'est pas facturée :
 *     le siège devient payant à l'acceptation, et nulle part ailleurs. Une
 *     entreprise à huit actifs et deux invitations, sur une formule qui en
 *     inclut dix, s'entendait annoncer un supplément pour un compte qui ne
 *     coûtait rien.
 *   • il lisait la limite dans le paquet JavaScript. Le montant, lui, se calcule
 *     en base. Deux sources pour un même chiffre finissent toujours par diverger.
 *
 * On lit donc `organization_billing_summary` — exactement la fonction qui décide
 * du montant, et celle que les fonctions Edge interrogent avant d'appeler
 * Stripe. Annoncer un prix depuis une autre source que celle qui l'applique,
 * c'est promettre ce qu'on ne contrôle pas.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface SeatBilling {
  /** Formule Gratuite : le plafond est dur, l'ajout est refusé et non facturé. */
  isFree: boolean;
  /** L'ajout sera REFUSÉ par le serveur (Free uniquement). */
  quotaBlocked: boolean;
  /** Le prochain compte actif sera facturé en supplément. */
  isExtraSeat: boolean;
  /** Prix du siège supplémentaire, en euros, tel que la base le porte. */
  extraSeatPrice: number;
  /** Comptes facturables — actifs uniquement, comme la facturation. */
  activeSeats: number;
  /** Sièges compris dans la formule ; `null` tant que la synthèse n'a pas répondu. */
  includedSeats: number | null;
  /**
   * Le supplément est-il RÉELLEMENT prélevé aujourd'hui ? `false` pendant
   * l'essai : le montant est juste, mais il ne sera dû qu'à la souscription.
   * Annoncer « +5 € / mois » au présent a déjà fait croire à une panne de
   * synchronisation chez Stripe, où il n'y avait rien à synchroniser.
   */
  isBilled: boolean;
  isLoading: boolean;
}

export function useSeatBilling(organizationId: string | null): SeatBilling {
  const summary = useBillingSummary(organizationId);
  const data = summary.data ?? null;

  const isFree = data?.planCode === 'free';

  return {
    isFree,
    // `maxUsers` n'est renseigné que pour Free : ailleurs, le dépassement est
    // facturé et jamais refusé — c'est la grille, pas une tolérance.
    quotaBlocked: data !== null && data.maxUsers !== null && data.activeSeats >= data.maxUsers,
    // Sièges ACTIFS, comme la facturation. Le seuil est atteint dès l'égalité :
    // à dix actifs pour dix inclus, c'est le onzième qui coûte.
    isExtraSeat: data !== null && !isFree && data.activeSeats >= data.includedSeats,
    extraSeatPrice: (data?.extraSeatCents ?? 500) / 100,
    activeSeats: data?.activeSeats ?? 0,
    includedSeats: data?.includedSeats ?? null,
    isBilled: data?.isBilled ?? false,
    isLoading: summary.isPending,
  };
}

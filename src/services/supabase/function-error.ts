/**
 * Le message qu'une Edge Function a réellement renvoyé.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI IL FAUT ALLER LE CHERCHER
 *
 * Sur une réponse non-2xx, `functions.invoke` met `data` à `null` et place la
 * réponse HTTP dans `error.context`. Lire `data.error` ne donne donc jamais
 * rien en cas d'échec — précisément le cas où le message compte.
 *
 * Sans cela, l'utilisateur voit « la session n'a pas pu être ouverte » là où la
 * fonction disait « Tarifs Stripe non configurés pour Pro » ou « Seul le
 * propriétaire peut gérer l'abonnement ». Le premier message ne permet aucune
 * action ; les seconds, si.
 *
 * MIS EN COMMUN parce qu'il l'était déjà en pratique : la facturation en avait
 * une version, les organisations une autre écrite à la main dans
 * `sendInvitationEmail`. Une troisième copie était sur le point d'apparaître.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function messageDeLaFonction(error: unknown, repli: string): Promise<string> {
  const contexte: unknown = (error as { context?: unknown } | null)?.context;

  if (contexte instanceof Response) {
    try {
      const corps = (await contexte.clone().json()) as { error?: unknown };
      if (typeof corps.error === 'string' && corps.error !== '') return corps.error;
    } catch {
      // Corps illisible : le repli reste plus utile qu'une exception ici.
    }
  }

  return repli;
}

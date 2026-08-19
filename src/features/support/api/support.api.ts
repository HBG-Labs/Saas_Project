import { mapPostgrestError } from '@/lib/errors';
import { supabase } from '@/services/supabase';

/**
 * Envoi d'une demande d'assistance.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ÉCRIRE D'ABORD, NOTIFIER ENSUITE
 *
 * La demande est enregistrée en base, PUIS la notification est demandée. Si le
 * serveur de messagerie hoquette, le message est conservé et se retrouve dans
 * le tableau de bord — le client n'a pas écrit pour rien.
 *
 * L'ordre inverse perdrait la demande au premier incident, ce qui est
 * exactement le défaut qu'on corrige : le formulaire simulait un envoi et
 * jetait le message.
 *
 * Le résultat distingue donc trois issues, parce que l'écran doit les
 * distinguer aussi. « Enregistré mais non notifié » n'est pas un échec : c'est
 * une promesse tenue à moitié, et le dire vaut mieux que de choisir entre deux
 * mensonges.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface SupportResult {
  /** La demande est en base : rien n'est perdu. */
  stored: true;
  /** La notification est partie. Faux = à relancer par un autre moyen. */
  notified: boolean;
  /** Motif de la non-notification, affichable. */
  reason?: string;
}

/** Écrit la demande, puis demande sa notification. */
export async function submitSupportRequest(input: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  userId: string | null;
}): Promise<SupportResult> {
  /**
   * L'IDENTIFIANT EST FORGÉ ICI, et non lu en retour.
   *
   * Demander `.select('id')` après l'insertion produit un `RETURNING`, que
   * PostgreSQL soumet aux policies de LECTURE — or il n'y en a aucune, par
   * conception. L'insertion réussissait donc et l'appel échouait quand même,
   * sur un message trompeur : « new row violates row-level security policy ».
   * Mesuré en visiteur anonyme, seul chemin où les policies s'appliquent
   * vraiment.
   *
   * Le forger de ce côté-ci lève l'obstacle sans rouvrir la lecture des
   * demandes à qui que ce soit.
   */
  const requestId = crypto.randomUUID();

  const { error } = await supabase.from('support_requests').insert({
    id: requestId,
    user_id: input.userId,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() === '' ? null : (input.phone?.trim() ?? null),
    message: input.message.trim(),
  });

  if (error) throw mapPostgrestError(error);

  // À partir d'ici la demande EXISTE. Plus rien ne doit la faire disparaître,
  // pas même l'échec de sa notification.

  try {
    const { data: envoi } = (await supabase.functions.invoke('send-support-request', {
      body: { requestId },
    })) as { data: { notified?: boolean; reason?: string } | null };

    return {
      stored: true,
      notified: envoi?.notified === true,
      ...(envoi?.reason === undefined ? {} : { reason: envoi.reason }),
    };
  } catch {
    // La notification a échoué, la demande est enregistrée. On le dit.
    return {
      stored: true,
      notified: false,
      reason: "La notification n'a pas pu partir.",
    };
  }
}

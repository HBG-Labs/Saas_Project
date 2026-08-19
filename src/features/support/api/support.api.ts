import { AppError, mapPostgrestError } from '@/lib/errors';
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

const BUCKET = 'support-attachments';

/**
 * Métadonnées d'un fichier joint, telles qu'elles sont écrites en base.
 *
 * La signature d'index satisfait le type `Json` de PostgREST : sans elle, un
 * objet nommé n'est pas reconnu comme structure JSON quelconque.
 */
export interface SupportAttachment {
  [key: string]: string | number;
  name: string;
  path: string;
  size: number;
  type: string;
}

export interface SupportResult {
  /** La demande est en base : rien n'est perdu. */
  stored: true;
  /** La notification est partie. Faux = à relancer par un autre moyen. */
  notified: boolean;
  /** Motif de la non-notification, affichable. */
  reason?: string;
}

/**
 * Dépose les fichiers, puis écrit la demande.
 *
 * Le nettoyage en cas d'échec suit `uploadAttachment` des interventions : un
 * fichier téléversé dont la ligne n'a pas pu s'écrire est un orphelin que plus
 * rien ne référence, et que personne ne viendra chercher.
 */
export async function submitSupportRequest(input: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  files: readonly File[];
  userId: string | null;
}): Promise<SupportResult> {
  const deposes: string[] = [];

  try {
    for (const file of input.files) {
      // Préfixe aléatoire : deux personnes envoyant `capture.png` ne doivent pas
      // s'écraser l'une l'autre, et le nom d'origine reste lisible dans le
      // courriel grâce aux métadonnées.
      const path = `${crypto.randomUUID()}/${file.name}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (error) {
        throw new AppError('unknown', `Le fichier « ${file.name} » n'a pas pu être joint.`);
      }

      deposes.push(path);
    }

    const attachments: SupportAttachment[] = input.files.map((file, index) => ({
      name: file.name,
      path: deposes[index] ?? '',
      size: file.size,
      type: file.type,
    }));

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

    const { error } = await supabase
      .from('support_requests')
      .insert({
        id: requestId,
        user_id: input.userId,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() === '' ? null : (input.phone?.trim() ?? null),
        message: input.message.trim(),
        attachments,
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
  } catch (thrown) {
    // Retrait des fichiers déjà déposés : sans cela, chaque échec laisse des
    // pièces jointes que plus aucune demande ne référence.
    if (deposes.length > 0) {
      await supabase.storage.from(BUCKET).remove(deposes);
    }
    throw thrown;
  }
}

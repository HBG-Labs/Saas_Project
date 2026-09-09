/**
 * La garde d'adresse confirmée, côté serveur.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CETTE GARDE EXISTE ICI ET PAS SEULEMENT DANS L'INTERFACE
 *
 * L'inscription laisse désormais entrer immédiatement, sans passer par la boîte
 * mail : le mur de confirmation était le plus gros point de perte du tunnel
 * publicitaire. La confirmation n'a pas disparu, elle a été reportée aux deux
 * gestes qui engagent quelqu'un d'autre que soi.
 *
 * L'interface les désactive et l'explique. Cela ne protège rien : ces deux
 * gestes passent par des fonctions Edge appelables directement, avec un simple
 * jeton de session. Un bouton grisé n'est pas une garde — c'est une politesse.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES DEUX GESTES, ET CE QU'ILS RISQUENT SANS ELLE
 *
 *   • INVITER envoie un e-mail à une adresse arbitraire depuis nos serveurs.
 *     Sans confirmation préalable, REZO360 devient un relais d'envoi gratuit :
 *     on crée un compte avec une adresse jetable, et on expédie ce qu'on veut
 *     à qui on veut, avec notre nom de domaine en garantie. La sanction ne
 *     serait pas technique mais commerciale — notre réputation d'expéditeur
 *     s'effondre, et les invitations légitimes finissent en indésirables.
 *
 *   • SOUSCRIRE crée une relation commerciale. Une adresse non vérifiée, c'est
 *     une facture non délivrable et un client injoignable au premier incident
 *     de paiement.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX CHAMPS, ET IL FAUT LES DEUX
 *
 * `email_confirmed_at` est le champ moderne ; `confirmed_at` subsiste sur les
 * comptes plus anciens et sur les connexions par fournisseur — Google vérifie
 * l'adresse lui-même, sans que Supabase n'ait jamais envoyé de message.
 *
 * Ne lire que le premier refuserait d'inviter à des comptes Google
 * parfaitement légitimes, en leur demandant de confirmer un e-mail qu'ils
 * n'ont jamais reçu.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Forme minimale attendue d'un client Supabase, décrite ici plutôt
 * qu'importée : ce module reste ainsi sans dépendance, donc vérifiable par
 * `deno check` — ce que les fonctions plus anciennes ne sont pas, faute de
 * résoudre `jsr:@supabase/supabase-js`.
 */
interface ClientAvecAuth {
  auth: {
    getUser: (jwt?: string) => Promise<{
      data: {
        user: { email_confirmed_at?: string | null; confirmed_at?: string | null } | null;
      };
    }>;
  };
}

/** Message unique, pour que les deux fonctions disent exactement la même chose. */
export const MESSAGE_CONFIRMATION_REQUISE =
  'Confirmez votre adresse e-mail pour effectuer cette action. ' +
  'Un lien vous a été envoyé à votre inscription ; vous pouvez le renvoyer depuis l’application.';

/**
 * L'appelant a-t-il une adresse confirmée ?
 *
 * Répond `false` quand l'utilisateur est introuvable ou que la lecture échoue :
 * une garde qui s'ouvre en cas de doute ne garde rien.
 */
export async function emailAppelantConfirme(
  client: ClientAvecAuth,
  jwt?: string,
): Promise<boolean> {
  try {
    const { data } = await client.auth.getUser(jwt);
    const utilisateur = data.user;
    if (utilisateur === null) return false;
    return utilisateur.email_confirmed_at != null || utilisateur.confirmed_at != null;
  } catch {
    return false;
  }
}

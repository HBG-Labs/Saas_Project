import type { User } from '@supabase/supabase-js';

/**
 * L'adresse de ce compte a-t-elle été confirmée ?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CETTE QUESTION EXISTE MAINTENANT
 *
 * L'inscription renvoyait vers la boîte mail avant de laisser entrer. En trafic
 * publicitaire, c'était le plus gros point de perte du tunnel : le visiteur
 * arrive dans le navigateur intégré à Facebook ou Instagram, et le lien de
 * confirmation s'ouvre dans Safari ou Chrome — un autre navigateur, une autre
 * session, et l'attribution de la publicité perdue au passage.
 *
 * L'accès est donc immédiat. La confirmation n'a pas disparu pour autant : elle
 * est REPORTÉE aux deux gestes où elle protège vraiment quelqu'un.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QU'ELLE PROTÈGE, ET CE QU'ELLE NE PROTÉGEAIT PAS
 *
 * Exiger la confirmation pour consulter son propre tableau de bord ne protège
 * personne : au pire, quelqu'un s'est trompé d'adresse et ne pourra pas
 * récupérer son compte — son problème, et il le découvre vite.
 *
 * Deux gestes engagent des tiers, et ceux-là restent fermés :
 *
 *   • INVITER UN COLLÈGUE envoie un e-mail à une adresse arbitraire depuis nos
 *     serveurs. Sans confirmation préalable, n'importe qui pourrait se servir
 *     de REZO360 comme relais d'envoi, avec notre nom de domaine et notre
 *     réputation d'expéditeur en garantie.
 *
 *   • SOUSCRIRE UNE FORMULE PAYANTE crée une relation commerciale. Une adresse
 *     non vérifiée signifie facture non délivrable, relance impossible, et
 *     aucun moyen de joindre le client en cas d'incident de paiement.
 *
 * La règle est donc : entrer est libre, engager les autres demande une adresse
 * prouvée.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function emailEstConfirme(utilisateur: User | null): boolean {
  if (utilisateur === null) return false;

  /*
    Deux champs, et il faut les deux.

    `email_confirmed_at` est le champ moderne. `confirmed_at` subsiste sur les
    comptes plus anciens et sur certains parcours de connexion — notamment
    Google, où l'adresse est vérifiée par le fournisseur sans que Supabase
    n'ait jamais envoyé de message.

    Ne lire que le premier ferait passer pour non confirmés des comptes qui le
    sont, et leur afficherait un bandeau leur demandant de vérifier un e-mail
    qu'ils n'ont jamais reçu.
  */
  return utilisateur.email_confirmed_at != null || utilisateur.confirmed_at != null;
}

/** Message unique, pour que les gardes disent tous la même chose. */
export const MESSAGE_CONFIRMATION_REQUISE =
  'Confirmez votre adresse e-mail pour débloquer cette action. ' +
  'Le lien vous a été envoyé à votre inscription.';

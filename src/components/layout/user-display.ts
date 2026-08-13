import type { User } from '@supabase/supabase-js';

/**
 * Nom à afficher pour un utilisateur.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA SOURCE EST LA SESSION, PLUS LE STOCKAGE LOCAL
 *
 * La version précédente lisait d'abord `nexoratech_user_profile` dans le
 * navigateur. Deux conséquences : le nom d'un compte survivait à la déconnexion
 * et s'affichait pour le suivant, et un nom modifié sur un autre appareil ne
 * remontait jamais.
 *
 * `display_name` vit dans `profiles`, et `updateMyProfile` le recopie dans les
 * métadonnées de la session — d'où sa lecture ici, sans requête ni attente au
 * premier rendu.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ordre de repli : métadonnées → partie locale de l'e-mail → libellé générique.
 */
export function displayNameOf(user: User | null | undefined): string {
  const metadataName: unknown = user?.user_metadata?.['display_name'];
  if (typeof metadataName === 'string' && metadataName.trim() !== '') {
    return metadataName.trim();
  }

  const localPart = user?.email?.split('@')[0];
  if (localPart !== undefined && localPart !== '') return localPart;

  return 'Utilisateur';
}

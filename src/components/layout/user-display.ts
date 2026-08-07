import type { User } from '@supabase/supabase-js';

/**
 * Nom à afficher pour un utilisateur.
 *
 * Ordre de repli : nom choisi → partie locale de l'e-mail → libellé générique.
 * Factorisé car la même logique servait dans l'en-tête, la barre latérale et la
 * page de profil, avec le risque de diverger.
 */
export function displayNameOf(user: User | null | undefined): string {
  const metadataName = user?.user_metadata['display_name'];
  if (typeof metadataName === 'string' && metadataName.trim() !== '') {
    return metadataName;
  }

  const localPart = user?.email?.split('@')[0];
  if (localPart !== undefined && localPart !== '') return localPart;

  return 'Utilisateur';
}

import type { User } from '@supabase/supabase-js';

/**
 * Nom à afficher pour un utilisateur.
 *
 * Ordre de repli : nom choisi → partie locale de l'e-mail → libellé générique.
 * Factorisé car la même logique servait dans l'en-tête, la barre latérale et la
 * page de profil, avec le risque de diverger.
 */
export function displayNameOf(user: User | null | undefined): string {
  // `user_metadata` est typé `Record<string, any>` par supabase-js : la valeur
  // est reçue en `unknown` pour forcer le contrôle de type ci-dessous plutôt
  // que de propager un `any` dans l'interface.
  const metadataName: unknown = user?.user_metadata['display_name'];
  if (typeof metadataName === 'string' && metadataName.trim() !== '') {
    return metadataName;
  }

  const localPart = user?.email?.split('@')[0];
  if (localPart !== undefined && localPart !== '') return localPart;

  return 'Utilisateur';
}

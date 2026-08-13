import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { TablesUpdate } from '@/types/database';
import type { Profile, ProfileDetails } from '@/types/domain';

/**
 * Fiche du compte, en deux tables aux régimes distincts.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI DEUX TABLES
 *
 * `profiles` porte l'IDENTITÉ — nom affiché, avatar. Depuis
 * `profiles_select_visible`, elle est lisible par les collègues de la même
 * organisation : sans cela, la liste des membres affichait « Membre » partout,
 * et toute affectation de mission devenait illisible.
 *
 * `profile_details` porte la PERSONNE — téléphone, zone, habilitations,
 * matériel déclaré. `profile_details_*_own` la réserve à son titulaire, pas
 * même un propriétaire d'organisation n'y accède.
 *
 * PostgreSQL ne sachant pas restreindre des colonnes ligne par ligne, la
 * séparation en deux tables est ce qui rend les deux règles simultanément
 * applicables — et lisibles dans le schéma lui-même.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface FullProfile {
  identity: Profile | null;
  details: ProfileDetails | null;
}

export async function getMyProfile(userId: string): Promise<FullProfile> {
  // Deux lectures en parallèle : elles portent sur des tables différentes, et
  // les enchaîner doublerait l'attente sans rien apporter.
  const [identity, details] = await Promise.all([
    unwrapMaybe(supabase.from('profiles').select('*').eq('id', userId).single()),
    unwrapMaybe(
      supabase.from('profile_details').select('*').eq('user_id', userId).maybeSingle(),
    ),
  ]);

  return { identity, details };
}

export async function updateMyProfile(
  userId: string,
  patch: {
    identity?: TablesUpdate<'profiles'>;
    details?: Omit<TablesUpdate<'profile_details'>, 'user_id'>;
  },
): Promise<FullProfile> {
  if (patch.identity && Object.keys(patch.identity).length > 0) {
    await unwrap(
      supabase.from('profiles').update(patch.identity).eq('id', userId).select('id').single(),
    );

    // Les métadonnées de session suivent le profil, jamais l'inverse :
    // `profiles` fait foi. Sans cette recopie, l'en-tête continuerait d'afficher
    // l'ancien nom jusqu'à la prochaine reconnexion.
    if (patch.identity.display_name !== undefined) {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: patch.identity.display_name },
      });
      if (error) throw error;
    }
  }

  if (patch.details && Object.keys(patch.details).length > 0) {
    // `upsert` plutôt qu'`update` : la fiche personnelle n'est créée qu'au
    // premier enregistrement. Un `update` sur une ligne absente ne toucherait
    // rien et rapporterait un succès trompeur.
    await unwrap(
      supabase
        .from('profile_details')
        .upsert({ user_id: userId, ...patch.details }, { onConflict: 'user_id' })
        .select('user_id')
        .single(),
    );
  }

  return getMyProfile(userId);
}

import { mapPostgrestError } from '@/lib/errors';
import { supabase, unwrapMaybe } from '@/services/supabase';
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
    jobTitle?: string;
  },
): Promise<FullProfile> {
  // 1. Mise à jour de l'identité dans profiles
  if (patch.identity && Object.keys(patch.identity).length > 0) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update(patch.identity)
      .eq('id', userId);

    if (profileError) {
      console.error('Erreur mise à jour profiles:', profileError);
      throw mapPostgrestError(profileError);
    }
  }

  // 2. Mise à jour de la fiche personnelle dans profile_details
  if (patch.details && Object.keys(patch.details).length > 0) {
    const { error: detailsError } = await supabase
      .from('profile_details')
      .upsert(
        {
          user_id: userId,
          phone: patch.details.phone ?? null,
          zone: patch.details.zone ?? null,
          certifications: patch.details.certifications ?? [],
          equipments: patch.details.equipments ?? [],
        },
        { onConflict: 'user_id' },
      );

    if (detailsError) {
      console.error('Erreur sauvegarde profile_details:', detailsError);
      throw mapPostgrestError(detailsError);
    }
  }

  // 3. Recopie non-bloquante de confort dans la session GoTrue
  try {
    const authData: Record<string, unknown> = {};
    if (patch.identity?.display_name !== undefined) {
      authData['display_name'] = patch.identity.display_name;
    }
    if (patch.jobTitle !== undefined) {
      authData['job_title'] = patch.jobTitle;
    }
    if (Object.keys(authData).length > 0) {
      await supabase.auth.updateUser({
        data: authData,
      });
    }
  } catch (authErr) {
    console.warn('Recopie auth.updateUser non bloquante ignorée:', authErr);
  }

  return getMyProfile(userId);
}

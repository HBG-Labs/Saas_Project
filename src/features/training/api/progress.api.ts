import { supabase, unwrap } from '@/services/supabase';

export interface ProgressionCours {
  courseSlug: string;
  chapitresTermines: string[];
}

/**
 * La progression de la personne connectée, tous parcours confondus.
 *
 * Aucun filtre par utilisateur n'est écrit ici : la RLS de `training_progress`
 * ne laisse voir que ses propres lignes. En ajouter un donnerait l'illusion
 * que c'est LUI qui protège — et invitrait à le retirer un jour « pour
 * simplifier ».
 */
export async function listerProgression(): Promise<ProgressionCours[]> {
  const lignes = await unwrap(
    supabase.from('training_progress').select('course_slug, completed_chapters'),
  );

  return lignes.map((l) => ({
    courseSlug: l.course_slug,
    chapitresTermines: l.completed_chapters,
  }));
}

/**
 * Enregistre la progression d'un parcours.
 *
 * `upsert` sur `(user_id, course_slug)` plutôt qu'un `select` suivi d'un
 * `insert` ou `update` : deux onglets ouverts sur le même cours produiraient
 * sinon une violation de contrainte au lieu d'une écriture. `user_id` est posé
 * par le trigger, il n'est pas envoyé.
 */
export async function enregistrerProgression(
  courseSlug: string,
  chapitresTermines: string[],
): Promise<void> {
  const { error } = await supabase
    .from('training_progress')
    .upsert(
      { course_slug: courseSlug, completed_chapters: chapitresTermines },
      { onConflict: 'user_id,course_slug' },
    );

  if (error) throw error;
}

import { supabase, unwrap } from '@/services/supabase';
import type { NoteCategory, TablesUpdate } from '@/types/database';
import type { Note } from '@/types/domain';

/**
 * Accès au bloc-notes personnel.
 *
 * Aucune notion de rôle ni de permission : une note n'appartient qu'à son
 * auteur, et les policies `notes_*_own` se réduisent à `user_id = auth.uid()`.
 * Ni un dirigeant ni un administrateur ne les lit — même régime que `favorites`
 * et `tool_history`.
 *
 * `user_id` n'est jamais transmis : le trigger `notes_enforce_owner` le pose
 * depuis la session. Le client n'a donc aucun moyen d'écrire pour autrui, même
 * en forgeant la requête.
 */

/**
 * Notes de l'utilisateur courant.
 *
 * `organizationId` filtre le contexte pour qui appartient à plusieurs
 * entreprises. `null` remonte les notes prises hors de toute organisation —
 * le bloc-notes reste accessible avant même d'en avoir créé une.
 */
export async function listNotes(organizationId: string | null): Promise<Note[]> {
  let query = supabase.from('notes').select('*');

  query =
    organizationId === null
      ? query.is('organization_id', null)
      : query.eq('organization_id', organizationId);

  return unwrap(
    query.order('is_pinned', { ascending: false }).order('updated_at', { ascending: false }),
  );
}

export async function createNote(input: {
  organizationId: string | null;
  title?: string;
  content?: string;
  category?: NoteCategory | null;
}): Promise<Note> {
  return unwrap(
    supabase
      .from('notes')
      .insert({
        organization_id: input.organizationId,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
      })
      .select('*')
      .single(),
  );
}

export async function updateNote(
  noteId: string,
  patch: TablesUpdate<'notes'>,
): Promise<Note> {
  return unwrap(supabase.from('notes').update(patch).eq('id', noteId).select('*').single());
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) throw error;
}

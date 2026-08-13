import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { useCurrentOrganization } from '@/features/organizations';
import { qk } from '@/lib/query-keys';
import type { NoteCategory, TablesUpdate } from '@/types/database';

import { createNote, deleteNote, listNotes, updateNote } from '../api/notes.api';

/**
 * Le bloc-notes de l'utilisateur courant, dans l'organisation courante.
 *
 * Le contexte est déduit ici plutôt que passé en paramètre : chaque écran qui
 * l'aurait recalculé aurait fini par en choisir un légèrement différent, et les
 * notes auraient semblé disparaître d'un écran à l'autre.
 */
export function useNotes() {
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();

  const userId = user?.id ?? null;
  const organizationId = organization?.id ?? null;

  return useQuery({
    queryKey: qk.notes.list(userId ?? 'anonymous', organizationId),
    queryFn: () => listNotes(organizationId),
    enabled: userId !== null,
  });
}

function useNotesInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: qk.notes.all });
}

export function useCreateNote() {
  const { organization } = useCurrentOrganization();
  const invalidate = useNotesInvalidation();

  return useMutation({
    mutationFn: (input: { title?: string; content?: string; category?: NoteCategory | null }) =>
      createNote({ ...input, organizationId: organization?.id ?? null }),
    onSuccess: async () => {
      await invalidate();
    },
  });
}

export function useUpdateNote() {
  const invalidate = useNotesInvalidation();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TablesUpdate<'notes'> }) =>
      updateNote(id, patch),
    onSuccess: async () => {
      await invalidate();
    },
  });
}

export function useDeleteNote() {
  const invalidate = useNotesInvalidation();

  return useMutation({
    mutationFn: (noteId: string) => deleteNote(noteId),
    onSuccess: async () => {
      await invalidate();
    },
  });
}

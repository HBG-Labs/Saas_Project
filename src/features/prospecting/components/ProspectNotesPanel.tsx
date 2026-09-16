import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { formatDateTime } from '@/lib/format';
import type { ProspectNote } from '@/types/domain';

import { useAddProspectNote } from '../hooks/useProspecting';

export function ProspectNotesPanel({ siren, notes }: { siren: string; notes: ProspectNote[] }) {
  const [draft, setDraft] = useState('');
  const addNote = useAddProspectNote(siren);

  const handleSubmit = () => {
    const body = draft.trim();
    if (body === '') return;
    addNote.mutate(body, { onSuccess: () => setDraft('') });
  };

  return (
    <div className="space-y-3">
      {notes.length === 0 ? (
        <p className="text-muted-foreground text-xs">Aucune note pour l’instant.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="border-border/70 rounded-lg border px-3 py-2 text-xs">
              <p className="text-foreground whitespace-pre-wrap">{note.body}</p>
              <p className="text-subtle-foreground text-3xs mt-1">{formatDateTime(note.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Textarea
          label="Ajouter une note"
          hideLabel
          placeholder="Ajouter une note interne…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={draft.trim() === '' || addNote.isPending}
          onClick={handleSubmit}
        >
          Ajouter la note
        </Button>
      </div>
    </div>
  );
}

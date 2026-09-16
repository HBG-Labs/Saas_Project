import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatDateTime } from '@/lib/format';
import type { ProspectFollowup } from '@/types/domain';

import { useCompleteFollowup, useScheduleFollowup } from '../hooks/useProspecting';

/** §21 du cahier des charges. Aucun envoi n'est déclenché : c'est un pense-bête. */
export function ProspectFollowupsPanel({
  siren,
  followups,
}: {
  siren: string;
  followups: ProspectFollowup[];
}) {
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');
  const schedule = useScheduleFollowup(siren);
  const complete = useCompleteFollowup();

  const pending = followups.filter((followup) => followup.completed_at === null);
  const done = followups.filter((followup) => followup.completed_at !== null);

  const handleSchedule = () => {
    if (dueAt === '') return;
    schedule.mutate(
      { dueAt: new Date(dueAt).toISOString(), note: note.trim() || null, kind: null },
      { onSuccess: () => { setDueAt(''); setNote(''); } },
    );
  };

  return (
    <div className="space-y-3">
      {pending.length === 0 ? (
        <p className="text-muted-foreground text-xs">Aucune relance programmée.</p>
      ) : (
        <div className="space-y-2">
          {pending.map((followup) => (
            <div
              key={followup.id}
              className="border-border/70 flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
            >
              <div>
                <p className="text-foreground font-semibold">{formatDateTime(followup.due_at)}</p>
                {followup.note && <p className="text-muted-foreground mt-0.5">{followup.note}</p>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={complete.isPending}
                onClick={() => complete.mutate(followup.id)}
              >
                Traitée
              </Button>
            </div>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <details className="text-xs">
          <summary className="text-muted-foreground cursor-pointer">
            {done.length} relance{done.length !== 1 ? 's' : ''} déjà traitée{done.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 space-y-1.5">
            {done.map((followup) => (
              <p key={followup.id} className="text-subtle-foreground">
                {formatDateTime(followup.due_at)} {followup.note ? `— ${followup.note}` : ''}
              </p>
            ))}
          </div>
        </details>
      )}

      <div className="space-y-2">
        <Input type="datetime-local" label="Programmer une relance" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        <Input
          label="Note (optionnel)"
          hideLabel
          placeholder="Ex. : rappeler après la réouverture des chantiers"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button size="sm" variant="outline" disabled={dueAt === '' || schedule.isPending} onClick={handleSchedule}>
          Programmer
        </Button>
      </div>
    </div>
  );
}

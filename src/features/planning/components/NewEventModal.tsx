import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Calendar, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { FormError } from '@/components/feedback/FormError';
import { memberDisplayName } from '@/features/organizations';
import type { MissionPriority } from '@/types/database';
import type { MemberWithProfile, Team } from '@/types/domain';

/**
 * Planifier depuis le calendrier, c'est créer une MISSION.
 *
 * Le calendrier n'a pas de table à lui : il compose missions, congés et jours
 * fériés. Un « événement » qui ne serait ni l'un ni l'autre n'aurait donc nulle
 * part où être écrit — c'était le cas de la version précédente, dont les
 * créations disparaissaient au rechargement.
 *
 * Les congés se posent par « Poser un congé », les fériés se calculent. Le
 * sélecteur de type a disparu pour cette raison : il proposait trois
 * destinations dont deux n'existaient pas.
 */
export interface NewEventSubmission {
  title: string;
  scheduledStart: string;
  scheduledEnd?: string;
  priority: MissionPriority;
  assignedTeamId: string | null;
  assignedMemberId: string | null;
  notes: string;
}

interface NewEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: readonly Team[];
  members: readonly MemberWithProfile[];
  submitting: boolean;
  error: unknown;
  initialDate?: string | null;
  onSubmit: (submission: NewEventSubmission) => void;
}

/** `2026-08-20` + `09:00` → instant ISO, en heure locale de qui saisit. */
function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function NewEventModal({
  open,
  onOpenChange,
  teams,
  members,
  submitting,
  error,
  initialDate,
  onSubmit,
}: NewEventModalProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<MissionPriority>('normal');
  const [date, setDate] = useState(
    initialDate || (new Date().toISOString().split('T')[0] ?? ''),
  );
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [assignment, setAssignment] = useState('unassigned');
  const [details, setDetails] = useState('');

  // Synchronise la date si `initialDate` change — au RENDU, pas dans un effet.
  //
  // Un `setState` synchrone dans un effet provoque un second rendu visible :
  // la modale s'ouvre un instant sur la date du jour avant d'afficher celle du
  // créneau cliqué. React documente ce motif sous « ajuster l'état quand une
  // prop change », et le dépôt l'emploie déjà dans `ReportEditorPage`.
  const [syncedDate, setSyncedDate] = useState(initialDate);
  if (open && initialDate != null && initialDate !== syncedDate) {
    setSyncedDate(initialDate);
    setDate(initialDate);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit({
      title: title.trim(),
      scheduledStart: toIso(date, startTime),
      ...(endTime !== '' ? { scheduledEnd: toIso(date, endTime) } : {}),
      priority,
      assignedTeamId: assignment.startsWith('team:') ? assignment.slice(5) : null,
      assignedMemberId: assignment.startsWith('member:') ? assignment.slice(7) : null,
      notes: details.trim(),
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface-raised p-5 shadow-modal data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:p-6 sm:data-[state=open]:zoom-in-95">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border-strong sm:hidden" aria-hidden="true" />
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <Calendar className="size-4" />
              </div>
              <Dialog.Title className="text-base font-bold text-foreground">
                Planifier un événement / tâche
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex size-touch items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground sm:size-8"
                aria-label="Fermer"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <FormError error={error} />

            <div>
              <label htmlFor="evt-title" className="block text-xs font-semibold text-foreground mb-1.5">
                Intitulé de l'intervention ou tâche
              </label>
              <input
                id="evt-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Maintenance climatisation, Raccordement..."
                className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-hidden sm:h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="evt-priority" className="block text-xs font-semibold text-foreground mb-1.5">
                  Priorité
                </label>
                <SelectField
                  id="evt-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as MissionPriority)}
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-hidden sm:h-10"
                >
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </SelectField>
              </div>

              <div>
                <Select
                  id="evt-assignment"
                  label="Affectation"
                  value={assignment}
                  onValueChange={setAssignment}
                  options={[{ value: 'unassigned', label: 'À affecter plus tard' }]}
                  groups={[
                    {
                      label: 'Équipes',
                      options: teams.map((team) => ({
                        value: `team:${team.id}`,
                        label: team.name,
                      })),
                    },
                    {
                      label: 'Intervenants',
                      options: members.map((member) => ({
                        value: `member:${member.id}`,
                        label: memberDisplayName(member),
                      })),
                    },
                  ]}
                  hint="Une équipe permet à chacun de ses membres d’intervenir."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="evt-date" className="block text-xs font-semibold text-foreground mb-1.5">
                  Date
                </label>
                <Input
                  id="evt-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-hidden sm:h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="evt-start" className="block text-xs font-semibold text-foreground mb-1.5">
                    Début
                  </label>
                  <Input
                    id="evt-start"
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-hidden sm:h-10"
                  />
                </div>
                <div>
                  <label htmlFor="evt-end" className="block text-xs font-semibold text-foreground mb-1.5">
                    Fin
                  </label>
                  <Input
                    id="evt-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-hidden sm:h-10"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="evt-details" className="block text-xs font-semibold text-foreground mb-1.5">
                Adresse & Détails de l'intervention
              </label>
              <textarea
                id="evt-details"
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Ex. 18 Rue de Bercy Paris 12e — Remplacement disjoncteur"
                className="w-full resize-none rounded-xl border border-border bg-surface p-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-hidden"
              />
            </div>

            <div className="safe-bottom flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                className="gap-1.5 font-semibold"
              >
                <Plus className="size-4" />
                {submitting ? 'Création…' : 'Planifier la mission'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

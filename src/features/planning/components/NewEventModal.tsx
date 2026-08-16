import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Calendar, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/feedback/FormError';
import { memberDisplayName } from '@/features/organizations';
import type { MissionPriority } from '@/types/database';
import type { MemberWithProfile } from '@/types/domain';

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
  assignedMemberId: string | null;
  notes: string;
}

interface NewEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: readonly MemberWithProfile[];
  submitting: boolean;
  error: unknown;
  onSubmit: (submission: NewEventSubmission) => void;
}

/** `2026-08-20` + `09:00` → instant ISO, en heure locale de qui saisit. */
function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function NewEventModal({
  open,
  onOpenChange,
  members,
  submitting,
  error,
  onSubmit,
}: NewEventModalProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<MissionPriority>('normal');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [memberId, setMemberId] = useState('');
  const [details, setDetails] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit({
      title: title.trim(),
      scheduledStart: toIso(date, startTime),
      ...(endTime !== '' ? { scheduledEnd: toIso(date, endTime) } : {}),
      priority,
      assignedMemberId: memberId === '' ? null : memberId,
      notes: details.trim(),
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs animate-in fade-in" />
        <Dialog.Content className="fixed top-[50%] left-[50%] z-50 max-h-[90vh] w-[95vw] max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-2xl bg-surface p-6 shadow-2xl border border-border overflow-y-auto animate-in zoom-in-95">
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
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
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
                className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:border-primary focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="evt-priority" className="block text-xs font-semibold text-foreground mb-1.5">
                  Priorité
                </label>
                <select
                  id="evt-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as MissionPriority)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:border-primary focus:outline-hidden"
                >
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>

              <div>
                <label htmlFor="evt-tech" className="block text-xs font-semibold text-foreground mb-1.5">
                  Intervenant assigné
                </label>
                <select
                  id="evt-tech"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:border-primary focus:outline-hidden"
                >
                  <option value="">À affecter plus tard</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {memberDisplayName(member)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="evt-date" className="block text-xs font-semibold text-foreground mb-1.5">
                  Date
                </label>
                <input
                  id="evt-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:border-primary focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="evt-start" className="block text-xs font-semibold text-foreground mb-1.5">
                    Début
                  </label>
                  <input
                    id="evt-start"
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label htmlFor="evt-end" className="block text-xs font-semibold text-foreground mb-1.5">
                    Fin
                  </label>
                  <input
                    id="evt-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:border-primary focus:outline-hidden"
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
                className="w-full p-2.5 rounded-xl border border-border bg-surface text-xs text-foreground focus:border-primary focus:outline-hidden resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
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

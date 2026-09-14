import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { useState } from 'react';
import { Calendar, Plus } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
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
  const [date, setDate] = useState(initialDate || (new Date().toISOString().split('T')[0] ?? ''));
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
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Planifier une mission"
      description="Cadrez l’intervention, son horaire et son affectation depuis le planning."
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="planning-event-form"
            variant="primary"
            isLoading={submitting}
            loadingLabel="Création de la mission"
            className="gap-1.5"
          >
            <Plus className="size-4" aria-hidden="true" />
            Planifier la mission
          </Button>
        </>
      }
    >
      <form id="planning-event-form" onSubmit={handleSubmit} className="space-y-5">
        <FormError error={error} />

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4 shadow-xs sm:p-5">
          <div className="flex items-start gap-3">
            <div className="border-primary/20 bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl border">
              <Calendar className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-foreground text-sm font-semibold">Mission</h3>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Donnez un intitulé précis et le niveau de priorité attendu.
              </p>
            </div>
          </div>

          <Input
            id="evt-title"
            label="Intitulé de l’intervention ou tâche"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Maintenance climatisation, raccordement…"
            autoComplete="off"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              id="evt-priority"
              label="Priorité"
              value={priority}
              onChange={(e) => setPriority(e.target.value as MissionPriority)}
            >
              <option value="low">Basse</option>
              <option value="normal">Normale</option>
              <option value="high">Haute</option>
              <option value="urgent">Urgente</option>
            </SelectField>

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
        </section>

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4 shadow-xs sm:p-5">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Créneau</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Fixez la date et les heures visibles par les équipes dans leur planning.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="evt-date"
              label="Date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                id="evt-start"
                label="Début"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <Input
                id="evt-end"
                label="Fin"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4 shadow-xs sm:p-5">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Consignes terrain</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Ajoutez l’adresse et les informations utiles à l’intervention.
            </p>
          </div>
          <Textarea
            id="evt-details"
            label="Adresse & détails de l’intervention"
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Ex. 18 rue de Bercy, Paris 12e — Remplacement du disjoncteur"
          />
        </section>
      </form>
    </Modal>
  );
}

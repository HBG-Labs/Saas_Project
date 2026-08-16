import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Calendar, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import type { PlanningCalendarEvent, CalendarEventType } from '../types';

interface NewEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddEvent: (event: PlanningCalendarEvent) => void;
}

const TECHNICIANS = [
  { id: 'tech-1', name: 'Aurélie B.', role: 'Frigoriste & Climatisation', initials: 'AB' },
  { id: 'tech-2', name: 'Thomas R.', role: 'Technicien Fibre & Réseaux', initials: 'TR' },
  { id: 'tech-3', name: 'Karim M.', role: 'Électricien Tertiaire', initials: 'KM' },
  { id: 'tech-4', name: 'Sophie L.', role: 'Plombière Chauffagiste', initials: 'SL' },
];

export function NewEventModal({ open, onOpenChange, onAddEvent }: NewEventModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CalendarEventType>('intervention');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [time, setTime] = useState('09:00 - 12:00');
  const [technicianId, setTechnicianId] = useState('tech-1');
  const [details, setDetails] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tech = TECHNICIANS.find((t) => t.id === technicianId);

    const newEvent: PlanningCalendarEvent = {
      id: `evt-${Date.now()}`,
      title: title.trim(),
      date,
      type,
      time,
      details: details.trim(),
      technicianId: tech?.id,
      technicianName: tech?.name,
      technicianInitials: tech?.initials,
      status: 'planifie',
      priority: 'medium',
    };

    onAddEvent(newEvent);
    onOpenChange(false);
    setTitle('');
    setDetails('');
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
                <label htmlFor="evt-type" className="block text-xs font-semibold text-foreground mb-1.5">
                  Type d'événement
                </label>
                <select
                  id="evt-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as CalendarEventType)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:border-primary focus:outline-hidden"
                >
                  <option value="intervention">Intervention / Chantier</option>
                  <option value="recurring_task">Tâche récurrente</option>
                  <option value="leave">Congé / Absence</option>
                  <option value="holiday">Jour férié</option>
                </select>
              </div>

              <div>
                <label htmlFor="evt-tech" className="block text-xs font-semibold text-foreground mb-1.5">
                  Intervenant assigné
                </label>
                <select
                  id="evt-tech"
                  value={technicianId}
                  onChange={(e) => setTechnicianId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:border-primary focus:outline-hidden"
                >
                  {TECHNICIANS.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name}
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

              <div>
                <label htmlFor="evt-time" className="block text-xs font-semibold text-foreground mb-1.5">
                  Créneau horaire
                </label>
                <input
                  id="evt-time"
                  type="text"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="Ex. 09:00 - 12:00"
                  className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:border-primary focus:outline-hidden"
                />
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
              <Button type="submit" variant="primary" className="gap-1.5 font-semibold">
                <Plus className="size-4" />
                Planifier l'événement
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

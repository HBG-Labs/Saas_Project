import { Clock, MapPin, User, Calendar, AlarmClock } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import type { RecurringTask } from '../types';

interface RecurringTasksTabProps {
  tasks: RecurringTask[];
}

/** Nombre d'échéances qui tombent dans les trente prochains jours. */
function countDueSoon(tasks: readonly RecurringTask[]): number {
  const horizon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  return tasks.filter((task) => task.nextDate >= today && task.nextDate <= horizon).length;
}

export function RecurringTasksTab({ tasks }: RecurringTasksTabProps) {
  const dueSoon = countDueSoon(tasks);

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'weekly':
        return 'Hebdomadaire';
      case 'monthly':
        return 'Mensuel';
      case 'quarterly':
        return 'Trimestriel';
      case 'bi_annual':
        return 'Semestriel';
      case 'yearly':
        return 'Annuel';
      default:
        return freq;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-border shadow-xs">
        <div>
          <h3 className="text-sm font-extrabold text-foreground">
            Contrats de Maintenance & Tâches Récurrentes
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatisation des visites périodiques et des rappels clients avant échéance
          </p>
        </div>

        {/* Une information mesurée sur les données affichées, et non une action
            qui prétendrait envoyer des rappels : aucun service de notification
            n'est branché, et l'annoncer serait mentir à l'utilisateur. */}
        {dueSoon > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg shrink-0">
            <AlarmClock className="size-3.5" />
            {dueSoon} échéance{dueSoon > 1 ? 's' : ''} sous 30 jours
          </span>
        )}
      </div>

      {tasks.length === 0 && (
        <p className="text-xs text-muted-foreground bg-surface border border-border rounded-2xl p-6 text-center">
          Aucun contrat de maintenance enregistré. Les visites périodiques ajoutées ici
          rappelleront leur prochaine échéance.
        </p>
      )}

      {/* Grid of Recurring Tasks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="p-4 rounded-2xl bg-surface border border-border shadow-xs hover:border-border-strong transition-all space-y-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <Badge variant="primary" className="text-3xs font-mono mb-1">
                  {getFrequencyLabel(task.frequency)}
                </Badge>
                <h4 className="text-xs font-bold text-foreground">{task.title}</h4>
              </div>
              <span className="text-xs font-bold text-primary flex items-center gap-1 shrink-0 bg-primary/10 px-2 py-0.5 rounded-md">
                <Calendar className="size-3" />
                {task.nextDate}
              </span>
            </div>

            <div className="text-xs space-y-1 text-muted-foreground pt-1 border-t border-border/60">
              <p className="font-semibold text-foreground">{task.clientName}</p>
              <p className="text-3xs flex items-center gap-1 truncate">
                <MapPin className="size-2.5 shrink-0" />
                {task.clientAddress}
              </p>
              <div className="flex items-center justify-between text-3xs pt-1">
                <span className="flex items-center gap-1 font-semibold text-primary">
                  <User className="size-2.5" />
                  {task.technicianName}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-2.5" />
                  Durée : {task.estimatedDuration}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Clock, MapPin, User, Calendar, AlarmClock } from 'lucide-react';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
import { EmptyState } from '@/components/feedback/EmptyState';
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
      <div className="bg-surface border-border flex flex-col justify-between gap-3 rounded-2xl border p-4 shadow-xs sm:flex-row sm:items-center">
        <div>
          <h3 className="text-foreground text-sm font-extrabold">
            Contrats de Maintenance & Tâches Récurrentes
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Automatisation des visites périodiques et des rappels clients avant échéance
          </p>
        </div>

        {/* Une information mesurée sur les données affichées, et non une action
            qui prétendrait envoyer des rappels : aucun service de notification
            n'est branché, et l'annoncer serait mentir à l'utilisateur. */}
        {dueSoon > 0 && (
          <span className="text-primary bg-primary/10 flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold">
            <AlarmClock className="size-3.5" />
            {dueSoon} échéance{dueSoon > 1 ? 's' : ''} sous 30 jours
          </span>
        )}
      </div>

      {tasks.length === 0 && (
        <EmptyState
          illustration={<AtelierIllustration subject="history" className="w-44" />}
          title="Aucun contrat de maintenance"
          description="Les visites périodiques ajoutées ici rappelleront leur prochaine échéance."
          size="sm"
        />
      )}

      {/* Grid of Recurring Tasks */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="bg-surface border-border hover:border-border-strong space-y-2.5 rounded-2xl border p-4 shadow-xs transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <Badge variant="primary" className="text-3xs mb-1 font-mono">
                  {getFrequencyLabel(task.frequency)}
                </Badge>
                <h4 className="text-foreground text-xs font-bold">{task.title}</h4>
              </div>
              <span className="text-primary bg-primary/10 flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold">
                <Calendar className="size-3" />
                {task.nextDate}
              </span>
            </div>

            <div className="text-muted-foreground border-border/60 space-y-1 border-t pt-1 text-xs">
              <p className="text-foreground font-semibold">{task.clientName}</p>
              <p className="text-3xs flex items-center gap-1 truncate">
                <MapPin className="size-2.5 shrink-0" />
                {task.clientAddress}
              </p>
              <div className="text-3xs flex items-center justify-between pt-1">
                <span className="text-primary flex items-center gap-1 font-semibold">
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

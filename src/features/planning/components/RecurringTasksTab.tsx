import { useState } from 'react';
import {
  RotateCcw,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { RecurringTask } from '../types';

interface RecurringTasksTabProps {
  tasks: RecurringTask[];
  onTriggerReminders: () => void;
}

export function RecurringTasksTab({ tasks, onTriggerReminders }: RecurringTasksTabProps) {
  const [remindersSent, setRemindersSent] = useState(false);

  const handleReminders = () => {
    onTriggerReminders();
    setRemindersSent(true);
    setTimeout(() => setRemindersSent(false), 3500);
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'weekly':
        return 'Hebdomadaire';
      case 'monthly':
        return 'Mensuel';
      case 'quarterly':
        return 'Trimestriel';
      case 'bi-annual':
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

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReminders}
            className="text-xs h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
          >
            <RotateCcw className="size-3.5" />
            <span>Traiter les rappels J-4</span>
          </Button>
        </div>
      </div>

      {remindersSent && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>
            Rappels automatiques traités : 3 SMS et e-mails de confirmation envoyés aux clients.
          </span>
        </div>
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

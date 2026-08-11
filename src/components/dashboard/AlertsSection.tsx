import { AlertTriangle } from 'lucide-react';

export interface AlertItem {
  id: string;
  title: string;
  type: 'warning' | 'urgent' | 'info';
  count: number;
}

const DEFAULT_ALERTS: AlertItem[] = [
  { id: 'a1', title: "Rapports d'intervention à compléter", type: 'warning', count: 2 },
  { id: 'a2', title: 'Intervention urgente non assignée', type: 'urgent', count: 1 },
  { id: 'a3', title: 'Retard estimé (+15m) - Interv. INT-8902', type: 'warning', count: 1 },
  { id: 'a4', title: 'Validations de documents requises', type: 'info', count: 3 },
];

export function AlertsSection({ alerts = DEFAULT_ALERTS }: { alerts?: AlertItem[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 backdrop-blur-xs sm:p-5 dark:border-amber-500/20 dark:bg-amber-500/10">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
            À surveiller aujourd&apos;hui
          </h2>
        </div>
        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
          {alerts.length} éléments requièrent une attention
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-white p-3 shadow-2xs transition-colors hover:border-amber-300 dark:border-amber-900/30 dark:bg-slate-900"
          >
            <span className="line-clamp-1 text-xs font-medium text-slate-700 dark:text-slate-300">
              {alert.title}
            </span>
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                alert.type === 'urgent'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              {alert.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Activity, BarChart3, CheckCircle, Clock } from 'lucide-react';
import { useState } from 'react';

export function AnalyticsSection() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');

  const domainDistribution = [
    { name: 'Fibre optique', percentage: 38, count: 42, color: 'bg-blue-500' },
    { name: 'Télécoms', percentage: 22, count: 24, color: 'bg-indigo-500' },
    { name: 'Électricité', percentage: 16, count: 18, color: 'bg-amber-500' },
    { name: 'Réseaux & IT', percentage: 12, count: 13, color: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-6">
      {/* ------------------- GRAPHIQUE ACTIVITÉ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <Activity className="size-5 text-indigo-600 dark:text-indigo-400" />
            Activité des interventions
          </h2>

          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setTimeRange('7d')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold shadow-2xs transition-all cursor-pointer ${
                timeRange === '7d'
                  ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              7 jours
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('30d')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold shadow-2xs transition-all cursor-pointer ${
                timeRange === '30d'
                  ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              30 jours
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs text-slate-500 dark:border-slate-800">
            <div>
              <span className="text-muted-foreground">Total terminées : </span>
              <span className="font-bold text-slate-900 dark:text-white">42</span>
            </div>
            <div>
              <span className="text-muted-foreground">En attente : </span>
              <span className="font-bold text-slate-900 dark:text-white">8</span>
            </div>
          </div>

          <div className="h-44 w-full pt-2">
            <svg className="size-full overflow-visible" viewBox="0 0 300 120">
              <defs>
                <linearGradient id="gradientAreaDashboardAnalytics" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <line
                x1="0"
                y1="30"
                x2="300"
                y2="30"
                stroke="currentColor"
                className="text-slate-100 dark:text-slate-800/60"
                strokeDasharray="4"
              />
              <line
                x1="0"
                y1="70"
                x2="300"
                y2="70"
                stroke="currentColor"
                className="text-slate-100 dark:text-slate-800/60"
                strokeDasharray="4"
              />
              <line
                x1="0"
                y1="110"
                x2="300"
                y2="110"
                stroke="currentColor"
                className="text-slate-100 dark:text-slate-800/60"
                strokeDasharray="4"
              />

              <path
                d="M 0,110 L 0,80 Q 50,40 100,65 T 200,30 T 300,50 L 300,110 Z"
                fill="url(#gradientAreaDashboardAnalytics)"
              />

              <path
                d="M 0,80 Q 50,40 100,65 T 200,30 T 300,50"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeLinecap="round"
              />

              <circle
                cx="0"
                cy="80"
                r="4"
                className="fill-blue-600 stroke-white dark:fill-blue-400 dark:stroke-slate-900"
                strokeWidth="2"
              />
              <circle
                cx="100"
                cy="65"
                r="4"
                className="fill-blue-600 stroke-white dark:fill-blue-400 dark:stroke-slate-900"
                strokeWidth="2"
              />
              <circle
                cx="200"
                cy="30"
                r="4"
                className="fill-blue-600 stroke-white dark:fill-blue-400 dark:stroke-slate-900"
                strokeWidth="2"
              />
              <circle
                cx="300"
                cy="50"
                r="4"
                className="fill-blue-600 stroke-white dark:fill-blue-400 dark:stroke-slate-900"
                strokeWidth="2"
              />
            </svg>

            <div className="mt-2 flex justify-between text-[10px] font-medium text-muted-foreground">
              <span>Lun</span>
              <span>Mar</span>
              <span>Mer</span>
              <span>Jeu</span>
              <span>Ven</span>
              <span>Sam</span>
              <span>Dim</span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------- PERFORMANCE & RÉPARTITION */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Performance */}
        <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
            <CheckCircle className="size-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Performance globale
            </h3>
          </div>
          <div className="space-y-2 pt-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Interventions terminées</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">94.2%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Interventions en retard</span>
              <span className="font-mono font-bold text-rose-500">1.8%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <Clock className="size-3" /> Temps moyen
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">1h 45m</span>
            </div>
          </div>
        </div>

        {/* Répartition par domaine */}
        <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
            <BarChart3 className="size-4 text-indigo-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Répartition par domaine
            </h3>
          </div>
          <div className="space-y-2 pt-1">
            {domainDistribution.slice(0, 3).map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-300">{item.name}</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {item.percentage}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

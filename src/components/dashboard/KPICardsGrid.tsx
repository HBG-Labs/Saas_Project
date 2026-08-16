import { Briefcase, FileCheck2, Users, Wrench } from 'lucide-react';

interface KPICardsGridProps {
  missionsCount?: string;
  interventionsToday?: string;
  activeTechs?: string;
  pendingReports?: string;
}

export function KPICardsGrid({
  missionsCount = '24',
  interventionsToday = '18',
  activeTechs = '14/16',
  pendingReports = '5',
}: KPICardsGridProps) {
  const kpis = [
    {
      id: 'kpi-missions',
      title: 'Missions en cours',
      value: missionsCount,
      change: '+12%',
      subtitle: 'vs semaine dernière',
      icon: Briefcase,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-200/50 dark:border-blue-800/30',
    },
    {
      id: 'kpi-interventions',
      title: "Interventions aujourd'hui",
      value: interventionsToday,
      change: '8 terminées',
      subtitle: '56% de complétion',
      icon: Wrench,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200/50 dark:border-emerald-800/30',
    },
    {
      id: 'kpi-techs',
      title: 'Techniciens actifs',
      value: activeTechs,
      change: '87.5%',
      subtitle: "Taux d'engagement",
      icon: Users,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/40',
      border: 'border-violet-200/50 dark:border-violet-800/30',
    },
    {
      id: 'kpi-reports',
      title: 'Rapports à compléter',
      value: pendingReports,
      change: '-2',
      subtitle: '3 urgents en attente',
      icon: FileCheck2,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200/50 dark:border-amber-800/30',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
      {kpis.map((kpi) => {
        const IconComponent = kpi.icon;
        return (
          <div
            key={kpi.id}
            className={`group relative flex flex-col justify-between rounded-2xl border ${kpi.border} bg-surface p-5 sm:p-6 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md min-h-[152px]`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {kpi.title}
                </span>
                <div className={`flex size-10 items-center justify-center rounded-xl p-2.5 ${kpi.bg} border border-border/40`}>
                  <IconComponent className={`size-5 ${kpi.color}`} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                  {kpi.value}
                </span>
              </div>
            </div>

            <div className="mt-auto pt-3 flex items-center justify-between border-t border-border/60 text-xs">
              <span className="font-medium text-muted-foreground">
                {kpi.subtitle}
              </span>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {kpi.change}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

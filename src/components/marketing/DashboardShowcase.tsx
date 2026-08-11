import { Activity, AlertTriangle, CheckCircle2, ShieldCheck, Users } from 'lucide-react';

export function DashboardShowcase() {
  return (
    <section className="border-y border-slate-200/80 bg-white py-20 dark:border-slate-800/80 dark:bg-slate-950 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Une vision claire de votre activité
          </h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Le cockpit conçu pour décider rapidement
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-400">
            Visualisez en un coup d&apos;œil vos missions, vos interventions, votre équipe et les éléments nécessitant votre attention.
          </p>
        </div>

        {/* 3 Points forts visuels */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex items-start gap-4 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Activity className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Suivi en direct</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Statuts des interventions actualisés sur le terrain et au bureau.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Alertes préventives</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Détectez immédiatement les retards ou rapports en attente.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Users className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Équipe terrain</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Affectez les bons techniciens aux bonnes missions.
              </p>
            </div>
          </div>
        </div>

        {/* Grand Mockup Visuel du Dashboard */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl dark:border-slate-800/80 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4 flex items-center justify-between dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Dashboard Cockpit NexoraTech
              </span>
            </div>
            <span className="text-2xs font-mono font-medium text-slate-400">
              Interface Responsable & Chef d&apos;Entreprise
            </span>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  Tableau de bord activité global
                </h4>
                <p className="text-xs text-slate-500">14 techniciens actifs sur 5 sites clients</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                18 Interventions programmées
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <span className="text-2xs font-bold uppercase text-slate-400">Taux de complétion</span>
                <div className="mt-2 text-2xl font-black font-mono text-slate-900 dark:text-white">94.2%</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <span className="text-2xs font-bold uppercase text-slate-400">Marge de sécurité optique</span>
                <div className="mt-2 text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">+3.18 dB</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <span className="text-2xs font-bold uppercase text-slate-400">Temps moyen d&apos;intervention</span>
                <div className="mt-2 text-2xl font-black font-mono text-slate-900 dark:text-white">1h 45m</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

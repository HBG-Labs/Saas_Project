import { Briefcase, Calendar, Contact, FileCheck2, Users, Wrench } from 'lucide-react';

export function Features() {
  const features = [
    {
      title: 'Missions',
      description: 'Organisez, attribuez et suivez vos missions d’entreprise en temps réel.',
      icon: Briefcase,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-200/50 dark:border-blue-800/30',
    },
    {
      title: 'Interventions',
      description: 'Planifiez et pilotez les interventions techniques avec statuts en direct.',
      icon: Wrench,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200/50 dark:border-emerald-800/30',
    },
    {
      title: 'Équipes',
      description: 'Suivez vos techniciens sur le terrain, leurs rôles et disponibilités.',
      icon: Users,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/40',
      border: 'border-violet-200/50 dark:border-violet-800/30',
    },
    {
      title: 'Clients',
      description: 'Centralisez les fiches clients, contacts, sites et références d’accès.',
      icon: Contact,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      border: 'border-indigo-200/50 dark:border-indigo-800/30',
    },
    {
      title: 'Rapports',
      description: 'Créez et gagnez du temps sur la génération et validation de rapports.',
      icon: FileCheck2,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200/50 dark:border-amber-800/30',
    },
    {
      title: 'Planning',
      description: 'Visualisez l’ensemble de votre activité technique jour par jour.',
      icon: Calendar,
      color: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-50 dark:bg-sky-950/40',
      border: 'border-sky-200/50 dark:border-sky-800/30',
    },
  ];

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Tout au même endroit
          </h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Un espace unique pour piloter votre activité technique
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-400">
            Fini les applications dispersées. Retrouvez toutes les fonctions essentielles dans une interface SaaS unifiée.
          </p>
        </div>

        {/* 6 Cartes dans le style exact du Dashboard */}
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item) => {
            const IconComponent = item.icon;
            return (
              <div
                key={item.title}
                className={`group relative flex flex-col justify-between rounded-2xl border ${item.border} bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md dark:bg-slate-900/90`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </span>
                    <div className={`rounded-xl p-3 ${item.bg}`}>
                      <IconComponent className={`size-6 ${item.color}`} />
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import { BarChart3, Clock4, Eye, Sparkles } from 'lucide-react';

export function Benefits() {
  const benefits = [
    {
      title: 'Gagnez du temps',
      description: 'Centralisez toute votre activité technique et vos documents dans un seul espace.',
      icon: Clock4,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-200/50 dark:border-blue-800/30',
    },
    {
      title: 'Travaillez mieux',
      description: 'Donnez à vos équipes sur le terrain les bons outils de calcul et d’intervention.',
      icon: Sparkles,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200/50 dark:border-emerald-800/30',
    },
    {
      title: 'Gardez le contrôle',
      description: 'Suivez le déroulement de vos missions et le statut de chaque intervention.',
      icon: Eye,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/40',
      border: 'border-violet-200/50 dark:border-violet-800/30',
    },
    {
      title: 'Prenez de meilleures décisions',
      description: 'Visualisez vos données de performance et vos statistiques en temps réel.',
      icon: BarChart3,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200/50 dark:border-amber-800/30',
    },
  ];

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Les Bénéfices NexoraTech
          </h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Pourquoi choisir NexoraTech pour votre entreprise ?
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => {
            const IconComponent = b.icon;
            return (
              <div
                key={b.title}
                className={`rounded-2xl border ${b.border} bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md dark:bg-slate-900/90`}
              >
                <div className={`inline-flex rounded-xl p-3 ${b.bg}`}>
                  <IconComponent className={`size-6 ${b.color}`} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                  {b.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {b.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

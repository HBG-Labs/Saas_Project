import { Cable, Cpu, Network, Wrench, Zap } from 'lucide-react';

export function BuiltForTech() {
  const domains = [
    { name: 'Réseaux & IT', icon: Cpu, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    { name: 'Électricité', icon: Zap, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    { name: 'Télécoms', icon: Network, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
    { name: 'Fibre optique', icon: Cable, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
    { name: 'Outils généraux', icon: Wrench, color: 'text-slate-500 bg-slate-500/10 border-slate-500/20' },
  ];

  return (
    <section className="border-y border-slate-200/80 bg-white py-10 dark:border-slate-800/80 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Pensé pour les professionnels de terrain et les entreprises techniques
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {domains.map((item) => {
            const IconComponent = item.icon;
            return (
              <div
                key={item.name}
                className={`flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-xs font-bold shadow-2xs transition-all hover:scale-105 ${item.color}`}
              >
                <IconComponent className="size-4 shrink-0" />
                <span>{item.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

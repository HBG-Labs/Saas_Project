import { CheckCircle2, FlaskConical, Ruler, ShieldCheck } from 'lucide-react';

const GARANTIES = [
  {
    id: 'normes',
    icon: Ruler,
    title: 'Des formules mathématiques et physiques certifiées',
    body: 'Trigonométrie, conversions du Système International (SI), géométrie euclidienne, puissances et pression. Chaque outil cite la formule appliquée et détaille les équivalences d’unités.',
  },
  {
    id: 'tests',
    icon: FlaskConical,
    title: 'Vérifiés par plus de 100 tests continus',
    body: 'Les calculateurs et algorithmes de la plateforme sont couverts par des suites de tests automatisés rejouées à chaque version. Aucune régression de calcul n’est tolérée.',
  },
  {
    id: 'donnees',
    icon: ShieldCheck,
    title: 'Vos données restent strictement les vôtres',
    body: 'Chaque organisation est isolée au niveau de la base par des politiques PostgreSQL (Row Level Security). Vos chantiers, stocks, clients et devis sont étanches et sécurisés.',
  },
];

export function Testimonials() {
  return (
    <section className="py-20 sm:py-28 bg-transparent text-white">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-6">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
            Ce sur quoi vous pouvez compter
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
            Calculateurs certifiés d’ingénierie, et la manière dont ils sont tenus
          </h2>
          <p className="mx-auto max-w-2xl text-xs sm:text-sm text-slate-400">
            REZO360 est un produit conçu pour les exigences réelles du terrain. Plutôt que des promesses marketing, voici ce qui se vérifie.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:mt-14 sm:gap-6 md:grid-cols-3">
          {GARANTIES.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.id}
                className="border-white/10 bg-transparent flex min-w-0 flex-col gap-3 rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-500/40 sm:p-6"
              >
                <div className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 flex size-10 items-center justify-center rounded-xl border">
                  <Icon className="size-5" aria-hidden="true" />
                </div>

                <h3 className="text-white text-sm sm:text-base font-bold">{item.title}</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{item.body}</p>
              </div>
            );
          })}
        </div>

        <p className="text-slate-400 mt-8 flex items-center justify-center gap-1.5 text-center text-xs">
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
          Aucun faux avis sur cette page : des garanties techniques concrètes et vérifiables.
        </p>
      </div>
    </section>
  );
}

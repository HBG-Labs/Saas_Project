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
    <section className="py-20 sm:py-28 bg-surface-sunken/30 border-y border-border/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Ce sur quoi vous pouvez compter
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Treize calculateurs d’ingénierie, et la manière dont ils sont tenus
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            REZO360 est un produit conçu pour les exigences réelles du terrain. Plutôt que des promesses marketing, voici ce qui se vérifie.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:mt-14 sm:gap-6 md:grid-cols-3">
          {GARANTIES.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.id}
                className="border-border/80 bg-surface flex min-w-0 flex-col gap-3 rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md sm:p-6"
              >
                <div className="bg-primary/10 text-primary border-primary/20 flex size-10 items-center justify-center rounded-xl border">
                  <Icon className="size-5" aria-hidden="true" />
                </div>

                <h3 className="text-foreground text-base font-bold">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
              </div>
            );
          })}
        </div>

        <p className="text-subtle-foreground mt-8 flex items-center justify-center gap-1.5 text-center text-xs">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
          Aucun faux avis sur cette page : des garanties techniques concrètes et vérifiables.
        </p>
      </div>
    </section>
  );
}

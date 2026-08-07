import { ShieldCheck, Zap, Smartphone, Layers, Clock, Award } from 'lucide-react';

const HIGHLIGHTS = [
  {
    icon: Zap,
    title: 'Exécution Instantanée',
    description: 'Résultats calculés en temps réel lors de la saisie des paramètres, sans latence ni rechargement.',
  },
  {
    icon: ShieldCheck,
    title: 'Formules Certifiées UTE & ITU',
    description: 'Chaque algorithme est validé selon les normes internationales pour vos bilans de liaison et de puissance.',
  },
  {
    icon: Smartphone,
    title: 'Optimisé pour le Terrain',
    description: 'Interface responsive tactile conçue pour être manipulée facilement sur smartphone ou tablette.',
  },
  {
    icon: Layers,
    title: 'Architecture Modulaire',
    description: 'Moteur dynamique évolutif s’enrichissant constamment de nouveaux outils sans surcharger l’application.',
  },
  {
    icon: Clock,
    title: 'Historique & Traçabilité',
    description: 'Retrouvez l’intégralité de vos calculs passés pour vos dossiers d’ingénierie et de recette.',
  },
  {
    icon: Award,
    title: 'Mode Sombre & Ergonomie',
    description: 'Confort visuel préservé lors des interventions en baie de brassage ou en sous-sol éclairé.',
  },
] as const;

export function BuiltForTech() {
  return (
    <section className="relative border-t border-border/60 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="text-primary text-xs font-semibold uppercase tracking-wider">
            Ingénierie & Fiabilité
          </span>
          <h2 className="text-foreground mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Conçu pour les exigences du terrain & du bureau d&apos;études
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base">
            Chaque fonctionnalité répond directement aux contraintes quotidiennes des techniciens et ingénieurs.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-surface border-border/60 hover:border-primary/40 hover:shadow-raised group rounded-xl border p-6 transition-all duration-200"
              >
                <div className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex size-10 items-center justify-center rounded-lg transition-colors">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h3 className="text-foreground mt-4 text-base font-semibold">{item.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

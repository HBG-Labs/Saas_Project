import { Check } from 'lucide-react';

const AUDIENCES = [
  {
    role: 'Techniciens fibre et réseaux',
    benefits: [
      'Bilans de liaison optique sur le terrain',
      'Codes couleur normalisés toujours sous la main',
      'Découpage de sous-réseaux sans calcul mental',
    ],
  },
  {
    role: 'Ingénieurs et bureaux d’études',
    benefits: [
      'Résultats précis et reproductibles',
      'Historique des calculs pour vos dossiers',
      'Conversions d’unités sans erreur de facteur',
    ],
  },
  {
    role: 'Étudiants et formateurs',
    benefits: [
      'Comprendre le calcul, pas seulement le résultat',
      'Références techniques rassemblées au même endroit',
      'Accès gratuit aux outils de base',
    ],
  },
] as const;

export function Benefits() {
  return (
    <section className="bg-surface-sunken border-border border-y px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">Pour qui</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Un outil, trois métiers
          </h2>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {AUDIENCES.map((audience) => (
            <div key={audience.role}>
              <h3 className="text-base font-semibold">{audience.role}</h3>
              <ul className="mt-4 space-y-2.5">
                {audience.benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-2.5 text-sm">
                    <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span className="text-muted-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

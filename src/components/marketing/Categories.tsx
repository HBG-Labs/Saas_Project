import { ArrowLeftRight, ArrowRight, Box, Calculator, Percent, TrendingUp, Zap } from 'lucide-react';
import { Link } from 'react-router';

import { ROUTES } from '@/config/routes';

export function Categories() {
  const toolClusters = [
    {
      name: 'Calcul Scientifique & Ingénierie',
      count: 'Calculatrice d’ingénierie',
      description: 'Trigonométrie (deg/rad), puissances, logarithmes (ln/log), racines carrées, factorielle et mémoire.',
      icon: Calculator,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-200/50 dark:border-blue-800/30',
      to: `${ROUTES.tools}/scientific-calculator`,
    },
    {
      name: 'Conversions Universelles',
      count: '10 grandeurs physiques',
      description: 'Longueurs, surfaces, volumes, masses, températures, pressions, vitesses, débits, énergie et puissances.',
      icon: ArrowLeftRight,
      color: 'text-cyan-600 dark:text-cyan-400',
      bg: 'bg-cyan-50 dark:bg-cyan-950/40',
      border: 'border-cyan-200/50 dark:border-cyan-800/30',
      to: `${ROUTES.tools}/unit-converter`,
    },
    {
      name: 'Géométrie, Espaces & Volumes',
      count: '3 calculateurs dédiés',
      description: 'Distances euclidiennes 2D, surfaces géométriques (m², hectares) et cubages (m³, litres, cuves et cylindres).',
      icon: Box,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200/50 dark:border-emerald-800/30',
      to: `${ROUTES.tools}/surface-calculator`,
    },
    {
      name: 'Terrain, Pentes & Logistique',
      count: 'Pentes, Dénivelés & Masses',
      description: 'Pentes en %, angles en degrés, dénivelés, rampes d’accès et calculs de charge/poids pour le transport.',
      icon: TrendingUp,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200/50 dark:border-amber-800/30',
      to: `${ROUTES.tools}/slope-calculator`,
    },
    {
      name: 'Énergie, Fluides & Pression',
      count: 'Puissance, Pression, Débit',
      description: 'Conversions de puissance (W, kW, kVA), réseaux sous pression (bar, PSI, kPa) et débits de pompage/vidange.',
      icon: Zap,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      border: 'border-purple-200/50 dark:border-purple-800/30',
      to: `${ROUTES.tools}/power-calculator`,
    },
    {
      name: 'Gestion, Ratios & Temps',
      count: 'Temps, Ratios & Pourcentages',
      description: 'Durées de travail, heures décimales, règles de trois directes, remises, TVA et calculs de proportionnalité.',
      icon: Percent,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200/50 dark:border-rose-800/30',
      to: `${ROUTES.tools}/percentage-calculator`,
    },
  ];

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Boîte à outils d’ingénierie &amp; calcul
          </h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            13 calculateurs certifiés, toujours à portée de main
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-400">
            Une suite d’ingénierie universelle et rigoureuse pour tous les techniciens et ingénieurs de terrain,
            accessible en ligne comme hors-connexion.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {toolClusters.map((cluster) => {
            const IconComponent = cluster.icon;
            return (
              <Link
                key={cluster.name}
                to={cluster.to}
                className={`group relative flex flex-col justify-between rounded-2xl border ${cluster.border} bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md dark:bg-slate-900/90`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={`rounded-xl p-3 ${cluster.bg}`}>
                      <IconComponent className={`size-6 ${cluster.color}`} />
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {cluster.count}
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-bold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                    {cluster.name}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {cluster.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                  <span>Accéder à l’outil</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link
            to={ROUTES.tools}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 transition-all shadow-xs"
          >
            <span>Voir tous les 13 outils du catalogue</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

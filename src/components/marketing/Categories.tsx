import { ArrowRight, Cable, Cpu, Network, Wrench, Zap } from 'lucide-react';
import { Link } from 'react-router';

import { ROUTES } from '@/config/routes';

export function Categories() {
  const categories = [
    {
      name: 'Réseaux & IT',
      count: '5 calculatrices certifiées',
      description: 'Calculateur IPv4/CIDR, Convertisseur IP Binaire, Calculateur VLAN, Débit Réseau et PoE.',
      icon: Cpu,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200/50 dark:border-emerald-800/30',
      to: `${ROUTES.tools}?category=networking`,
    },
    {
      name: 'Électricité',
      count: '10 calculatrices',
      description: 'Sections de câble UTE C 15-105, chute de tension, cos φ et triphasé.',
      icon: Zap,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200/50 dark:border-amber-800/30',
      to: `${ROUTES.tools}?category=electrical`,
    },
    {
      name: 'Télécoms',
      count: '7 calculatrices & repérages',
      description: 'Code couleur câbles cuivre télécom (8 à 112 paires), bilans de liaison radio, affaiblissement et antennes.',
      icon: Network,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      border: 'border-indigo-200/50 dark:border-indigo-800/30',
      to: `${ROUTES.tools}?category=telecom`,
    },
    {
      name: 'Fibre optique',
      count: '8 calculatrices',
      description: 'Atténuation linéique, bilans de liaison FTTH, réflectométrie et épissures.',
      icon: Cable,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-200/50 dark:border-blue-800/30',
      to: `${ROUTES.tools}?category=fiber-optics`,
    },
    {
      name: 'Outils généraux',
      count: 'Calculatrices & Convertisseurs',
      description: 'Deux sous-catégories dédiées : calculatrices scientifiques d’ingénierie et convertisseurs d’unités.',
      icon: Wrench,
      color: 'text-slate-600 dark:text-slate-300',
      bg: 'bg-slate-100 dark:bg-slate-800/40',
      border: 'border-slate-200/50 dark:border-slate-700/30',
      to: `${ROUTES.tools}?category=general`,
    },
  ];

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Boîte à outils numérique
          </h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Vos outils techniques, toujours à portée de main
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-400">
            Une suite complète de calculatrices certifiées et de tables professionnelles utilisables sur le terrain comme au bureau.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {categories.map((cat) => {
            const IconComponent = cat.icon;
            return (
              <Link
                key={cat.name}
                to={cat.to}
                className={`group relative flex flex-col justify-between rounded-2xl border ${cat.border} bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md dark:bg-slate-900/90`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={`rounded-xl p-3 ${cat.bg}`}>
                      <IconComponent className={`size-6 ${cat.color}`} />
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {cat.count}
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-bold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                    {cat.name}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {cat.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                  <span>Accéder aux outils</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

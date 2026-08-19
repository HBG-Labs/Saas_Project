import {
  Bug,
  Cable,
  Cpu,
  Droplet,
  Flame,
  ShieldCheck,
  Snowflake,
  Sparkles,
  SunMedium,
  Trees,
  Wrench,
  Zap,
} from 'lucide-react';

const ROW_1_SECTORS = [
  {
    name: 'Fibre Optique & Télécoms',
    sub: 'Réseaux FTTH & Infrastructures télécom',
    icon: Cable,
    color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20 dark:text-cyan-400 dark:bg-cyan-950/50 dark:border-cyan-500/30',
  },
  {
    name: 'Électricité & Courants Faibles',
    sub: 'Basse tension, Tertiaire & Domotique',
    icon: Zap,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-500/30',
  },
  {
    name: 'Froid & Climatisation (CVC)',
    sub: 'Génie frigorifique & Traitement d’air',
    icon: Snowflake,
    color: 'text-rose-500 bg-rose-500/10 border-rose-500/20 dark:text-rose-400 dark:bg-rose-950/50 dark:border-rose-500/30',
  },
  {
    name: 'Plomberie & Sanitaire',
    sub: 'Réseaux d’eau, Canalisations & Sanitaire',
    icon: Droplet,
    color: 'text-sky-500 bg-sky-500/10 border-sky-500/20 dark:text-sky-400 dark:bg-sky-950/50 dark:border-sky-500/30',
  },
  {
    name: 'Chauffage & Génie Thermique',
    sub: 'Chaudières, Pompes à chaleur & Énergie',
    icon: Flame,
    color: 'text-orange-500 bg-orange-500/10 border-orange-500/20 dark:text-orange-400 dark:bg-orange-950/50 dark:border-orange-500/30',
  },
  {
    name: 'Réseaux Informatiques & IT',
    sub: 'Infrastructures VDI, Baies & Systèmes IP',
    icon: Cpu,
    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20 dark:text-indigo-400 dark:bg-indigo-950/50 dark:border-indigo-500/30',
  },
];

const ROW_2_SECTORS = [
  {
    name: 'Énergies Renouvelables & IRVE',
    sub: 'Solaire photovoltaïque & Bornes de recharge',
    icon: SunMedium,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-500/30',
  },
  {
    name: 'Sécurité Électronique & Alarme',
    sub: 'Vidéosurveillance, Alarmes & Contrôle d’accès',
    icon: ShieldCheck,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-500/30',
  },
  {
    name: 'Paysage & Espaces Verts',
    sub: 'Création paysagère & Aménagement extérieur',
    icon: Trees,
    color: 'text-green-500 bg-green-500/10 border-green-500/20 dark:text-green-400 dark:bg-green-950/50 dark:border-green-500/30',
  },
  {
    name: 'Propreté & Nettoyage Industriel',
    sub: 'Entretien de locaux, Tertiaire & Hygiène',
    icon: Sparkles,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/20 dark:text-purple-400 dark:bg-purple-950/50 dark:border-purple-500/30',
  },
  {
    name: 'Hygiène 3D & Anti-Nuisibles',
    sub: 'Dératisation, Désinsectisation & Prévention',
    icon: Bug,
    color: 'text-rose-500 bg-rose-500/10 border-rose-500/20 dark:text-rose-400 dark:bg-rose-950/50 dark:border-rose-500/30',
  },
  {
    name: 'Maintenance Multi-Technique',
    sub: 'Maintenance de bâtiments & Installations',
    icon: Wrench,
    color: 'text-violet-500 bg-violet-500/10 border-violet-500/20 dark:text-violet-400 dark:bg-violet-950/50 dark:border-violet-500/30',
  },
];

export function BuiltForTech() {
  return (
    <section className="relative overflow-hidden border-y border-slate-200/80 bg-slate-50/70 py-12 sm:py-16 transition-colors duration-200 dark:border-slate-800/80 dark:bg-[#070b14]/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-50/80 px-3.5 py-1 text-xs font-bold text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300 mb-3">
          <Sparkles className="size-3.5 text-blue-600 dark:text-blue-400" />
          <span>Secteurs d’Activité & Filières de Terrain</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Pensé pour chaque secteur d’activité technique
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Une plateforme unifiée qui s’adapte aux exigences métier et réglementaires de chaque filière opérationnelle.
        </p>
      </div>

      {/* Conteneur du Marquee avec masque de fondu progressif sur les bords gauche/droit */}
      <div
        className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        aria-label="Liste défilante des secteurs d’activité pris en charge"
      >
        {/* Ruban 1 : Défilement fluide vers la gauche */}
        <div className="animate-marquee py-2 flex gap-4">
          {[...ROW_1_SECTORS, ...ROW_1_SECTORS].map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={`row1-${item.name}-${index}`}
                className="group flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 shadow-2xs backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md dark:border-slate-800/90 dark:bg-slate-900/85 shrink-0"
              >
                <div className={`flex size-10 items-center justify-center rounded-xl border p-2 shrink-0 transition-transform group-hover:scale-110 ${item.color}`}>
                  <Icon className="size-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {item.name}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    {item.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Ruban 2 : Défilement fluide vers la droite (décalé pour une grande richesse visuelle) */}
        <div className="animate-marquee-reverse py-2 flex gap-4 mt-2 sm:mt-3">
          {[...ROW_2_SECTORS, ...ROW_2_SECTORS].map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={`row2-${item.name}-${index}`}
                className="group flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 shadow-2xs backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md dark:border-slate-800/90 dark:bg-slate-900/85 shrink-0"
              >
                <div className={`flex size-10 items-center justify-center rounded-xl border p-2 shrink-0 transition-transform group-hover:scale-110 ${item.color}`}>
                  <Icon className="size-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {item.name}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    {item.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

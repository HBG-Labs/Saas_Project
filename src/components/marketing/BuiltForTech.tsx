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
import { useEffect, useRef, useState } from 'react';

const LEFT_SECTORS = [
  {
    name: 'Fibre Optique & Télécoms',
    sub: 'Réseaux FTTH & Infrastructures télécom',
    icon: Cable,
    color: 'text-cyan-400',
  },
  {
    name: 'Électricité & Courants Faibles',
    sub: 'Basse tension, Tertiaire & Domotique',
    icon: Zap,
    color: 'text-amber-400',
  },
  {
    name: 'Froid & Climatisation (CVC)',
    sub: 'Génie frigorifique & Traitement d’air',
    icon: Snowflake,
    color: 'text-rose-400',
  },
  {
    name: 'Plomberie & Sanitaire',
    sub: 'Réseaux d’eau, Canalisations & Sanitaire',
    icon: Droplet,
    color: 'text-sky-400',
  },
  {
    name: 'Chauffage & Génie Thermique',
    sub: 'Chaudières, Pompes à chaleur & Énergie',
    icon: Flame,
    color: 'text-orange-400',
  },
  {
    name: 'Réseaux Informatiques & IT',
    sub: 'Infrastructures VDI, Baies & Systèmes IP',
    icon: Cpu,
    color: 'text-indigo-400',
  },
];

const RIGHT_SECTORS = [
  {
    name: 'Énergies Renouvelables & IRVE',
    sub: 'Solaire photovoltaïque & Bornes de recharge',
    icon: SunMedium,
    color: 'text-emerald-400',
  },
  {
    name: 'Sécurité Électronique & Alarme',
    sub: 'Vidéosurveillance, Alarmes & Contrôle d’accès',
    icon: ShieldCheck,
    color: 'text-blue-400',
  },
  {
    name: 'Paysage & Espaces Verts',
    sub: 'Création paysagère & Aménagement extérieur',
    icon: Trees,
    color: 'text-green-400',
  },
  {
    name: 'Propreté & Nettoyage Industriel',
    sub: 'Entretien de locaux, Tertiaire & Hygiène',
    icon: Sparkles,
    color: 'text-purple-400',
  },
  {
    name: 'Hygiène 3D & Anti-Nuisibles',
    sub: 'Dératisation, Désinsectisation & Prévention',
    icon: Bug,
    color: 'text-rose-400',
  },
  {
    name: 'Maintenance Multi-Technique',
    sub: 'Maintenance de bâtiments & Installations',
    icon: Wrench,
    color: 'text-violet-400',
  },
];

export function BuiltForTech() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight || 800;

      // Début de l'animation quand le haut de la section entre dans l'écran
      const start = windowHeight * 0.90;
      const end = windowHeight * 0.20;
      const progress = Math.max(0, Math.min(1, (start - rect.top) / (start - end)));
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const ALL_SECTORS = [...LEFT_SECTORS, ...RIGHT_SECTORS];

  return (
    <section ref={sectionRef} className="py-14 sm:py-20">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-6">
        {/* Contenu entièrement positionné à gauche : libère 100% de la moitié droite pour le technicien */}
        <div className="max-w-2xl text-left flex flex-col items-start space-y-6">
          {/* En-tête de section */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-none border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 text-xs font-bold text-cyan-300 shadow-xs">
              <Sparkles className="size-3.5 text-cyan-400" />
              <span>Secteurs d’Activité &amp; Filières de Terrain</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Pensé pour chaque secteur d’activité technique
            </h2>
            <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed font-normal">
              Une plateforme unifiée qui s’adapte aux exigences métier et réglementaires de chaque filière opérationnelle.
            </p>
          </div>

          {/* Grille des 12 secteurs en 2 colonnes ultra-compactes sur mobile et desktop */}
          <div className="grid grid-cols-2 gap-x-2.5 sm:gap-x-6 gap-y-1.5 sm:gap-y-2.5 w-full pt-1">
            {ALL_SECTORS.map((item, index) => {
              const Icon = item.icon;
              // Calcul de déclenchement progressif au fur et à mesure du scroll
              const threshold = (index / ALL_SECTORS.length) * 0.75;
              const isVisible = scrollProgress >= threshold;
              const itemProgress = Math.min(1, Math.max(0, (scrollProgress - threshold) / 0.25));

              return (
                <div
                  key={item.name}
                  style={{
                    opacity: isVisible ? itemProgress : 0,
                    transform: isVisible
                      ? `translateX(${(1 - itemProgress) * -15}px)`
                      : 'translateX(-15px)',
                    transition: 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  className="group flex items-center gap-1.5 sm:gap-2.5 py-1 sm:py-1.5 px-0.5 border-b border-white/5 transition-all duration-300 hover:translate-x-1 cursor-default min-w-0"
                >
                  <div className={`flex size-5 sm:size-7 items-center justify-center rounded-none shrink-0 transition-transform duration-300 group-hover:scale-110 ${item.color}`}>
                    <Icon className="size-3.5 sm:size-4" />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="text-[11px] sm:text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                      {item.name}
                    </div>
                    <div className="text-[9px] sm:text-[11px] font-medium text-slate-400 truncate hidden sm:block">
                      {item.sub}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

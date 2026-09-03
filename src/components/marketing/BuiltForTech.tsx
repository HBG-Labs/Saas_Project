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

import { Badge } from '@/components/ui/Badge';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

/**
 * Groupée par famille de métier plutôt que dans un ordre arbitraire.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CET ORDRE CORRIGE
 *
 * L'ancien découpage (deux tableaux `LEFT_SECTORS`/`RIGHT_SECTORS` concaténés
 * puis posés dans une grille CSS à deux colonnes) laissait la grille CSS
 * décider seule du remplissage : par défaut ligne par ligne, elle envoyait un
 * secteur sur deux dans chaque colonne. Résultat mesuré sur desktop —
 * Électricité, Plomberie, Réseaux IT, Sécurité électronique, Propreté et
 * Maintenance se retrouvaient TOUS dans la colonne de droite, sans qu'aucun
 * regroupement ne l'explique, et l'ordre de lecture mobile (colonne unique)
 * ne correspondait à aucune des deux colonnes desktop.
 *
 * Les douze métiers sont ici groupés par famille — réseaux & électro-
 * technique, génie climatique & fluides, extérieur & entretien — et la
 * grille est en `grid-flow-col` (voir plus bas) : la colonne de gauche
 * porte exactement les six premiers de cette liste, la droite les six
 * suivants, dans le MÊME ordre qu'en lecture mobile.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const SECTORS = [
  // Réseaux & électro-technique
  {
    name: 'Fibre Optique & Télécoms',
    sub: 'Réseaux FTTH & Infrastructures télécom',
    icon: Cable,
  },
  {
    name: 'Électricité & Courants Faibles',
    sub: 'Basse tension, Tertiaire & Domotique',
    icon: Zap,
  },
  {
    name: 'Réseaux Informatiques & IT',
    sub: 'Infrastructures VDI, Baies & Systèmes IP',
    icon: Cpu,
  },
  {
    name: 'Sécurité Électronique & Alarme',
    sub: 'Vidéosurveillance, Alarmes & Contrôle d’accès',
    icon: ShieldCheck,
  },
  // Génie climatique & fluides
  {
    name: 'Froid & Climatisation (CVC)',
    sub: 'Génie frigorifique & Traitement d’air',
    icon: Snowflake,
  },
  {
    name: 'Chauffage & Génie Thermique',
    sub: 'Chaudières, Pompes à chaleur & Énergie',
    icon: Flame,
  },
  {
    name: 'Plomberie & Sanitaire',
    sub: 'Réseaux d’eau, Canalisations & Sanitaire',
    icon: Droplet,
  },
  {
    name: 'Énergies Renouvelables & IRVE',
    sub: 'Solaire photovoltaïque & Bornes de recharge',
    icon: SunMedium,
  },
  // Extérieur & entretien
  {
    name: 'Paysage & Espaces Verts',
    sub: 'Création paysagère & Aménagement extérieur',
    icon: Trees,
  },
  {
    name: 'Propreté & Nettoyage Industriel',
    sub: 'Entretien de locaux, Tertiaire & Hygiène',
    icon: Sparkles,
  },
  {
    name: 'Hygiène 3D & Anti-Nuisibles',
    sub: 'Dératisation, Désinsectisation & Prévention',
    icon: Bug,
  },
  {
    name: 'Maintenance Multi-Technique',
    sub: 'Maintenance de bâtiments & Installations',
    icon: Wrench,
  },
];

export function BuiltForTech() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const mouvementReduit = usePrefersReducedMotion();

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

  return (
    <section ref={sectionRef} className="py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Contenu entièrement positionné à gauche : libère 100% de la moitié droite pour le technicien */}
        <div className="max-w-3xl space-y-8">
          <div>
            <Badge variant="primary" className="mb-4">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Secteurs d’activité
            </Badge>
            <h2 className="text-foreground text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Pensé pour chaque secteur d’activité technique
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed">
              Une plateforme unifiée qui s’adapte aux exigences métier et réglementaires de chaque
              filière opérationnelle.
            </p>
          </div>

          {/*
            Grille des 12 secteurs, groupés par famille de métier.

            `sm:grid-flow-col sm:grid-rows-6` REMPLACE le remplissage par
            défaut de CSS Grid (ligne par ligne) par un remplissage par
            colonne : la colonne de gauche reçoit exactement les six premiers
            secteurs du tableau, la droite les six suivants — le même ordre
            que la colonne unique du mobile, jamais réparti autrement.
          */}
          <div className="grid w-full grid-cols-1 gap-x-8 sm:grid-cols-2 sm:grid-flow-col sm:grid-rows-6">
            {SECTORS.map((item, index) => {
              const Icon = item.icon;
              // Calcul de déclenchement progressif au fur et à mesure du scroll
              const threshold = (index / SECTORS.length) * 0.75;
              const isVisible = scrollProgress >= threshold;
              const itemProgress = Math.min(1, Math.max(0, (scrollProgress - threshold) / 0.25));

              return (
                <div
                  key={item.name}
                  /*
                    Sous « réduire les animations », on ne pose aucun style :
                    les douze secteurs s'affichent d'emblée. Les annuler après
                    coup en CSS serait vain — un style en ligne l'emporte.
                  */
                  style={
                    mouvementReduit
                      ? undefined
                      : {
                          opacity: isVisible ? itemProgress : 0,
                          transform: isVisible
                            ? `translateX(${(1 - itemProgress) * -15}px)`
                            : 'translateX(-15px)',
                          transition:
                            'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                        }
                  }
                  className="group border-border flex min-w-0 items-center gap-2.5 border-b py-2"
                >
                  <div className="bg-primary-subtle text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground truncate text-sm font-semibold">
                      {item.name}
                    </div>
                    <div className="text-muted-foreground hidden truncate text-sm sm:block">
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

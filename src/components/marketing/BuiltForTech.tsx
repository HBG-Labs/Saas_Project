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
 * Les douze métiers sont ici groupés par famille, et la grille est en
 * `grid-flow-col` (voir plus bas) : la colonne de gauche porte exactement les
 * six premiers de cette liste, la droite les six suivants, dans le MÊME ordre
 * qu'en lecture mobile.
 *
 * LA COUPURE TOMBE À SIX, DONC LES FAMILLES FONT SIX
 *
 * Une première version annonçait trois familles de quatre. Elles ne
 * survivaient pas à l'affichage : la grille coupe après le sixième élément,
 * soit au milieu de la deuxième famille — Froid et Chauffage à gauche,
 * Plomberie et Énergies renouvelables à droite. Le commentaire décrivait donc
 * un regroupement que l'écran démentait.
 *
 * Les familles sont désormais calées sur ce que le lecteur voit vraiment :
 * une colonne = une famille de six.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const SECTORS = [
  // ── Colonne de gauche — Réseaux, électricité & génie climatique
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
  // ── Colonne de droite — Fluides, énergies, extérieur & entretien
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
  /*
    Révélé d'emblée là où l'observateur n'existe pas — rendu serveur, jsdom
    des tests. C'est un état INITIAL et non un `setRevele(true)` posé dans
    l'effet : `ScrollRevealSection` procède ainsi et le compilateur React le
    refuse (`react-hooks/set-state-in-effect`), un `setState` synchrone en
    corps d'effet déclenchant un rendu en cascade. Le calculer ici l'évite,
    et garantit surtout que le contenu n'est jamais invisible faute d'API.
  */
  const [revele, setRevele] = useState(
    () => typeof window === 'undefined' || typeof IntersectionObserver === 'undefined'
  );
  const mouvementReduit = usePrefersReducedMotion();

  /*
    LES DERNIERS SECTEURS RESTAIENT PÂLES POUR DE BON.

    L'opacité de chaque secteur était auparavant pilotée en continu par la
    position de la section à l'écran : `progress` valait 1 seulement quand le
    haut de la section atteignait les 20 % supérieurs de la fenêtre, et le
    douzième secteur n'était plein qu'à partir de `progress ≥ 0.9375`.

    Mesuré au navigateur : un visiteur qui fait défiler jusqu'à AVOIR la
    section sous les yeux s'arrête bien avant — haut de section à 276 px sur
    une fenêtre de 900 px, là où il en fallait ≤ 180. Dans cet état, stable
    tant qu'il ne défile pas plus loin, « Propreté » restait à 0,94,
    « Hygiène 3D » à 0,69 et « Maintenance Multi-Technique » à 0,44. Trois
    métiers sur douze affichés en gris pâle, sous les seuils de contraste, et
    donnant l'impression d'être désactivés — alors qu'ils sont proposés comme
    les neuf autres.

    Un `IntersectionObserver` à déclenchement unique règle le fond du
    problème : l'apparition se joue une fois, va toujours jusqu'au bout, et le
    décalage entre les douze passe par `transition-delay` plutôt que par un
    calcul refait à chaque événement de défilement. C'est aussi le patron déjà
    retenu par `ScrollRevealSection`, et cela supprime un lecteur de
    `getBoundingClientRect()` appelé à chaque pixel défilé.
  */
  useEffect(() => {
    const element = sectionRef.current;
    // Sans observateur, l'état initial a déjà tout révélé : rien à observer.
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setRevele(true);
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
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

            `md:grid-flow-col md:grid-rows-6` REMPLACE le remplissage par
            défaut de CSS Grid (ligne par ligne) par un remplissage par
            colonne : la colonne de gauche reçoit exactement les six premiers
            secteurs du tableau, la droite les six suivants — le même ordre
            que la colonne unique du mobile, jamais réparti autrement.

            POURQUOI `md:` ET NON `sm:` POUR LE PASSAGE À DEUX COLONNES

            Les sous-titres portent `truncate`, donc ils se coupent en silence
            au lieu de déborder. Mesuré aux largeurs successives : à 640 px —
            exactement le seuil `sm` où les deux colonnes s'activaient — DIX
            des douze sous-titres étaient tronqués (« Vidéosurveillance,
            Alarmes & Contrôle d'a… »), chaque colonne ne faisant plus que
            ~290 px. À 768 px et au-delà, aucun ne l'est.

            Le passage à deux colonnes attend donc `md`. Entre 640 et 767 px,
            la liste reste sur une colonne pleine largeur — où les sous-titres,
            eux, s'affichent déjà (`sm:block` ci-dessous) et tiennent
            largement.
          */}
          <div className="grid w-full grid-cols-1 gap-x-8 md:grid-cols-2 md:grid-flow-col md:grid-rows-6">
            {SECTORS.map((item, index) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.name}
                  /*
                    Sous « réduire les animations », on ne pose aucun style :
                    les douze secteurs s'affichent d'emblée. Les annuler après
                    coup en CSS serait vain — un style en ligne l'emporte.

                    Sinon, un seul état booléen et un décalage par l'index :
                    l'apparition atteint toujours l'opacité 1, quelle que soit
                    la distance parcourue au défilement.
                  */
                  style={
                    mouvementReduit
                      ? undefined
                      : {
                          opacity: revele ? 1 : 0,
                          transform: revele ? 'translateX(0)' : 'translateX(-15px)',
                          transition:
                            'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                          transitionDelay: `${index * 45}ms`,
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

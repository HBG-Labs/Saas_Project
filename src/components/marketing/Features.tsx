import { Clock, Gauge, Keyboard, ShieldCheck, Smartphone, Star } from 'lucide-react';

import { Section } from './Section';

const FEATURES = [
  {
    icon: Gauge,
    title: 'Calculs vérifiés',
    description:
      'Chaque outil repose sur une logique de calcul pure, couverte par des tests unitaires indépendants de l’interface.',
  },
  {
    icon: Star,
    title: 'Favoris',
    description:
      'Épinglez les outils que vous utilisez tous les jours et retrouvez-les en un clic depuis le tableau de bord.',
  },
  {
    icon: Clock,
    title: 'Historique',
    description:
      'Vos derniers calculs restent accessibles. Reprenez un dossier là où vous l’aviez laissé.',
  },
  {
    icon: Keyboard,
    title: 'Tout au clavier',
    description:
      'La palette de commandes ⌘K atteint n’importe quel outil ou page sans quitter le clavier.',
  },
  {
    icon: Smartphone,
    title: 'Pensé pour le terrain',
    description:
      'Interface tactile, cibles de 44 px, mode sombre pour les locaux techniques et les interventions de nuit.',
  },
  {
    icon: ShieldCheck,
    title: 'Données cloisonnées',
    description:
      'Vos favoris et votre historique ne sont accessibles qu’à vous, garanti au niveau de la base de données.',
  },
] as const;

export function Features() {
  return (
    <Section
      id="fonctionnalites"
      eyebrow="Fonctionnalités"
      title="Conçu pour le travail technique réel"
      description="Pas un tableur déguisé : des outils spécialisés, rapides à ouvrir et fiables à lire."
    >
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <li key={feature.title}>
              <span
                className="bg-primary-subtle text-primary flex size-10 items-center justify-center rounded-lg"
                aria-hidden="true"
              >
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
              <p className="text-muted-foreground mt-1.5 text-sm">{feature.description}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

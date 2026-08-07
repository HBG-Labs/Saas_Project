import {
  ArrowRight,
  BookOpen,
  Cable,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Moon,
  Search,
  ShieldCheck,
  Smartphone,
  Star,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Kbd } from '@/components/ui/Kbd';
import { ROUTES } from '@/config/routes';
import { useDocumentTitle } from '@/lib/use-document-title';

const FEATURES_LIST = [
  {
    icon: Search,
    title: 'Recherche Intelligente (⌘K)',
    subtitle: 'Accès instantané à n’importe quel outil ou référence',
    description:
      'Accessible depuis chaque écran via le raccourci ⌘K ou Ctrl+K. Saisissez quelques lettres d’un nom d’outil, d’un mot-clé ou d’une norme (ex: "atténuation", "CIDR", "UTE") pour ouvrir directement la calculatrice souhaitée.',
    badge: 'Productivité',
    benefit: 'Gagnez jusqu’à 30 secondes par recherche sur le terrain.',
  },
  {
    icon: Wrench,
    title: 'Catalogue d’Outils Modulaire',
    subtitle: 'Un écosystème d’ingénierie en permanente évolution',
    description:
      'Classés par domaines (Fibre optique, Réseaux, Électricité, Mathématiques), chaque outil est conçu de façon autonome. L’architecture modulaire garantit un chargement ultra-rapide et l’ajout continu de nouvelles calculatrices.',
    badge: 'Modularité',
    benefit: 'Accédez à l’outil exact dont vous avez besoin sans surcharge.',
  },
  {
    icon: ShieldCheck,
    title: 'Calculs Certifiés Conformés',
    subtitle: 'Formules validées selon les standards ITU, IEEE et UTE C 15-105',
    description:
      'Éliminez les doutes et les erreurs de saisie sur feuille de calcul ad-hoc. Tous les calculs respectent scrupuleusement les exigences normatives professionnelles avec gestion précise des unités et des chiffres tabulaires.',
    badge: 'Fiabilité',
    benefit: 'Fournissez des résultats irréprochables pour vos PV de recette.',
  },
  {
    icon: Star,
    title: 'Gestion des Favoris',
    subtitle: 'Vos outils les plus fréquents épinglés en un clic',
    description:
      'Marquez d’une étoile les calculatrices que vous utilisez quotidiennement. Elles apparaissent immédiatement sur votre tableau de bord personnel pour une ouverture sans navigation.',
    badge: 'Personnalisation',
    benefit: 'Créez votre propre boîte à outils sur mesure.',
  },
  {
    icon: Clock,
    title: 'Historique & Traçabilité',
    subtitle: 'Retrouvez tous vos calculs et paramètres passés',
    description:
      'Chaque calcul effectué est automatiquement conservé dans votre historique personnel avec les valeurs d’entrée, les unités et l’horodatage. Pratique pour reprendre une étude ou justifier un résultat.',
    badge: 'Traçabilité',
    benefit: 'Ne perdez plus jamais la trace d’une mesure ou d’un dimensionnement.',
  },
  {
    icon: BookOpen,
    title: 'Documentation & Abaques de Référence',
    subtitle: 'Les fiches techniques et normes associées à portée de main',
    description:
      'Consultez les explications de formules, les abaques de câbles et les documents normatifs directement intégrés dans chaque outil via l’onglet Documentation.',
    badge: 'Ressources',
    benefit: 'Comprenez chaque étape de calcul sans chercher dans des PDF externes.',
  },
  {
    icon: Smartphone,
    title: 'Ergonomie Terrain & Mobile',
    subtitle: 'Conçu pour une utilisation à une main sur smartphone et tablette',
    description:
      'Toutes les cibles tactiles respectent la taille minimale recommandée (44px min). L’interface s’adapte parfaitement aux écrans d’intervention sur le terrain.',
    badge: 'Mobile-first',
    benefit: 'Effectuez vos calculs au pied du poteau ou dans la baie de brassage.',
  },
  {
    icon: Moon,
    title: 'Mode Sombre Haute Lisibilité',
    subtitle: 'Confort visuel optimal en milieu sombre',
    description:
      'Le mode sombre utilise une palette ardoise profonde à haut contraste et des liserés de relief pour une lisibilité parfaite lors des interventions nocturnes ou en sous-sol.',
    badge: 'Confort',
    benefit: 'Évitez la fatigue visuelle lors des longues sessions de travail.',
  },
] as const;

export default function FeaturesPage() {
  useDocumentTitle('Fonctionnalités');

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        title="Toutes les fonctionnalités de votre cockpit"
        description="Découvrez comment NexoraTech simplifie et sécurise le travail quotidien des techniciens et ingénieurs."
        actions={
          <Button asChild size="lg" className="glow-primary">
            <Link to={ROUTES.tools}>
              Explorer les outils
              <ArrowRight className="size-4 ml-1.5" />
            </Link>
          </Button>
        }
      />

      {/* Raccourci recherche ⌘K */}
      <div className="bg-surface/80 border-border/80 border-glow shadow-raised mb-12 flex flex-col items-center justify-between gap-4 rounded-2xl border p-6 backdrop-blur-md sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
            <Search className="size-5" />
          </div>
          <div>
            <h2 className="text-foreground text-base font-semibold">Essayez la recherche universelle</h2>
            <p className="text-muted-foreground text-xs">
              Tapez <Kbd>⌘</Kbd> <Kbd>K</Kbd> ou <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> pour ouvrir la palette de commandes depuis n’importe quelle page.
            </p>
          </div>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.tools}>Voir le catalogue d&apos;outils</Link>
        </Button>
      </div>

      {/* Grille des fonctionnalités */}
      <div className="grid gap-6 md:grid-cols-2">
        {FEATURES_LIST.map((feat) => {
          const Icon = feat.icon;
          return (
            <Card key={feat.title} className="hover:border-primary/40 hover:shadow-overlay transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                    <Icon className="size-5" />
                  </div>
                  <Badge variant="neutral" className="text-2xs font-mono">{feat.badge}</Badge>
                </div>
                <CardTitle className="text-lg">{feat.title}</CardTitle>
                <p className="text-primary text-xs font-medium">{feat.subtitle}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-xs leading-relaxed">{feat.description}</p>
                <div className="bg-surface-sunken/80 border-border/40 flex items-center gap-2 rounded-lg border p-2.5 text-xs text-foreground">
                  <CheckCircle2 className="size-4 text-success shrink-0" />
                  <span className="font-medium">{feat.benefit}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* CTA de fin de page */}
      <div className="mt-16 bg-surface-sunken border-border/80 rounded-2xl border p-8 text-center sm:p-12">
        <h2 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
          Prêt à tester l&apos;espace de travail ?
        </h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm sm:text-base">
          Accédez gratuitement à tous les outils du catalogue sans carte bancaire.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="glow-primary w-full sm:w-auto">
            <Link to={ROUTES.register}>Créer un compte gratuit</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link to={ROUTES.tools}>Explorer le catalogue</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

import { ArrowRight, Clock, Cpu, Search, Star, Wrench } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Kbd } from '@/components/ui/Kbd';
import { StatCard } from '@/components/ui/StatCard';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { CATEGORY_METADATA } from '@/features/tools/catalog-metadata';
import { CategoryCard } from '@/features/tools/components/CategoryCard';
import { ToolCard } from '@/features/tools/components/ToolCard';
import { listTools } from '@/features/tools';

export default function DashboardPage() {
  const { user } = useAuth();
  const tools = listTools();

  const displayName =
    (user?.user_metadata['display_name'] as string | undefined) ?? user?.email?.split('@')[0] ?? 'Technicien';

  const favoriteCount = 0;
  const historyCount = 0;

  return (
    <>
      {/* En-tête Cockpit */}
      <div className="bg-surface/80 border-border/80 border-glow shadow-raised mb-8 rounded-2xl border p-6 backdrop-blur-md">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-success animate-pulse" />
              <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-2xs">
                Cockpit connecté
              </Badge>
            </div>
            <h1 className="text-foreground mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Bonjour, {displayName}
            </h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
              Bienvenue sur votre poste de travail technique. Accédez à vos outils et calculs certifiés.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild size="sm" className="glow-primary">
              <Link to={ROUTES.tools}>
                <Wrench className="size-4 mr-1.5" />
                Catalogue des outils
              </Link>
            </Button>
          </div>
        </div>

        {/* Lancement rapide ⌘K */}
        <div className="bg-surface-sunken/80 border-border/60 mt-6 flex items-center justify-between rounded-xl border p-3">
          <div className="flex items-center gap-2 text-xs text-subtle-foreground">
            <Search className="size-4 text-primary" />
            <span>Recherche instantanée d&apos;outils ou de normes :</span>
            <Kbd>⌘</Kbd> <Kbd>K</Kbd>
          </div>
          <span className="text-subtle-foreground text-2xs hidden sm:inline">
            Filtrez parmi {tools.length} outils
          </span>
        </div>
      </div>

      {/* Grille de statistiques Cockpit */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Outils disponibles" value={tools.length} icon={Wrench} />
        <StatCard label="Calculs ce mois-ci" value={historyCount} icon={Clock} />
        <StatCard label="Outils favoris" value={favoriteCount} icon={Star} />
        <StatCard label="Domaines couverts" value={CATEGORY_METADATA.length} icon={Cpu} />
      </div>

      {/* Section Outils Recommandés / Populaires */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-foreground text-lg font-bold tracking-tight">Outils à la une</h2>
          <Link to={ROUTES.tools} className="text-primary hover:text-primary-hover text-xs font-semibold flex items-center gap-1">
            Voir tout le catalogue <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {tools.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.slice(0, 3).map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Wrench}
            size="sm"
            title="Catalogue en cours d'enrichissement"
            description="De nouveaux outils de calcul fibre, réseau et électricité sont régulièrement ajoutés."
          />
        )}
      </section>

      {/* Activité récente & Favoris */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-primary" />
              Historique récent des calculs
            </CardTitle>
            <Badge variant="neutral" className="text-2xs font-mono">Auto-save</Badge>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Clock}
              size="sm"
              title="Aucun calcul enregistré pour le moment"
              description="Vos résultats de calculs récents apparaîtront ici avec leur horodatage et leurs paramètres."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="size-4 text-warning" />
              Vos Favoris
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Star}
              size="sm"
              title="Aucun outil favori"
              description="Épinglez vos calculatrices fréquentes en cliquant sur l’étoile pour y accéder immédiatement."
            />
          </CardContent>
        </Card>
      </div>

      {/* Explorer par catégorie */}
      <section className="mt-10">
        <h2 className="text-foreground mb-4 text-lg font-bold tracking-tight">Catégories d&apos;ingénierie</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_METADATA.map((category) => (
            <CategoryCard
              key={category.slug}
              category={category}
              toolCount={tools.filter((tool) => tool.category === category.slug).length}
            />
          ))}
        </div>
      </section>
    </>
  );
}

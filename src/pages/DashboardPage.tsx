import { ArrowRight, Clock, Sparkles, Star, Wrench } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { CATEGORY_METADATA } from '@/features/tools/catalog-metadata';
import { CategoryCard } from '@/features/tools/components/CategoryCard';
import { listTools } from '@/features/tools';

/**
 * Tableau de bord.
 *
 * Les compteurs sont à zéro et les listes vides : c'est l'état RÉEL du produit,
 * aucun outil n'étant encore implémenté (Phase 3). Plutôt que de masquer ces
 * zones, on montre des états vides qui expliquent la situation et orientent
 * vers l'action suivante — c'est précisément le principe §2.2 du Design System.
 *
 * Le branchement sur les vraies données (favoris, historique) se fera en
 * remplaçant les constantes locales par les hooks correspondants, sans toucher
 * à la mise en page.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const tools = listTools();

  const displayName =
    (user?.user_metadata['display_name'] as string | undefined) ?? user?.email?.split('@')[0] ?? '';

  const favoriteCount = 0;
  const historyCount = 0;

  return (
    <>
      <PageHeader
        title={displayName ? `Bonjour ${displayName}` : 'Tableau de bord'}
        description="Retrouvez vos outils, vos favoris et votre activité récente."
        actions={
          <Button asChild>
            <Link to={ROUTES.tools}>
              Parcourir les outils
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Outils disponibles" value={tools.length} icon={Wrench} />
        <StatCard label="Favoris" value={favoriteCount} icon={Star} />
        <StatCard label="Calculs ce mois-ci" value={historyCount} icon={Clock} />
        <StatCard label="Catégories" value={CATEGORY_METADATA.length} icon={Sparkles} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Clock}
              size="sm"
              title="Aucune activité pour le moment"
              description="Vos derniers outils utilisés apparaîtront ici dès que vous commencerez à travailler."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Favoris</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Star}
              size="sm"
              title="Aucun favori"
              description="Cliquez sur l’étoile d’un outil pour l’épingler ici."
            />
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-base font-semibold">Explorer par catégorie</h2>
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

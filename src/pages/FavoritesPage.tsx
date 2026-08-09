import { Star } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ToolCardSkeleton } from '@/components/ui/Skeleton';
import { isCategorySlug } from '@/config/categories';
import { ROUTES } from '@/config/routes';
import { useFavorites, useToggleFavorite } from '@/features/catalog';
import { ToolCard } from '@/features/tools/components/ToolCard';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { ToolWithCategory } from '@/types/domain';

/**
 * Favoris de l'utilisateur, servis par le serveur.
 *
 * La table `favorites` existe depuis la Phase 1 et sa policy la restreint au
 * propriétaire de la ligne. La liste suit donc l'utilisateur d'un appareil à
 * l'autre — ce que promettait déjà l'état vide, sans le tenir.
 */
export default function FavoritesPage() {
  useDocumentTitle('Favoris');

  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();

  const list = favorites.data ?? [];

  return (
    <>
      <PageHeader
        title="Favoris"
        description="Les outils que vous avez épinglés, accessibles en un clic."
      />

      {favorites.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ToolCardSkeleton />
          <ToolCardSkeleton />
          <ToolCardSkeleton />
        </div>
      ) : favorites.isError ? (
        <ErrorState
          error={favorites.error}
          onRetry={() => {
            void favorites.refetch();
          }}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Aucun favori pour l’instant"
          description="Parcourez le catalogue et cliquez sur l’étoile d’un outil pour le retrouver ici, sur tous vos appareils."
          action={
            <Button asChild size="sm">
              <Link to={ROUTES.tools}>Parcourir les outils</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={toCardTool(tool)}
              isFavorite
              onToggleFavorite={() => {
                toggleFavorite.mutate({ toolId: tool.id, isFavorite: true });
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Adapte une ligne de catalogue à la forme attendue par `ToolCard`.
 *
 * Le composant est écrit pour le registry — la source du CODE — alors que les
 * favoris viennent de la base — la source des MÉTADONNÉES. Les deux décrivent
 * le même outil sous deux angles, et cette conversion est le point de contact.
 *
 * Une catégorie inconnue retombe sur `general` plutôt que de casser l'affichage :
 * le catalogue en base peut avancer avant le code, et une carte mal rangée vaut
 * mieux qu'une page blanche.
 */
function toCardTool(tool: ToolWithCategory) {
  const categorySlug = tool.category.slug;

  return {
    slug: tool.slug,
    title: tool.name,
    description: tool.short_description ?? tool.description ?? '',
    category: isCategorySlug(categorySlug) ? categorySlug : ('general' as const),
    icon: tool.icon ?? 'wrench',
  };
}

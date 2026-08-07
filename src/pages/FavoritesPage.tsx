import { Star } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

/**
 * Favoris de l'utilisateur.
 *
 * La table `favorites` et ses politiques RLS existent depuis la Phase 1. Le
 * branchement effectif attend qu'il y ait des outils à mettre en favori
 * (Phase 3) : la liste se substituera à l'état vide sans changer la structure.
 */
export default function FavoritesPage() {
  const favorites: readonly never[] = [];

  return (
    <>
      <PageHeader
        title="Favoris"
        description="Les outils que vous avez épinglés, accessibles en un clic."
      />

      {favorites.length === 0 ? (
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
      ) : null}
    </>
  );
}

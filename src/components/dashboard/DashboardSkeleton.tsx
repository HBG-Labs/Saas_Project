import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Squelette du tableau de bord, affiché tant que le rôle est inconnu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IL NE REPRODUIT QUE CE QUE LES TROIS TABLEAUX DE BORD ONT EN COMMUN
 *
 * Owner, Manager et Technician partagent la même ossature : `space-y-8 pb-12`,
 * un titre en `text-2xl sm:text-3xl`, un sous-titre, une rangée de boutons
 * `size="sm"`, puis des cartes. C'est tout ce que ce squelette dessine.
 *
 * Il ne peut pas en dessiner davantage, et c'est voulu : au moment où il
 * s'affiche, on ignore encore lequel des trois arrivera. Esquisser des cartes
 * propres à l'un d'eux reviendrait à reprendre le défaut qu'on vient de
 * corriger — annoncer un écran avant de savoir lequel.
 *
 * `Skeleton.tsx` pose la règle : reproduire la FORME du contenu attendu, pas
 * remplir l'espace au hasard, sinon l'arrivée du vrai contenu fait sauter la
 * mise en page. Les hauteurs ci-dessous sont donc celles des éléments réels.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function DashboardSkeleton() {
  return (
    <div
      className="space-y-8 pb-12"
      role="status"
      aria-busy="true"
      aria-label="Ouverture de votre espace"
    >
      <div className="space-y-3">
        {/* Titre : `text-2xl` puis `sm:text-3xl` dans les trois écrans. */}
        <Skeleton className="h-8 w-56 sm:h-9 sm:w-72" />
        <Skeleton className="h-4 w-full max-w-md" />

        {/* La rangée d'actions, en `size="sm"`. */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* Deux blocs de carte, comme le premier écran de chaque tableau de bord. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}

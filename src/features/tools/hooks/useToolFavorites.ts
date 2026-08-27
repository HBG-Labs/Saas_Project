import { useCallback, useMemo } from 'react';

import { useCatalogTools, useFavorites, useToggleFavorite } from '@/features/catalog';

/**
 * Favoris d'outils, adressés par slug.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE HOOK N'EST PLUS DANS `localStorage`
 *
 * La version précédente tenait la liste dans `localStorage`. Elle avait deux
 * défauts, dont le second était visible à l'écran :
 *
 *   • le favori ne suivait pas l'utilisateur — changer de poste ou vider le
 *     cache du navigateur le perdait, alors que c'est une donnée de compte ;
 *   • la page de détail d'un outil, elle, lisait déjà les favoris SERVEUR
 *     (`useFavorites`). Les deux étoiles — celle de la carte et celle de la
 *     page — ne pouvaient donc jamais être d'accord.
 *
 * La table `favorites` existait depuis `20260807090200_user_data.sql` et ses
 * policies la restreignent déjà à son propriétaire. Il n'y avait rien à créer,
 * seulement à s'y brancher.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La surface publique — `favorites`, `isFavorite`, `toggleFavorite` — est
 * inchangée : les pages qui l'utilisent n'ont pas eu à bouger.
 *
 * `toggleFavorite` prend un slug ; la table, elle, référence un `tool_id`. La
 * résolution passe par le catalogue en base, seul détenteur de cet
 * identifiant. Un outil absent du catalogue ne peut donc pas être mis en
 * favori — c'est voulu : la clé étrangère le refuserait de toute façon.
 */
export function useToolFavorites() {
  const favoritesQuery = useFavorites();
  const catalogQuery = useCatalogTools();
  const toggle = useToggleFavorite();

  const favorites = useMemo(
    () => (favoritesQuery.data ?? []).map((tool) => tool.slug),
    [favoritesQuery.data],
  );

  const isFavorite = useCallback((slug: string) => favorites.includes(slug), [favorites]);

  const toggleFavorite = useCallback(
    (slug: string) => {
      const tool = (catalogQuery.data ?? []).find((entry) => entry.slug === slug);
      if (tool === undefined) return;

      toggle.mutate({ toolId: tool.id, isFavorite: favorites.includes(slug) });
    },
    [catalogQuery.data, favorites, toggle],
  );

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    isLoading: favoritesQuery.isPending || catalogQuery.isPending,
    error: favoritesQuery.error ?? catalogQuery.error ?? toggle.error,
  };
}

import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { AuthContext } from '@/features/auth';
import { useCatalogTools, useFavorites } from '@/features/catalog';
import { addFavorite, removeFavorite } from '@/features/catalog/api/catalog.api';
import { qk } from '@/lib/query-keys';

const FAVORITES_EVENT = 'rezo360:favorites-updated';

function getStorageKey(userId: string | null | undefined): string {
  if (!userId) return 'rezo360_tools_favorites_anonymous';
  return `rezo360_tools_favorites_${userId}`;
}

function readStoredFavorites(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function persistFavorites(key: string, items: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: { key, items } }));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Hook unifié pour la gestion des favoris d'outils (par slug).
 *
 * Fonctionnalités clés :
 * 1. Prise en charge instantanée en mode visiteur / invité (localStorage).
 * 2. Mises à jour optimistes (0ms de latence au clic).
 * 3. Synchronisation bidirectionnelle avec Supabase lorsque l'utilisateur est connecté.
 * 4. Synchronisation inter-composants et multi-onglets via événements.
 */
export function useToolFavorites() {
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id ?? null;
  const storageKey = getStorageKey(userId);
  const queryClient = useQueryClient();

  const favoritesQuery = useFavorites();
  const catalogQuery = useCatalogTools();

  const [localFavorites, setLocalFavorites] = useState<string[]>(() =>
    readStoredFavorites(storageKey),
  );

  // Changement de compte / session
  const [cleLue, setCleLue] = useState(storageKey);
  if (cleLue !== storageKey) {
    setCleLue(storageKey);
    setLocalFavorites(readStoredFavorites(storageKey));
  }

  // Écoute des mises à jour inter-composants et multi-onglets
  useEffect(() => {
    const handleUpdate = () => {
      setLocalFavorites(readStoredFavorites(storageKey));
    };
    window.addEventListener(FAVORITES_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(FAVORITES_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [storageKey]);

  // Synchronisation avec les données serveur si connecté
  useEffect(() => {
    if (userId !== null && favoritesQuery.data) {
      const serverSlugs = favoritesQuery.data.map((tool) => tool.slug);
      const combined = Array.from(new Set([...serverSlugs, ...readStoredFavorites(storageKey)]));
      if (combined.length !== localFavorites.length || !combined.every((s) => localFavorites.includes(s))) {
        setLocalFavorites(combined);
        persistFavorites(storageKey, combined);
      }
    }
  }, [userId, favoritesQuery.data, storageKey, localFavorites]);

  const favorites = useMemo(() => {
    const serverSlugs = (favoritesQuery.data ?? []).map((tool) => tool.slug);
    return Array.from(new Set([...serverSlugs, ...localFavorites]));
  }, [favoritesQuery.data, localFavorites]);

  const isFavorite = useCallback((slug: string) => favorites.includes(slug), [favorites]);

  const toggleFavorite = useCallback(
    (slug: string) => {
      if (!slug) return;
      const currentlyFavorite = favorites.includes(slug);
      const nextFavorites = currentlyFavorite
        ? favorites.filter((s) => s !== slug)
        : [...favorites, slug];

      // 1. Sauvegarde locale immédiate (optimistic UI)
      setLocalFavorites(nextFavorites);
      persistFavorites(storageKey, nextFavorites);

      // 2. Synchronisation serveur si connecté et si l'outil existe en base
      if (userId !== null) {
        const tool = (catalogQuery.data ?? []).find((entry) => entry.slug === slug);
        if (tool?.id) {
          void (async () => {
            try {
              if (currentlyFavorite) {
                await removeFavorite(userId, tool.id);
              } else {
                await addFavorite(userId, tool.id);
              }
              await queryClient.invalidateQueries({
                queryKey: [...qk.catalog.all, 'favorites', userId],
              });
            } catch (err) {
              console.error('[useToolFavorites] Erreur de synchronisation Supabase :', err);
            }
          })();
        }
      }
    },
    [favorites, storageKey, userId, catalogQuery.data, queryClient],
  );

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    isLoading: userId !== null && favoritesQuery.isPending,
    error: favoritesQuery.error ?? catalogQuery.error,
  };
}


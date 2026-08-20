import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/features/auth';
import { qk } from '@/lib/query-keys';

import {
  addFavorite,
  getToolBySlug,
  listFavorites,
  listTools,
  listToolHistory,
  recordToolUsage,
  removeFavorite,
} from '../api/catalog.api';

/**
 * Favoris et historique d'utilisation.
 *
 * Les deux tables sont restreintes au propriétaire par leurs policies : aucun
 * filtre côté client n'est nécessaire, et n'en ajouter aucun évite de laisser
 * croire que c'est lui qui protège.
 *
 * L'identifiant de l'utilisateur figure quand même dans la clé de cache : à la
 * déconnexion, les favoris du compte précédent ne doivent pas rester servis au
 * suivant.
 */

/**
 * Outil du catalogue par son slug.
 *
 * Le registry détient le CODE de l'outil, la base ses MÉTADONNÉES — et son
 * identifiant, seul utilisable pour poser un favori ou consigner une visite.
 * Le slug est la charnière entre les deux, et c'est pourquoi il est contraint
 * des deux côtés par le même motif.
 */
export function useCatalogTool(slug: string | undefined) {
  return useQuery({
    queryKey: qk.catalog.tool(slug ?? 'none'),
    queryFn: () => (slug === undefined ? null : getToolBySlug(slug)),
    enabled: slug !== undefined,
    // Le catalogue bouge à chaque déploiement, pas à chaque minute.
    staleTime: 10 * 60_000,
  });
}

/**
 * Le catalogue entier, pour résoudre un slug en identifiant.
 *
 * Poser un favori demande un `tool_id` ; une page qui ne connaît ses outils
 * que par leur slug — la liste du catalogue, par exemple — n'en dispose pas.
 * `useCatalogTool` répondrait, mais une requête par carte affichée : ici une
 * seule requête sert toute la grille.
 *
 * Le catalogue ne bouge qu'au déploiement, d'où le même `staleTime` que
 * `useCatalogTool`. Pas de `enabled` : la lecture du catalogue est publique.
 */
export function useCatalogTools() {
  return useQuery({
    queryKey: qk.catalog.tools(),
    queryFn: listTools,
    staleTime: 10 * 60_000,
  });
}

export function useFavorites() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: [...qk.catalog.all, 'favorites', userId],
    queryFn: listFavorites,
    enabled: userId !== null,
  });
}

export function useToolHistory() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: [...qk.catalog.all, 'tool-history', userId],
    queryFn: () => listToolHistory(),
    enabled: userId !== null,
  });
}

/**
 * Bascule un outil en favori.
 *
 * `favorites` n'a pas de policy UPDATE — la table se manipule uniquement par
 * insertion et suppression, la clé primaire `(user_id, tool_id)` faisant office
 * d'état. La mutation choisit donc l'une ou l'autre selon la situation.
 */
/**
 * Enregistre l'ouverture d'un outil.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UN EFFET, ET C'EST LE BON CAS
 *
 * Le projet évite `useEffect` partout ailleurs, et pour de bonnes raisons. Ici
 * il est justifié : il s'agit précisément de synchroniser un système EXTERNE —
 * la base — sur un événement d'affichage, ce qui est la définition même d'un
 * effet.
 *
 * `enregistré` empêche le doublon en développement, où React monte les
 * composants deux fois pour débusquer les effets non idempotents. Sans ce
 * garde-fou, chaque ouverture d'outil en compterait deux.
 *
 * Un échec est ignoré. Consigner une visite est un confort ; faire échouer
 * l'affichage d'un outil de terrain parce que le réseau a hoqueté serait
 * disproportionné.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useRecordToolUsage(slug: string | undefined) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const recorded = useRef<string | null>(null);

  useEffect(() => {
    if (slug === undefined || userId === null) return;
    if (recorded.current === slug) return;

    recorded.current = slug;

    void (async () => {
      try {
        const tool = await getToolBySlug(slug);
        if (tool === null) return;

        await recordToolUsage(userId, tool.id);
        await queryClient.invalidateQueries({
          queryKey: [...qk.catalog.all, 'tool-history', userId],
        });
      } catch {
        // Silencieux, à dessein — voir la note ci-dessus.
      }
    })();
  }, [slug, userId, queryClient]);
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useMutation({
    mutationFn: async (input: { toolId: string; isFavorite: boolean }) => {
      if (userId === null) return;

      if (input.isFavorite) {
        await removeFavorite(userId, input.toolId);
      } else {
        await addFavorite(userId, input.toolId);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...qk.catalog.all, 'favorites', userId],
      });
    },
  });
}

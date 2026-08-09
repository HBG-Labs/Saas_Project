/**
 * Métadonnées d'affichage des catégories.
 *
 * Ce module n'est plus qu'un ADAPTATEUR : la source unique est
 * `src/config/categories.ts`. Il est conservé pour ne pas casser les
 * consommateurs existants (pages, composants marketing) qui importent
 * `CATEGORY_METADATA` depuis l'API publique de la feature `tools`.
 *
 * Pourquoi ne pas simplement supprimer ce fichier : `config/` est une couche
 * plus basse que `features/`. Les pages doivent pouvoir consommer le catalogue
 * par l'API publique de la feature sans connaître son implémentation — c'est la
 * règle ESLint `no-restricted-imports` qui interdit d'atteindre les fichiers
 * internes d'une feature.
 *
 * ⚠️ N'ajoutez RIEN ici. Toute évolution de catégorie se fait dans
 * `src/config/categories.ts`.
 */
import { CATEGORIES, getCategory, type CategoryDefinition } from '@/config/categories';

/** Alias historique. Identique à `CategoryDefinition`. */
export type CategoryMetadata = CategoryDefinition;

export const CATEGORY_METADATA: readonly CategoryMetadata[] = CATEGORIES;

export function getCategoryMetadata(slug: string): CategoryMetadata | undefined {
  return getCategory(slug);
}

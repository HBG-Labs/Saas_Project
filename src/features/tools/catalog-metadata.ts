import type { ToolCategorySlug } from './registry';

/**
 * Métadonnées d'affichage des catégories.
 *
 * Uniquement de la présentation (libellé, description, icône, couleur) : la
 * curation et la publication restent dans la table `categories`, et
 * l'implémentation des outils dans `src/tools/`. Ce fichier existe pour que
 * l'interface puisse afficher une catégorie sans attendre un aller-retour
 * réseau, le jeu de catégories étant fixe et connu à la compilation.
 *
 * Les clés doivent rester alignées avec `TOOL_CATEGORIES` et avec le seed
 * `supabase/migrations/20260807090300_seed_categories.sql`.
 */
export interface CategoryMetadata {
  slug: ToolCategorySlug;
  name: string;
  description: string;
  /** Nom d'icône lucide, résolu par `resolveIcon`. */
  icon: string;
  /** Classes de teinte, en tokens sémantiques uniquement. */
  tint: string;
}

export const CATEGORY_METADATA: readonly CategoryMetadata[] = [
  {
    slug: 'fiber-optics',
    name: 'Fibre optique',
    description: 'Codes couleur, bilans de liaison, atténuation, conversions dBm/mW.',
    icon: 'cable',
    tint: 'bg-info-subtle text-info',
  },
  {
    slug: 'networking',
    name: 'Réseaux',
    description: "IPv4, CIDR, sous-réseaux, masques, plages d'adresses.",
    icon: 'network',
    tint: 'bg-primary-subtle text-primary',
  },
  {
    slug: 'electrical',
    name: 'Électricité',
    description: "Loi d'Ohm, puissance, tension, courant, résistance.",
    icon: 'zap',
    tint: 'bg-warning-subtle text-warning',
  },
  {
    slug: 'general',
    name: 'Calculs généraux',
    description: "Pourcentages, conversions d'unités, temps, distances, dB.",
    icon: 'calculator',
    tint: 'bg-success-subtle text-success',
  },
];

export function getCategoryMetadata(slug: string): CategoryMetadata | undefined {
  return CATEGORY_METADATA.find((category) => category.slug === slug);
}

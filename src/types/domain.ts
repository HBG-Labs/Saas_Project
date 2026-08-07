import type { Tables } from './database';

/**
 * Types métier de l'application.
 *
 * Ils dérivent des types de base pour rester automatiquement synchronisés avec
 * le schéma, tout en donnant à l'application un vocabulaire indépendant du
 * stockage.
 */
export type Profile = Tables<'profiles'>;
export type Category = Tables<'categories'>;
export type Tool = Tables<'tools'>;
export type Favorite = Tables<'favorites'>;
export type ToolHistoryEntry = Tables<'tool_history'>;

/** Outil du catalogue accompagné de sa catégorie (jointure courante). */
export interface ToolWithCategory extends Tool {
  category: Pick<Category, 'id' | 'slug' | 'name'>;
}

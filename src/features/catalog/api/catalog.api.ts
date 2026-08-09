import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { Category, Tool, ToolWithCategory } from '@/types/domain';

/**
 * Lecture du catalogue depuis la base.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE MODULE ALORS QUE LE CATALOGUE EST DÉJÀ EN DUR
 *
 * L'application affiche aujourd'hui les catégories depuis
 * `src/config/categories.ts` et les outils depuis le registry en mémoire.
 * C'est le bon choix pour l'affichage : le jeu de catégories est connu à la
 * compilation, et un aller-retour réseau pour l'afficher serait du gaspillage.
 *
 * Ce module sert à ce que le code ne sait pas :
 *   • la CURATION (ordre, publication, dépublication à chaud) ;
 *   • la VISIBILITÉ selon l'abonnement (`visibility = 'pro'`) ;
 *   • la RÉCONCILIATION entre les outils implémentés et le catalogue publié.
 *
 * Les deux faces se joignent par le `slug`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export async function listCategories(): Promise<Category[]> {
  return unwrap(
    supabase
      .from('categories')
      .select('*')
      .eq('status', 'active')
      .order('sort_order', { ascending: true }),
  );
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return unwrapMaybe(supabase.from('categories').select('*').eq('slug', slug).single());
}

/**
 * Outils visibles pour l'utilisateur courant.
 *
 * La policy `tools_select_visible` filtre déjà selon `visibility` et
 * l'abonnement : un outil réservé aux abonnés n'arrive tout simplement pas
 * jusqu'ici pour un compte gratuit. Aucun filtrage supplémentaire n'est requis
 * — et en ajouter un donnerait l'illusion trompeuse que c'est lui qui protège.
 */
export async function listTools(): Promise<ToolWithCategory[]> {
  return unwrap(
    supabase
      .from('tools')
      .select('*, category:categories(id, slug, name)')
      .order('sort_order', { ascending: true })
      .returns<ToolWithCategory[]>(),
  );
}

export async function listToolsByCategorySlug(categorySlug: string): Promise<Tool[]> {
  const category = await getCategoryBySlug(categorySlug);
  if (category === null) return [];

  return unwrap(
    supabase
      .from('tools')
      .select('*')
      .eq('category_id', category.id)
      .order('sort_order', { ascending: true }),
  );
}

export async function getToolBySlug(slug: string): Promise<ToolWithCategory | null> {
  return unwrapMaybe(
    supabase
      .from('tools')
      .select('*, category:categories(id, slug, name)')
      .eq('slug', slug)
      .single()
      .returns<ToolWithCategory>(),
  );
}

/**
 * Slugs publiés, pour `reconcileRegistryWithCatalog()`.
 *
 * Ce rapprochement rend visible une divergence autrement silencieuse : un outil
 * publié sans implémentation affiche une page vide, un outil implémenté sans
 * ligne en base reste invisible au catalogue. Ni l'un ni l'autre ne provoque
 * d'erreur — c'est précisément ce qui les rend difficiles à repérer.
 */
export async function listPublishedToolSlugs(): Promise<string[]> {
  const rows = await unwrap(supabase.from('tools').select('slug').eq('status', 'active'));
  return rows.map((row) => row.slug);
}

/** Enregistre une utilisation d'outil (historique serveur, §13). */
export async function recordToolUsage(userId: string, toolId: string): Promise<void> {
  const { error } = await supabase
    .from('tool_history')
    .insert({ user_id: userId, tool_id: toolId });

  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Données personnelles — favoris et historique
// -----------------------------------------------------------------------------
//
// Les policies restreignent ces deux tables au propriétaire de la ligne
// (`auth.uid() = user_id`). Aucun filtre par utilisateur n'est donc nécessaire
// ici : le serveur ne renverra jamais les favoris de quelqu'un d'autre. Le
// `user_id` fourni aux écritures sert uniquement à satisfaire la contrainte
// `not null` — la policy vérifie qu'il correspond bien à l'appelant.

/** Favoris de l'utilisateur, outils joints pour l'affichage. */
export async function listFavorites(): Promise<ToolWithCategory[]> {
  const rows = await unwrap(
    supabase
      .from('favorites')
      .select('created_at, tool:tools(*, category:categories(id, slug, name))')
      .order('created_at', { ascending: false })
      .returns<{ created_at: string; tool: ToolWithCategory | null }[]>(),
  );

  // La jointure peut remonter `null` si l'outil a été retiré du catalogue depuis
  // la mise en favori — `tools_select_visible` le masque alors.
  return rows.flatMap((row) => (row.tool ? [row.tool] : []));
}

export async function addFavorite(userId: string, toolId: string): Promise<void> {
  const { error } = await supabase.from('favorites').insert({ user_id: userId, tool_id: toolId });
  if (error) throw error;
}

export async function removeFavorite(userId: string, toolId: string): Promise<void> {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('tool_id', toolId);

  if (error) throw error;
}

export interface ToolHistoryRow {
  id: string;
  usedAt: string;
  tool: ToolWithCategory;
}

/**
 * Historique d'utilisation des outils.
 *
 * À ne pas confondre avec l'historique des CALCULS, qui vit dans le navigateur
 * (`features/history`) : celui-ci enregistre quel outil a été ouvert, celui-là
 * ce qui y a été calculé. Le premier est un usage, le second un résultat.
 */
export async function listToolHistory(limit = 50): Promise<ToolHistoryRow[]> {
  const rows = await unwrap(
    supabase
      .from('tool_history')
      .select('id, used_at, tool:tools(*, category:categories(id, slug, name))')
      .order('used_at', { ascending: false })
      .limit(limit)
      .returns<{ id: string; used_at: string; tool: ToolWithCategory | null }[]>(),
  );

  return rows.flatMap((row) =>
    row.tool ? [{ id: row.id, usedAt: row.used_at, tool: row.tool }] : [],
  );
}

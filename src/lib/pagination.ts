export interface CollectPagesOptions {
  limit?: number | undefined;
  pageSize?: number;
}

/**
 * Agrège une ressource PostgREST sans dépendre de sa limite serveur.
 *
 * Le chargeur reçoit toujours un intervalle stable `(offset, size)`. Une page
 * courte termine la lecture ; une page plus grande que demandé est rejetée,
 * car poursuivre dans ce cas pourrait dupliquer ou sauter des données.
 */
export async function collectAllPages<T>(
  loadPage: (offset: number, size: number) => Promise<readonly T[]>,
  options: CollectPagesOptions = {},
): Promise<T[]> {
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const pageSize = options.pageSize ?? 500;
  if (limit !== Number.POSITIVE_INFINITY && (!Number.isInteger(limit) || limit <= 0)) return [];
  if (!Number.isInteger(pageSize) || pageSize <= 0 || pageSize > 1_000) {
    throw new Error('La taille de page doit être comprise entre 1 et 1 000.');
  }

  const rows: T[] = [];
  while (rows.length < limit) {
    const size = Math.min(pageSize, limit - rows.length);
    const page = await loadPage(rows.length, size);
    if (page.length > size) {
      throw new Error('Le serveur a renvoyé une page plus grande que la taille demandée.');
    }
    rows.push(...page);
    if (page.length < size) break;
  }
  return rows;
}

export interface AiDocumentCatalogItem {
  id: string;
  title: string;
  filename: string;
  category: string | null;
  status: 'pending' | 'processing' | 'ready' | 'error';
  created_at: string;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.pdf\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isDocumentQuestion(query: string): boolean {
  return /\b(document|documents|pdf|fichier|fichiers)\b/.test(normalize(query));
}

/** Reconnaît une question sur la présence ou la liste des documents. */
export function asksForDocumentCatalog(query: string): boolean {
  const normalized = normalize(query);
  if (!isDocumentQuestion(query)) return false;

  const asksForContent =
    /\b(contenu|resume|resumer|analyse|analyser|explique|expliquer|extrais|extraire|montant|total)\b/.test(
      normalized,
    ) || /\bque dit\b/.test(normalized);
  if (asksForContent) return false;

  return (
    /\b(vois|voit|voyez|voir|visible|disponible|indexe|indexes|ajoute|ajoutes|depose|deposes|liste|lister|repertorie|repertories)\b/.test(
      normalized,
    ) ||
    /\b(quels?|combien)\b/.test(normalized) ||
    /\b(ai je|jai)\b.*\b(document|documents|pdf|fichier|fichiers)\b/.test(normalized)
  );
}

function statusLabel(status: AiDocumentCatalogItem['status']): string {
  if (status === 'ready') return 'indexé et prêt';
  if (status === 'processing') return "en cours d'indexation";
  if (status === 'pending') return "en attente d'indexation";
  return "en erreur d'indexation";
}

/** Réponse factuelle issue du catalogue, sans dépendre du modèle. */
export function answerDocumentCatalogQuestion(
  query: string,
  documents: AiDocumentCatalogItem[],
  options?: { totalCount?: number; complete?: boolean },
): string | null {
  if (!asksForDocumentCatalog(query)) return null;

  const totalCount = options?.totalCount ?? documents.length;
  const complete = options?.complete ?? totalCount <= documents.length;

  if (totalCount === 0) {
    return "Aucun document n'est enregistré dans votre bibliothèque documentaire.";
  }

  const readyCount = documents.filter((document) => document.status === 'ready').length;
  const readySentence =
    complete && readyCount === totalCount
      ? `Les **${totalCount}** sont indexés et prêts à être consultés.`
      : complete
        ? `**${readyCount}** sur **${totalCount}** sont indexés et prêts à être consultés.`
        : `Le détail couvre ${documents.length} document(s) sur ${totalCount} ; le nombre total de documents prêts n'est pas calculé à partir de cette page.`;
  const list = documents
    .map(
      (document) =>
        `- **${document.title}** — ${statusLabel(document.status)}${document.category ? ` · catégorie ${document.category}` : ''}`,
    )
    .join('\n');

  return `Oui, je vois **${totalCount} document${totalCount > 1 ? 's' : ''}** dans votre bibliothèque. ${readySentence}\n\n${list}`;
}

const TITLE_STOP_WORDS = new Set([
  'document',
  'fichier',
  'pdf',
  'le',
  'la',
  'les',
  'un',
  'une',
  'de',
  'des',
  'du',
  'au',
  'aux',
]);

function meaningfulTokens(value: string): string[] {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !TITLE_STOP_WORDS.has(token));
}

/** Retrouve le document nommé dans la question, même si le titre est abrégé. */
export function findMentionedDocument(
  query: string,
  documents: AiDocumentCatalogItem[],
): AiDocumentCatalogItem | null {
  const normalizedQuery = normalize(query);
  const queryTokens = new Set(meaningfulTokens(query));
  let best: { document: AiDocumentCatalogItem; score: number } | null = null;

  for (const document of documents) {
    for (const alias of [document.title, document.filename]) {
      const normalizedAlias = normalize(alias);
      if (normalizedAlias.length >= 4 && normalizedQuery.includes(normalizedAlias)) {
        return document;
      }

      const titleTokens = meaningfulTokens(alias);
      const matches = titleTokens.filter((token) => queryTokens.has(token)).length;
      const score = titleTokens.length === 0 ? 0 : matches / titleTokens.length;
      if (matches >= 2 && score >= 0.6 && (!best || score > best.score)) {
        best = { document, score };
      }
    }
  }

  return best?.document ?? null;
}

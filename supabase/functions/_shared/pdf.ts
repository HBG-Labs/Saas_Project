import { extractText, getDocumentProxy } from 'npm:unpdf@^0.11.0';

/**
 * Extraction et découpage d'un PDF en fragments indexables.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI `unpdf`
 *
 * Pas de binding natif disponible en environnement Deno Edge Function : les
 * bibliothèques PDF classiques (poppler, pdfium...) exigent un exécutable ou
 * une bibliothèque système absente de ce runtime. `unpdf` est une distribution
 * de pdf.js pensée pour tourner en pur JavaScript dans les environnements
 * serverless/edge — c'est le choix documenté par Supabase pour ce cas d'usage.
 *
 * POURQUOI LE DÉCOUPAGE SUIT LA PAGE PUIS LE PARAGRAPHE
 *
 * Le §« CHUNKING » du cahier des charges demande de conserver au maximum la
 * structure du document plutôt que de trancher à intervalles fixes. `unpdf`
 * donne le texte page par page ; découper AUSSI par paragraphe (double saut de
 * ligne) évite qu'un fragment mélange la fin d'une idée et le début de la
 * suivante. Un paragraphe pathologiquement long (tableau mal extrait, liste
 * dense) est replié par phrase plutôt que tronqué à l'aveugle, pour rester
 * lisible une fois retrouvé.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Fusionné tant que le fragment reste sous ce seuil. */
const TARGET_CHUNK_CHARS = 1000;
/** Au-delà, une phrase entière ne rejoint plus le fragment courant. */
const MAX_CHUNK_CHARS = 2000;

export interface ExtractedChunk {
  content: string;
  chunkIndex: number;
  page: number;
}

/**
 * Découpe un paragraphe trop long en phrases regroupées sous
 * {@link MAX_CHUNK_CHARS}. Dernier recours seulement — la plupart des
 * paragraphes d'une documentation technique tiennent dans un seul fragment.
 */
function splitLongParagraph(paragraph: string): string[] {
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  const pieces: string[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    const candidate = buffer.length === 0 ? sentence : `${buffer} ${sentence}`;
    if (candidate.length <= MAX_CHUNK_CHARS || buffer.length === 0) {
      buffer = candidate;
    } else {
      pieces.push(buffer);
      buffer = sentence;
    }
  }

  if (buffer.length > 0) pieces.push(buffer);
  return pieces;
}

function chunkPageText(pageText: string, pageNumber: number, startIndex: number): ExtractedChunk[] {
  const paragraphs = pageText
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/[ \t]+/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0);

  const chunks: ExtractedChunk[] = [];
  let index = startIndex;
  let buffer = '';

  const flush = () => {
    if (buffer.length === 0) return;
    chunks.push({ content: buffer, chunkIndex: index, page: pageNumber });
    index += 1;
    buffer = '';
  };

  for (const paragraph of paragraphs) {
    const pieces = paragraph.length > MAX_CHUNK_CHARS ? splitLongParagraph(paragraph) : [paragraph];

    for (const piece of pieces) {
      const candidate = buffer.length === 0 ? piece : `${buffer}\n\n${piece}`;
      if (candidate.length <= TARGET_CHUNK_CHARS) {
        buffer = candidate;
      } else {
        flush();
        buffer = piece;
      }
    }
  }

  flush();
  return chunks;
}

/**
 * Extrait le texte d'un PDF et le découpe en fragments prêts à être
 * embeddés, chacun rattaché à sa page d'origine.
 *
 * Lève si l'extraction ne produit aucun texte exploitable — un PDF scanné
 * sans OCR ou un fichier corrompu en sont les deux causes attendues. C'est
 * l'appelant (`index-ai-document`) qui traduit cette erreur en
 * `ai_documents.status = 'error'` avec un message exploitable, jamais cette
 * fonction : elle ne connaît pas la table.
 */
export async function extractPdfChunks(fileBytes: Uint8Array): Promise<ExtractedChunk[]> {
  const pdf = await getDocumentProxy(fileBytes);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];

  const chunks: ExtractedChunk[] = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageChunks = chunkPageText(pages[pageIndex] ?? '', pageIndex + 1, chunks.length);
    chunks.push(...pageChunks);
  }

  if (chunks.length === 0) {
    throw new Error(
      'Aucun texte exploitable extrait du PDF (document scanné sans OCR, ou fichier vide/corrompu).',
    );
  }

  return chunks;
}

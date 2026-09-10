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
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 500;
const MAX_EXTRACTED_CHARS = 1_500_000;
const MAX_DOCUMENT_CHUNKS = 1_500;

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
    if (sentence.length > MAX_CHUNK_CHARS) {
      if (buffer.length > 0) {
        pieces.push(buffer);
        buffer = '';
      }
      for (let offset = 0; offset < sentence.length; offset += MAX_CHUNK_CHARS) {
        pieces.push(sentence.slice(offset, offset + MAX_CHUNK_CHARS));
      }
      continue;
    }

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
  if (fileBytes.byteLength === 0 || fileBytes.byteLength > MAX_PDF_BYTES) {
    throw new Error('Le PDF est vide ou dépasse la taille maximale de 25 Mo.');
  }
  if (
    fileBytes[0] !== 0x25 ||
    fileBytes[1] !== 0x50 ||
    fileBytes[2] !== 0x44 ||
    fileBytes[3] !== 0x46 ||
    fileBytes[4] !== 0x2d
  ) {
    throw new Error('Le contenu déposé n’est pas un fichier PDF valide.');
  }

  const pdf = await getDocumentProxy(fileBytes);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];

  if (pages.length > MAX_PDF_PAGES) {
    throw new Error(`Le PDF dépasse la limite de ${MAX_PDF_PAGES} pages indexables.`);
  }

  const chunks: ExtractedChunk[] = [];
  let extractedChars = 0;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageText = pages[pageIndex] ?? '';
    extractedChars += pageText.length;
    if (extractedChars > MAX_EXTRACTED_CHARS) {
      throw new Error('Le PDF contient trop de texte pour être indexé en une seule fois.');
    }

    const pageChunks = chunkPageText(pageText, pageIndex + 1, chunks.length);
    chunks.push(...pageChunks);
    if (chunks.length > MAX_DOCUMENT_CHUNKS) {
      throw new Error('Le PDF produit trop de fragments pour une indexation sûre.');
    }
  }

  if (chunks.length === 0) {
    throw new Error(
      'Aucun texte exploitable extrait du PDF (document scanné sans OCR, ou fichier vide/corrompu).',
    );
  }

  return chunks;
}

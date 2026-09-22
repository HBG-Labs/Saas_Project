/**
 * Le découpage d'une transcription en segments (STT phase 8).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI DES PARAGRAPHES ET PAS DES MINUTES
 *
 * Les moteurs retenus (`gpt-transcribe`, `gpt-4o-transcribe`) rendent du
 * texte, sans horodatage. Plutôt qu'estimer des secondes au prorata des
 * caractères — une information inventée —, un segment est ici un paragraphe
 * numéroté (`s1`, `s2`…), extrait LITTÉRAL du texte : leur concaténation
 * redonne la transcription. `start`/`end`/`speaker` restent `null` tant que
 * le moteur ne les fournit pas ; le jour où il le fait, la forme ne change
 * pas.
 *
 * Le résumé structuré cite ces identifiants : une affirmation du résumé se
 * vérifie en lisant le paragraphe qu'elle cite.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface Segment {
  id: string;
  start: number | null;
  end: number | null;
  speaker: string | null;
  text: string;
}

/** Au-delà, un paragraphe se lit mal et une citation ne désigne plus grand-chose. */
export const SEGMENT_MAX_CHARS = 450;

/**
 * Les phrases d'un texte : coupure après . ! ? … suivi d'un blanc et d'une
 * majuscule ou d'un guillemet — « Env. 3.5 m » ou « M. Dupont » ne coupent pas.
 */
export function phrasesDe(texte: string): string[] {
  return texte
    .split(/(?<=[.!?…])\s+(?=[\p{Lu}«"(])/u)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Découpe : d'abord sur les paragraphes existants (lignes vides), puis chaque
 * paragraphe trop long en phrases regroupées jusqu'à SEGMENT_MAX_CHARS. Une
 * phrase seule plus longue que la limite reste entière : on ne coupe jamais
 * au milieu d'une phrase.
 */
export function decouperEnSegments(texte: string): Segment[] {
  const morceaux: string[] = [];
  for (const paragraphe of texte.split(/\n\s*\n/u)) {
    const propre = paragraphe.replace(/\s+/gu, ' ').trim();
    if (propre.length === 0) continue;
    if (propre.length <= SEGMENT_MAX_CHARS) {
      morceaux.push(propre);
      continue;
    }
    let courant = '';
    for (const phrase of phrasesDe(propre)) {
      if (courant.length > 0 && courant.length + 1 + phrase.length > SEGMENT_MAX_CHARS) {
        morceaux.push(courant);
        courant = phrase;
      } else {
        courant = courant.length === 0 ? phrase : `${courant} ${phrase}`;
      }
    }
    if (courant.length > 0) morceaux.push(courant);
  }
  return morceaux.map((text, i) => ({
    id: `s${String(i + 1)}`,
    start: null,
    end: null,
    speaker: null,
    text,
  }));
}

/** Le texte que les segments reconstituent, paragraphe par paragraphe. */
export function texteDesSegments(segments: readonly Segment[]): string {
  return segments.map((s) => s.text).join('\n');
}

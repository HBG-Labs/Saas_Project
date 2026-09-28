import type { CreativeStyleProfile } from '../contracts/style-profile.ts';
import { voiceWords } from '../text/voice-words.ts';

/**
 * Durée minimale de lecture — HEURISTIQUE DE PRODUCTION, pas un modèle
 * scientifique du lecteur.
 *
 * Hypothèses (toutes réglées par le style, aucune constante de marque) :
 * 1. un texte court affiché en grand se lit mot à mot : coût par mot ;
 * 2. les mots longs coûtent plus : coût par caractère (lettres et chiffres),
 *    on retient le plus contraignant des deux ;
 * 3. un texte secondaire peut rester moins longtemps (facteur d'importance) ;
 * 4. en dessous d'un plancher, un texte n'est pas perçu comme lu (min_hold_ms).
 *
 * Non modélisé : la langue au-delà du découpage en mots par espaces (pas
 * adapté aux écritures sans espaces), la taille réelle du texte à l'écran,
 * la complexité du vocabulaire, le contraste.
 */
export interface ReadingInput {
  text: string;
  locale: string;
  importance: 'primary' | 'secondary';
}

export interface ReadingRequirement {
  required_ms: number;
  words: number;
  chars: number;
  rule: 'floor' | 'words' | 'chars';
}

export function readingTime(input: ReadingInput, style: CreativeStyleProfile): ReadingRequirement {
  const reading = style.rhythm_personality.reading;
  const words = voiceWords(input.text).length;
  const chars = (input.text.match(/[\p{L}\p{N}]/gu) ?? []).length;
  const factor = reading.importance[input.importance];
  const byWords = Math.round(words * reading.ms_per_word * factor);
  const byChars = Math.round(chars * reading.ms_per_char * factor);
  const required = Math.max(reading.min_hold_ms, byWords, byChars);
  let rule: ReadingRequirement['rule'] = 'floor';
  if (required > reading.min_hold_ms) rule = byWords >= byChars ? 'words' : 'chars';
  return { required_ms: required, words, chars, rule };
}

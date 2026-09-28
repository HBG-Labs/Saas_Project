import { voiceWords } from '../text/voice-words.ts';

// Deux natures de timing de parole, jamais confondues :
// - EstimatedSpeechTiming : produit ici, à partir du seul débit du style.
//   Aucune voix n'existe ; c'est une hypothèse de travail.
// - VoiceAlignment : horodatages d'une voix réellement synthétisée et alignée
//   (P3). Le type existe pour fixer le contrat ; aucun code ne le fabrique en P1.3.

export interface EstimatedSpeechTiming {
  source: 'estimated';
  segment: string;
  start_ms: number;
  end_ms: number;
  words_per_minute: number;
  words: { index: number; text: string; start_ms: number }[];
}

export interface VoiceAlignment {
  source: 'aligned';
  segment: string;
  start_ms: number;
  end_ms: number;
  provider: string;
  words: { index: number; text: string; start_ms: number; end_ms: number; confidence: number }[];
}

export type SpeechTiming = EstimatedSpeechTiming | VoiceAlignment;

/**
 * Parole estimée : durée = mots × (60 000 / débit), mots répartis au prorata
 * de leur longueur. Millisecondes entières, calcul déterministe.
 */
export function estimateSpeech(segment: string, text: string, startMs: number, wordsPerMinute: number): EstimatedSpeechTiming {
  const words = voiceWords(text);
  const duration = Math.round((words.length * 60_000) / wordsPerMinute);
  const weights = words.map((w) => w.raw.length + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return {
    source: 'estimated',
    segment,
    start_ms: startMs,
    end_ms: startMs + duration,
    words_per_minute: wordsPerMinute,
    words: words.map((w, i) => {
      const start = startMs + Math.round((duration * acc) / total);
      acc += weights[i]!;
      return { index: w.index, text: w.raw, start_ms: start };
    }),
  };
}

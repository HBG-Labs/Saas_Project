/**
 * Ce qu'un moteur rend sur du silence, ce n'est pas une transcription.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE CAS VÉCU (21/09/2026)
 *
 * Deux minutes d'audio muet (micro coupé par Android dans la PWA) → le moteur
 * a rendu « Анди Тоттенсон живет в зоопарке. », le résumé l'a traduit, la
 * page l'a reçu. Cette famille de modèles hallucine sur le silence, souvent
 * dans une autre langue ou avec des formules de sous-titrage. Deux gardes,
 * volontairement simples et lisibles :
 *
 *   1. l'alphabet : pour une langue à écriture latine, un texte dont la
 *      majorité des lettres ne sont pas latines n'est pas ce qui a été dit ;
 *   2. les formules connues : « Sous-titres réalisés par la communauté
 *      d'Amara.org », « Merci d'avoir regardé »… seules ou presque.
 *
 * Un texte refusé n'entre pas dans la page et n'est pas résumé : la ligne
 * est marquée « aucune parole détectée », l'audio reste disponible.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type MotifRefus = 'vide' | 'alphabet' | 'hallucination';

export type Verdict = { ok: true } | { ok: false; motif: MotifRefus };

/** Langues dont l'écriture est latine — les seules où l'on peut juger l'alphabet. */
const LANGUES_LATINES = new Set([
  'fr',
  'en',
  'es',
  'pt',
  'it',
  'de',
  'nl',
  'ca',
  'ro',
  'pl',
  'cs',
  'sv',
  'da',
  'no',
  'fi',
  'hu',
  'tr',
  'ht',
]);

/** Sous-titrage, remerciements, invitations à s'abonner : le bruit de fond des corpus d'entraînement. */
const FORMULES_HALLUCINEES: readonly RegExp[] = [
  /sous[- ]titres? (réalisés?|par|fait) .*amara/iu,
  /amara\.org/iu,
  /sous[- ]titrage (st'? ?501|société radio-canada)/iu,
  /merci d'avoir regardé/iu,
  /n'oubliez pas de (vous abonner|liker)/iu,
  /abonnez[- ]vous/iu,
  /thank you for watching/iu,
  /subtitles by/iu,
];

export const PART_LATINE_MIN = 0.5;

export function verifierTexte(texte: string, language: string): Verdict {
  const propre = texte.trim();
  if (propre.length === 0) return { ok: false, motif: 'vide' };

  if (LANGUES_LATINES.has(language.toLowerCase().slice(0, 2))) {
    const lettres = propre.match(/\p{L}/gu) ?? [];
    if (lettres.length > 0) {
      const latines = lettres.filter((c) => /\p{Script=Latin}/u.test(c)).length;
      if (latines / lettres.length < PART_LATINE_MIN) return { ok: false, motif: 'alphabet' };
    }
  }

  // Une formule connue qui fait l'essentiel du texte : pas ce qui a été dit.
  for (const formule of FORMULES_HALLUCINEES) {
    const m = formule.exec(propre);
    if (m && (propre.length < 200 || m[0].length / propre.length > 0.5)) {
      return { ok: false, motif: 'hallucination' };
    }
  }
  return { ok: true };
}

export const MESSAGE_REFUS: Record<MotifRefus, string> = {
  vide: "Aucune parole détectée dans l'audio.",
  alphabet:
    "Aucune parole détectée : le moteur a rendu un texte dans un autre alphabet, signe d'un audio silencieux ou illisible.",
  hallucination:
    "Aucune parole détectée : le moteur a rendu une formule de sous-titrage, signe d'un audio silencieux ou illisible.",
};

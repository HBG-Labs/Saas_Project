/**
 * Typographie de locale, appliquée au texte AFFICHÉ (jamais au texte parlé ni
 * à la spec) juste avant la mise en forme. Règles déclaratives, versionnées :
 * leur version entre dans la provenance du Render Plan.
 *
 * Français (Imprimerie nationale, usage courant en édition) :
 * - espace fine insécable (U+202F) avant « ? ! ; » ;
 * - espace insécable (U+00A0) avant « : » ;
 * - guillemets « » avec espace fine insécable à l'intérieur ;
 * - apostrophe typographique ’ ;
 * - points de suspension … .
 * Une espace ordinaire déjà présente devant le signe est remplacée, jamais doublée.
 */
export const TYPOGRAPHY_RULES_VERSION = '1.0.0';

export const NBSP = ' ';
export const NNBSP = ' ';

export interface TypographyResult {
  text: string;
  /** Règles appliquées, dans l'ordre (traçabilité et tests). */
  applied: string[];
}

interface Rule {
  id: string;
  apply: (text: string) => string;
}

const FRENCH: readonly Rule[] = [
  { id: 'fr.ellipsis', apply: (t) => t.replace(/\.\.\./g, '…') },
  // Apostrophe entre deux lettres (l'eau, aujourd'hui) : ’.
  { id: 'fr.apostrophe', apply: (t) => t.replace(/(\p{L})'(?=\p{L})/gu, '$1’') },
  // Guillemets droits appariés → « » (espaces intérieures fines insécables).
  {
    id: 'fr.quotes',
    apply: (t) => t.replace(/"\s*([^"]*?)\s*"/g, `«${NNBSP}$1${NNBSP}»`),
  },
  // Guillemets français saisis avec des espaces ordinaires (ou sans espace).
  { id: 'fr.quote_open_space', apply: (t) => t.replace(/«[   ]*/g, `«${NNBSP}`) },
  { id: 'fr.quote_close_space', apply: (t) => t.replace(/[   ]*»/g, `${NNBSP}»`) },
  // Ponctuation haute : ? ! ; → fine insécable ; : → insécable. Pas après un chiffre
  // pour « : » (heures 10:30) ni pour une URL (://).
  { id: 'fr.high_punctuation', apply: (t) => t.replace(/(?<=\S)[   ]*([?!;])/gu, `${NNBSP}$1`) },
  { id: 'fr.colon', apply: (t) => t.replace(/(?<=[^\s\d])[   ]*:(?!\/\/)/gu, `${NBSP}:`) },
  // Suites de ponctuation (?!, ?!?) : une seule espace, devant la première.
  { id: 'fr.punctuation_runs', apply: (t) => t.replace(/([?!;:]) (?=[?!])/gu, '$1') },
];

const RULES: Record<string, readonly Rule[]> = { fr: FRENCH };

/** Langue principale d'une étiquette BCP 47 (fr-FR → fr). */
export const languageOf = (locale: string): string => locale.split('-')[0]!.toLowerCase();

/** Applique les règles de la langue ; une langue sans règles laisse le texte intact. */
export function applyTypography(text: string, locale: string): TypographyResult {
  const rules = RULES[languageOf(locale)] ?? [];
  const applied: string[] = [];
  let current = text;
  for (const rule of rules) {
    const next = rule.apply(current);
    if (next !== current) applied.push(rule.id);
    current = next;
  }
  return { text: current, applied };
}

const SPACES = /[   ]+$/;
const LEADING_SPACES = /^[   ]+/;

/**
 * Typographie d'un texte découpé en runs (l'accent est souvent un run à part :
 * « disparaissait » + « ? »). Les règles s'appliquent run par run, puis aux
 * frontières d'un même paragraphe : l'espace devant « ? » ou « » » appartient
 * toujours au run de la ponctuation, et les guillemets droits s'apparient
 * d'un run à l'autre.
 */
export function applyTypographyToRuns(runs: readonly { text: string; break_after: boolean }[], locale: string): { texts: string[]; applied: string[] } {
  if (!RULES[languageOf(locale)]) return { texts: runs.map((r) => r.text), applied: [] };
  const applied = new Set<string>();
  // 1. Guillemets droits appariés à travers les runs (ouvrant, fermant, ouvrant…).
  let open = false;
  const quoted = runs.map((r) =>
    r.text.replace(/ *" */g, (match, offset: number, whole: string) => {
      applied.add('fr.quotes');
      open = !open;
      const before = offset > 0 && match.startsWith(' ') ? ' ' : '';
      const after = offset + match.length < whole.length && match.endsWith(' ') ? ' ' : '';
      return open ? `${before}«${NNBSP}` : `${NNBSP}»${after}`;
    }),
  );
  // 2. Règles de la langue, run par run.
  const texts = quoted.map((text) => {
    const result = applyTypography(text, locale);
    result.applied.forEach((id) => applied.add(id));
    return result.text;
  });
  // 3. Frontières : la ponctuation haute ou le guillemet fermant en tête de run
  //    reprend l'espace insécable ; l'espace de fin du run précédent disparaît.
  for (let i = 1; i < texts.length; i++) {
    if (runs[i - 1]!.break_after) continue;
    const prev = texts[i - 1]!;
    const cur = texts[i]!;
    const head = cur.replace(LEADING_SPACES, '');
    const mark = head[0];
    if (mark === '?' || mark === '!' || mark === ';' || mark === '»' || (mark === ':' && !/\d$/.test(prev.replace(SPACES, '')))) {
      texts[i - 1] = prev.replace(SPACES, '');
      texts[i] = `${mark === ':' ? NBSP : NNBSP}${head}`;
      if (texts[i] !== cur || texts[i - 1] !== prev) applied.add('fr.run_boundary');
    }
    if (/«[   ]*$/.test(texts[i - 1]!)) {
      const fixedPrev = texts[i - 1]!.replace(/«[   ]*$/, `«${NNBSP}`);
      const fixedCur = texts[i]!.replace(LEADING_SPACES, '');
      if (fixedPrev !== texts[i - 1] || fixedCur !== texts[i]) applied.add('fr.run_boundary');
      texts[i - 1] = fixedPrev;
      texts[i] = fixedCur;
    }
  }
  return { texts, applied: [...applied].sort() };
}

/** Identifiant de provenance : « fr@1.0.0 », ou « none@1.0.0 » sans règles. */
export function typographyProvenance(locale: string): string {
  const language = languageOf(locale);
  return `${RULES[language] ? language : 'none'}@${TYPOGRAPHY_RULES_VERSION}`;
}

/**
 * Espaces sans possibilité de coupure. La coupure de ligne n'a lieu que sur
 * l'espace ordinaire U+0020 : jamais avant « ? », ni à l'intérieur de « ».
 */
export const NON_BREAKING = new Set([NBSP, NNBSP, ' ', '⁠']);

/**
 * Repli de glyphe déclaratif : si la police n'a pas l'espace fine insécable,
 * on retombe sur l'espace insécable (même comportement de coupure).
 * Aucun autre repli silencieux : un glyphe manquant est une erreur.
 */
export const GLYPH_FALLBACKS: Readonly<Record<string, string>> = { [NNBSP]: NBSP };

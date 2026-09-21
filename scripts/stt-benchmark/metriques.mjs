/**
 * Les mesures du benchmark STT — pures, testables sans réseau.
 *
 * Tout part d'une NORMALISATION commune (minuscules, accents conservés,
 * ponctuation retirée, nombres et unités laissés tels quels) pour que deux
 * moteurs ne soient pas départagés par des guillemets ou des majuscules. La
 * ponctuation est mesurée à part, parce qu'elle compte pour la lisibilité
 * mais ne doit pas polluer le WER.
 */

/** Minuscules, sans ponctuation, espaces normalisés. Les accents restent. */
export function normaliser(texte) {
  return (texte ?? '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(texte) {
  const n = normaliser(texte);
  return n.length === 0 ? [] : n.split(' ');
}

/**
 * Distance d'édition au mot, avec le détail substitutions / insertions /
 * suppressions (Levenshtein, backtrace). WER = (S + I + D) / N référence.
 */
export function wer(reference, hypothese) {
  const r = tokens(reference);
  const h = tokens(hypothese);
  const n = r.length;
  const m = h.length;
  // d[i][j] : coût pour r[0..i) et h[0..j)
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) d[i][0] = i;
  for (let j = 0; j <= m; j += 1) d[0][j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const sub = d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1);
      d[i][j] = Math.min(sub, d[i - 1][j] + 1, d[i][j - 1] + 1);
    }
  }
  // Backtrace pour compter S / I / D.
  let i = n;
  let j = m;
  let substitutions = 0;
  let insertions = 0;
  let suppressions = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1)) {
      if (r[i - 1] !== h[j - 1]) substitutions += 1;
      i -= 1;
      j -= 1;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      suppressions += 1;
      i -= 1;
    } else {
      insertions += 1;
      j -= 1;
    }
  }
  const erreurs = substitutions + insertions + suppressions;
  return {
    reference_mots: n,
    hypothese_mots: m,
    substitutions,
    insertions,
    suppressions,
    erreurs,
    wer: n === 0 ? (m === 0 ? 0 : 1) : erreurs / n,
  };
}

/**
 * Un terme est « reconnu » si sa forme normalisée apparaît dans l'hypothèse
 * normalisée, comme suite de mots entière. « 36FO » et « 36 FO » sont
 * assimilés : la référence est humaine, le moteur peut coller ou séparer.
 */
export function termeReconnu(terme, hypothese) {
  const h = ` ${normaliser(hypothese)} `;
  const t = normaliser(terme);
  if (t.length === 0) return false;
  const variantes = new Set([
    t,
    t.replace(/(\d)\s+(\p{L})/gu, '$1$2'),
    t.replace(/(\d)(\p{L})/gu, '$1 $2'),
    t.replace(/(\p{L})\s+(\d)/gu, '$1$2'),
    t.replace(/(\p{L})(\d)/gu, '$1 $2'),
  ]);
  for (const v of variantes) {
    if (h.includes(` ${v} `)) return true;
    if (h.replace(/-/g, ' ').includes(` ${v.replace(/-/g, ' ')} `)) return true;
  }
  return false;
}

/** Rappel d'une liste de termes attendus : reconnus / attendus, avec le détail. */
export function rappel(termes, hypothese) {
  const attendus = [...new Set(termes.map((t) => t.trim()).filter(Boolean))];
  const reconnus = attendus.filter((t) => termeReconnu(t, hypothese));
  return {
    attendus: attendus.length,
    reconnus: reconnus.length,
    manques: attendus.filter((t) => !reconnus.includes(t)),
    rappel: attendus.length === 0 ? null : reconnus.length / attendus.length,
  };
}

/** Les nombres de la référence : entiers, décimaux (virgule ou point), pourcentages, montants. */
export function nombresDe(texte) {
  const out = [];
  for (const m of (texte ?? '').matchAll(/\d+(?:[.,]\d+)?/g)) out.push(m[0]);
  return [...new Set(out)];
}

/**
 * Les références de la référence : jetons mêlant lettres et chiffres, ou
 * codes avec tirets (« 36FO », « PTO-12 », « NF C 15-100 » repéré par
 * ses parties « C 15-100 »).
 */
export function referencesDe(texte) {
  const out = new Set();
  for (const m of (texte ?? '').matchAll(
    /\b(?=[\p{L}\d-]*\d)(?=[\p{L}\d-]*\p{L})[\p{L}\d][\p{L}\d-]{1,}\b/gu,
  ))
    out.add(m[0]);
  for (const m of (texte ?? '').matchAll(/\b\d+-\d+\b/g)) out.add(m[0]);
  return [...out];
}

/**
 * Noms propres, heuristique : mots capitalisés qui ne commencent pas une
 * phrase. À remplacer par la liste du fichier `.meta.json` dès qu'elle
 * existe — l'heuristique rate les noms en début de phrase et prend les
 * sigles pour des noms.
 */
export function nomsPropresDe(texte) {
  const out = new Set();
  const phrases = (texte ?? '').split(/(?<=[.!?])\s+/);
  for (const phrase of phrases) {
    const mots = phrase.trim().split(/\s+/);
    for (let k = 1; k < mots.length; k += 1) {
      const mot = mots[k].replace(/[«»"(),;:!?.]/g, '');
      if (/^\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)*$/u.test(mot)) out.add(mot);
    }
  }
  return [...out];
}

/**
 * Ponctuation : le rapport entre les signes de fin de phrase de l'hypothèse
 * et ceux de la référence, borné à 1 dans les deux sens. 1 = même densité ;
 * 0 = aucune ponctuation là où la référence en a.
 */
export function scorePonctuation(reference, hypothese) {
  const compte = (t) => ((t ?? '').match(/[.!?]/g) ?? []).length;
  const r = compte(reference);
  const h = compte(hypothese);
  if (r === 0) return h === 0 ? 1 : null;
  return Math.max(0, 1 - Math.abs(h - r) / r);
}

export function mediane(valeurs) {
  const v = valeurs.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function moyenne(valeurs) {
  const v = valeurs.filter((x) => typeof x === 'number' && !Number.isNaN(x));
  return v.length === 0 ? null : v.reduce((a, b) => a + b, 0) / v.length;
}

/** Toutes les mesures d'une hypothèse contre une référence et ses attendus. */
export function mesurer({ reference, hypothese, termes = [], noms = [], nombres, references }) {
  const w = wer(reference, hypothese);
  return {
    ...w,
    termes: rappel(termes, hypothese),
    noms: rappel(noms, hypothese),
    nombres: rappel(nombres ?? nombresDe(reference), hypothese),
    references: rappel(references ?? referencesDe(reference), hypothese),
    ponctuation: scorePonctuation(reference, hypothese),
  };
}

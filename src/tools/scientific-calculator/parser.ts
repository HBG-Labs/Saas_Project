/**
 * Analyseur d'expressions mathématiques.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER EXISTE
 *
 * La version précédente évaluait l'expression avec `new Function(...)`. C'est
 * commode et c'est faux : cela exécute du CODE, pas un calcul. Tant que la
 * saisie reste locale, l'utilisateur ne peut nuire qu'à lui-même — mais dès que
 * l'historique des calculs sera partagé au sein d'une organisation, une
 * expression enregistrée par l'un s'exécuterait dans le navigateur de l'autre.
 *
 * Un analyseur ne peut produire qu'un nombre. Il ne connaît ni `fetch`, ni
 * `document`, ni `localStorage` : ces mots n'existent tout simplement pas dans
 * sa grammaire. La sécurité ne vient pas d'un filtrage — toujours contournable —
 * mais de ce que la machine est incapable d'exprimer.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Descente récursive avec priorités, sur la grammaire suivante :
 *
 *   additive       := multiplicative (('+' | '-') multiplicative)*
 *   multiplicative := unary (('*' | '/') unary)*
 *   unary          := ('-' | '+') unary | power
 *   power          := primary ('**' unary)?          — associatif à DROITE
 *   primary        := nombre | constante | fonction '(' additive ')' | '(' additive ')'
 *
 * `unary` est placé AU-DESSUS de `power` : `-2 ** 2` vaut donc `-(2 ** 2)`,
 * soit −4, comme en mathématiques — et non `(-2) ** 2`. JavaScript, lui, refuse
 * purement et simplement d'interpréter cette écriture.
 */

export type UnaryFn = (x: number) => number;

export interface ParserContext {
  functions: Readonly<Record<string, UnaryFn>>;
  constants: Readonly<Record<string, number>>;
}

export class ExpressionError extends Error {}

// -----------------------------------------------------------------------------
// Lexeur
// -----------------------------------------------------------------------------

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '**' }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index] ?? '';

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    // Nombres : `12`, `3.5`, `.5`. Notation exponentielle exclue — `1e3` serait
    // ambigu avec la constante `e`, et personne ne la saisit sur un pavé.
    if (/[0-9.]/.test(char)) {
      let raw = '';
      while (index < input.length && /[0-9.]/.test(input[index] ?? '')) {
        raw += input[index];
        index += 1;
      }

      const value = Number(raw);
      if (Number.isNaN(value)) {
        throw new ExpressionError(`Nombre invalide : ${raw}`);
      }

      tokens.push({ kind: 'number', value });
      continue;
    }

    if (/[a-zA-Z]/.test(char)) {
      let raw = '';
      while (index < input.length && /[a-zA-Z]/.test(input[index] ?? '')) {
        raw += input[index];
        index += 1;
      }
      tokens.push({ kind: 'ident', value: raw });
      continue;
    }

    if (char === '*' && input[index + 1] === '*') {
      tokens.push({ kind: 'op', value: '**' });
      index += 2;
      continue;
    }

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ kind: 'op', value: char });
      index += 1;
      continue;
    }

    if (char === '(') {
      tokens.push({ kind: 'lparen' });
      index += 1;
      continue;
    }

    if (char === ')') {
      tokens.push({ kind: 'rparen' });
      index += 1;
      continue;
    }

    // Tout le reste est refusé plutôt qu'ignoré. Ignorer un caractère inconnu
    // reviendrait à calculer autre chose que ce qui est écrit — et à l'annoncer
    // avec l'aplomb d'un résultat juste.
    throw new ExpressionError(`Caractère inattendu : ${char}`);
  }

  return tokens;
}

// -----------------------------------------------------------------------------
// Analyseur
// -----------------------------------------------------------------------------

export function evaluateExpression(input: string, context: ParserContext): number {
  const tokens = tokenize(input);
  let position = 0;

  const peek = (): Token | undefined => tokens[position];

  const parseAdditive = (): number => {
    let left = parseMultiplicative();

    for (;;) {
      const token = peek();
      if (token?.kind !== 'op' || (token.value !== '+' && token.value !== '-')) break;

      position += 1;
      const right = parseMultiplicative();
      left = token.value === '+' ? left + right : left - right;
    }

    return left;
  };

  const parseMultiplicative = (): number => {
    let left = parseUnary();

    for (;;) {
      const token = peek();
      if (token?.kind !== 'op' || (token.value !== '*' && token.value !== '/')) break;

      position += 1;
      const right = parseUnary();
      // La division par zéro n'est pas interceptée : elle produit `Infinity`,
      // que l'appelant sait déjà présenter. Lever ici obligerait à distinguer
      // deux chemins d'erreur pour un même cas.
      left = token.value === '*' ? left * right : left / right;
    }

    return left;
  };

  const parseUnary = (): number => {
    const token = peek();

    if (token?.kind === 'op' && (token.value === '-' || token.value === '+')) {
      position += 1;
      const value = parseUnary();
      return token.value === '-' ? -value : value;
    }

    return parsePower();
  };

  const parsePower = (): number => {
    const base = parsePrimary();
    const token = peek();

    if (token?.kind === 'op' && token.value === '**') {
      position += 1;
      // `parseUnary` et non `parsePower` : l'exposant peut être négatif
      // (`2 ** -3`), et l'associativité reste à droite (`2 ** 3 ** 2` = 2⁹).
      return base ** parseUnary();
    }

    return base;
  };

  const parsePrimary = (): number => {
    const token = peek();

    if (token === undefined) {
      throw new ExpressionError('Expression incomplète');
    }

    if (token.kind === 'number') {
      position += 1;
      return token.value;
    }

    if (token.kind === 'lparen') {
      position += 1;
      const value = parseAdditive();

      if (peek()?.kind !== 'rparen') {
        throw new ExpressionError('Parenthèse fermante manquante');
      }
      position += 1;

      return value;
    }

    if (token.kind === 'ident') {
      position += 1;

      /**
       * `Object.hasOwn` et non un simple accès indexé.
       *
       * Un objet littéral hérite de `Object.prototype` : `constants['constructor']`
       * renvoie la fonction `Object`, `constants['toString']` une méthode, et
       * `undefined` n'est jamais atteint. Un test l'a démontré — l'expression
       * `constructor` était acceptée et renvoyait un constructeur en guise de
       * nombre.
       *
       * C'est exactement le trou que cet analyseur devait fermer, reproduit à
       * l'identique par une recherche naïve.
       */
      if (Object.hasOwn(context.constants, token.value)) {
        const constant = context.constants[token.value];
        if (typeof constant === 'number') return constant;
      }

      if (Object.hasOwn(context.functions, token.value)) {
        const fn = context.functions[token.value];
        if (typeof fn !== 'function') {
          throw new ExpressionError(`Symbole inconnu : ${token.value}`);
        }
        if (peek()?.kind !== 'lparen') {
          throw new ExpressionError(`Parenthèse attendue après ${token.value}`);
        }
        position += 1;

        const argument = parseAdditive();

        if (peek()?.kind !== 'rparen') {
          throw new ExpressionError(`Parenthèse fermante manquante après ${token.value}`);
        }
        position += 1;

        return fn(argument);
      }

      // Un identifiant absent du contexte est une erreur, jamais une variable
      // implicite. C'est ce refus qui garantit qu'aucun nom du navigateur —
      // `window`, `fetch` — ne puisse être atteint : ils n'existent pas ici.
      throw new ExpressionError(`Symbole inconnu : ${token.value}`);
    }

    throw new ExpressionError('Expression malformée');
  };

  const result = parseAdditive();

  if (position < tokens.length) {
    throw new ExpressionError('Expression malformée');
  }

  return result;
}

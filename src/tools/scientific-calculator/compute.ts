import { evaluateExpression } from './parser';

export interface ScientificCalculatorResult {
  expression: string;
  result: number | null;
  formattedResult: string;
  angleUnit: 'deg' | 'rad';
  error: string | null;
}

export function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n === 0 || n === 1) return 1;
  if (n > 170) return Infinity;
  let res = 1;
  for (let i = 2; i <= n; i++) {
    res *= i;
  }
  return res;
}

/**
 * Nettoie une expression incomplète lors de la frappe en direct
 * (ex: "12 +" => "12", "sin(45 +" => "sin(45)")
 */
function sanitizeIncompleteExpression(expr: string): string {
  let cleaned = expr.trim();

  // Supprime les opérateurs pendants à la fin (ex: +, -, *, /, ^)
  cleaned = cleaned.replace(/[\s+*/^−÷×-]+$/, '');

  // Supprime les parenthèses ouvrantes ou fonctions incomplètes en fin de chaîne (ex: "sin(")
  cleaned = cleaned.replace(/(sin|cos|tan|asin|acos|atan|sqrt|cbrt|log|ln|abs|fact)\($/i, '');

  return cleaned;
}

export function evaluateScientificExpression(
  expr: string,
  angleUnit: 'deg' | 'rad' = 'deg',
  isStrict = false,
): ScientificCalculatorResult {
  if (!expr || expr.trim() === '') {
    return {
      expression: '',
      result: 0,
      formattedResult: '0',
      angleUnit,
      error: null,
    };
  }

  // En mode évaluation continue (pendant la frappe), on nettoie les opérateurs en attente
  const targetExpr = isStrict ? expr : sanitizeIncompleteExpression(expr);

  if (!targetExpr) {
    return {
      expression: expr,
      result: 0,
      formattedResult: '0',
      angleUnit,
      error: null,
    };
  }

  try {
    let sanitized = targetExpr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/%/g, '*0.01')
      .replace(/π/g, 'pi')
      .replace(/\^/g, '**');

    // Auto-fermeture des parenthèses manquantes
    const openParens = (sanitized.match(/\(/g) || []).length;
    const closeParens = (sanitized.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      sanitized += ')'.repeat(openParens - closeParens);
    }

    // Multiplication implicite : 2(3) => 2*(3), 3pi => 3*pi, 5sin( => 5*sin(
    sanitized = sanitized
      .replace(/(\d)(\()/g, '$1*$2')
      .replace(/(\))(\d|\()/g, '$1*$2')
      .replace(/(\d)(pi|e|c|sin|cos|tan|asin|acos|atan|sqrt|log|ln|abs|fact)/g, '$1*$2')
      .replace(/(\))(pi|e|c|sin|cos|tan|asin|acos|atan|sqrt|log|ln|abs|fact)/g, '$1*$2');

    // Remplacement du factoriel : n! ou (expr)! => fact(n)
    sanitized = sanitized.replace(/(\d+|\([^()]+\))!/g, 'fact($1)');

    const toRad = (x: number) => (angleUnit === 'deg' ? (x * Math.PI) / 180 : x);
    const fromRad = (x: number) => (angleUnit === 'deg' ? (x * 180) / Math.PI : x);

    /**
     * Fonctions et constantes reconnues — la TOTALITÉ du vocabulaire.
     *
     * L'analyseur refuse tout identifiant absent de ces deux tables. C'est
     * là que réside la sécurité : `fetch`, `window` ou `localStorage` ne sont
     * pas filtrés, ils n'existent simplement pas dans cette grammaire.
     */
    const functions = {
      sin: (x: number) => Math.sin(toRad(x)),
      cos: (x: number) => Math.cos(toRad(x)),
      tan: (x: number) => Math.tan(toRad(x)),
      asin: (x: number) => fromRad(Math.asin(x)),
      acos: (x: number) => fromRad(Math.acos(x)),
      atan: (x: number) => fromRad(Math.atan(x)),
      sqrt: (x: number) => Math.sqrt(x),
      cbrt: (x: number) => Math.cbrt(x),
      log: (x: number) => Math.log10(x),
      ln: (x: number) => Math.log(x),
      abs: (x: number) => Math.abs(x),
      fact: factorial,
    };

    const constants = {
      pi: Math.PI,
      e: Math.E,
      /** Vitesse de la lumière — utile pour les calculs de propagation optique. */
      c: 299792458,
    };

    const val: unknown = evaluateExpression(sanitized, { functions, constants });

    if (typeof val !== 'number' || Number.isNaN(val)) {
      return {
        expression: expr,
        result: null,
        formattedResult: isStrict ? 'Erreur' : '0',
        angleUnit,
        error: isStrict ? 'Calcul indéfini ou division par zéro' : null,
      };
    }

    if (!Number.isFinite(val)) {
      return {
        expression: expr,
        result: null,
        formattedResult: 'Infini',
        angleUnit,
        error: 'Résultat hors limites',
      };
    }

    const rounded = Number(Math.abs(val) < 1e-14 ? 0 : val);

    let formatted: string;
    if (Math.abs(rounded) > 1e12 || (Math.abs(rounded) < 1e-6 && rounded !== 0)) {
      formatted = rounded.toExponential(6);
    } else {
      formatted = Number(rounded.toFixed(8)).toString();
    }

    return {
      expression: expr,
      result: rounded,
      formattedResult: formatted,
      angleUnit,
      error: null,
    };
  } catch {
    return {
      expression: expr,
      result: null,
      formattedResult: isStrict ? 'Erreur' : '0',
      angleUnit,
      error: isStrict ? 'Erreur de syntaxe dans l’expression' : null,
    };
  }
}

import catalogSql from '../../supabase/migrations/20260808100000_catalog_v2.sql?raw';
import rbacSql from '../../supabase/migrations/20260808100100_rbac.sql?raw';
import billingSql from '../../supabase/migrations/20260808100300_billing.sql?raw';
import missionsSql from '../../supabase/migrations/20260808100500_missions.sql?raw';
import rbacCustomersSql from '../../supabase/migrations/20260809100300_rbac_customers.sql?raw';
import closureSql from '../../supabase/migrations/20260809100400_closure_entitlements.sql?raw';
import ultimateSql from '../../supabase/migrations/20260812100100_ultimate_plan.sql?raw';
import equipmentSql from '../../supabase/migrations/20260812100300_equipment.sql?raw';
import quotesSql from '../../supabase/migrations/20260812100400_quotes.sql?raw';
import industriesSql from '../../supabase/migrations/20260815100000_industries.sql?raw';
import planningSql from '../../supabase/migrations/20260816100000_planning.sql?raw';
import locationsSql from '../../supabase/migrations/20260816100100_technician_locations.sql?raw';
import retireTrackingSql from '../../supabase/migrations/20260817100000_retire_live_tracking.sql?raw';
import pricingModelSql from '../../supabase/migrations/20260817101000_pricing_model.sql?raw';
import stockSql from '../../supabase/migrations/20260820110000_stock.sql?raw';
import purchasesSql from '../../supabase/migrations/20260821100000_purchases.sql?raw';
import planMatrixSql from '../../supabase/migrations/20260902100000_realigne_la_matrice_des_formules.sql?raw';
import attachmentsInProSql from '../../supabase/migrations/20260902130000_attachments_in_pro.sql?raw';

/**
 * Lecture des migrations SQL depuis les tests.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CES TESTS EXISTENT
 *
 * Plusieurs constantes TypeScript reflètent des tables seedées en SQL : les
 * catégories, la matrice RBAC, les transitions de missions, les entitlements.
 * Un miroir qui diverge est PIRE que pas de miroir — il répond faux avec
 * assurance : une action proposée que le serveur refusera, ou masquée alors
 * qu'elle est permise.
 *
 * Plutôt que de compter sur la discipline, les tests lisent le SQL et comparent.
 * Modifier l'un sans l'autre casse `npm test`. Même logique que les frontières
 * d'architecture appliquées par ESLint : une convention non outillée finit
 * toujours par être contournée sous la pression du délai.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Les fichiers sont chargés par l'import `?raw` de Vite plutôt que par
 * `node:fs`. Ce n'est pas un détail : `tsconfig.app.json` exclut délibérément
 * les types Node de la couche applicative, et les réintroduire pour un helper
 * de test ferait entrer `process` et `fs` dans l'autocomplétion de tout le code
 * navigateur.
 */

const MIGRATIONS: Record<string, string> = {
  catalog: catalogSql,
  rbac: rbacSql,
  billing: billingSql,
  missions: missionsSql,
  rbacCustomers: rbacCustomersSql,
  closure: closureSql,
  ultimate: ultimateSql,
  equipment: equipmentSql,
  quotes: quotesSql,
  industries: industriesSql,
  planning: planningSql,
  locations: locationsSql,
  retireTracking: retireTrackingSql,
  pricingModel: pricingModelSql,
  stock: stockSql,
  purchases: purchasesSql,
  planMatrix: planMatrixSql,
  attachmentsInPro: attachmentsInProSql,
};

export const MIGRATION_FILES = {
  catalog: 'catalog',
  rbac: 'rbac',
  billing: 'billing',
  missions: 'missions',
  rbacCustomers: 'rbacCustomers',
  closure: 'closure',
  ultimate: 'ultimate',
  equipment: 'equipment',
  quotes: 'quotes',
  industries: 'industries',
  planning: 'planning',
  locations: 'locations',
  retireTracking: 'retireTracking',
  pricingModel: 'pricingModel',
  stock: 'stock',
  purchases: 'purchases',
  planMatrix: 'planMatrix',
  attachmentsInPro: 'attachmentsInPro',
} as const;

/**
 * Tuples d'un `insert into <table>` cumulés sur PLUSIEURS migrations.
 *
 * Une table de référence n'est pas forcément peuplée d'un seul tenant : les
 * permissions « customer.* », la transition de clôture et l'entitlement du
 * module Clients sont arrivés après coup, dans leurs propres fichiers. Un test
 * ne lisant que la migration d'origine conclurait à une divergence du miroir
 * TypeScript alors que c'est SA vision du SQL qui est incomplète — le pire des
 * verdicts, puisqu'il pousse à « corriger » du code juste.
 */
export function extractInsertTuplesAcross(
  keys: readonly (keyof typeof MIGRATION_FILES)[],
  table: string,
): string[][] {
  return keys.flatMap((key) => extractInsertTuples(readMigration(key), table));
}

/**
 * Valeurs RETIRÉES d'une table de référence par un `delete ... where <col> = '...'`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE COMPLÉMENT EST NÉCESSAIRE
 *
 * `extractInsertTuplesAcross` reconstitue l'état d'une table en cumulant les
 * `insert`. Cela suppose qu'une ligne semée y reste — vrai jusqu'au jour où une
 * capacité est ABANDONNÉE. Le retrait du suivi GPS supprime `location.view_all`
 * de `role_permissions` et `live_tracking` de `plan_features`.
 *
 * Sans lire les suppressions, le miroir TypeScript — qui, lui, est à jour —
 * paraîtrait incomplet, et le test réclamerait la réintroduction d'un droit que
 * le produit vient de retirer. C'est le pire verdict possible : il pousse à
 * « corriger » du code juste.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function extractDeletedValuesAcross(
  keys: readonly (keyof typeof MIGRATION_FILES)[],
  table: string,
  column: string,
): Set<string> {
  const deleted = new Set<string>();
  const pattern = new RegExp(
    `delete\\s+from\\s+(?:public\\.)?${table}\\s+where\\s+${column}\\s*=\\s*'([^']+)'`,
    'gi',
  );

  for (const key of keys) {
    const sql = readMigration(key);
    for (const match of sql.matchAll(pattern)) {
      if (match[1] !== undefined) deleted.add(match[1]);
    }
  }

  return deleted;
}

export function readMigration(key: keyof typeof MIGRATION_FILES): string {
  const sql = MIGRATIONS[key];

  if (sql === undefined || sql.trim() === '') {
    throw new Error(
      `Migration « ${key} » introuvable ou vide. Vérifiez les imports ?raw de sql-fixtures.ts.`,
    );
  }

  return sql;
}

/**
 * Extrait les tuples d'un `insert into <table> ... values (...), (...);`.
 *
 * Analyseur volontairement minimal — il ne couvre que la forme utilisée par nos
 * seeds. Il traite en revanche ce qui produirait de FAUX résultats plutôt que
 * des erreurs visibles : les quotes doublées (`''` en SQL), les virgules et
 * parenthèses à l'intérieur des chaînes, et les commentaires `--`.
 *
 * Renvoie, pour chaque ligne, la liste de ses valeurs brutes.
 */
export function extractInsertTuples(sql: string, table: string): string[][] {
  const pattern = new RegExp(
    `insert\\s+into\\s+(?:public\\.)?${table}\\s*\\([^)]*\\)\\s*values\\s*`,
    'i',
  );

  const match = pattern.exec(sql);
  if (!match) return [];

  const body = sql.slice(match.index + match[0].length);

  const tuples: string[][] = [];
  let current: string[] = [];
  let value = '';
  let depth = 0;
  let inString = false;
  let index = 0;

  while (index < body.length) {
    const char = body[index];
    const next = body[index + 1];

    if (inString) {
      // `''` à l'intérieur d'une chaîne SQL est une apostrophe échappée,
      // pas une fin de chaîne suivie d'un début.
      if (char === "'" && next === "'") {
        value += "'";
        index += 2;
        continue;
      }
      if (char === "'") {
        inString = false;
        index += 1;
        continue;
      }
      value += char;
      index += 1;
      continue;
    }

    if (char === '-' && next === '-') {
      const lineEnd = body.indexOf('\n', index);
      index = lineEnd === -1 ? body.length : lineEnd + 1;
      continue;
    }

    if (char === "'") {
      inString = true;
      index += 1;
      continue;
    }

    if (char === '(') {
      depth += 1;
      if (depth > 1) value += char;
      index += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        current.push(value.trim());
        tuples.push(current);
        current = [];
        value = '';
      } else {
        value += char;
      }
      index += 1;
      continue;
    }

    if (char === ',' && depth === 1) {
      current.push(value.trim());
      value = '';
      index += 1;
      continue;
    }

    if (depth > 0) {
      value += char;
      index += 1;
      continue;
    }

    // Hors parenthèses, seuls les blancs et les virgules séparant deux tuples
    // sont attendus. Tout autre caractère signale la fin de la liste : `;`, ou
    // une clause `on conflict (...)` — dont les parenthèses seraient sinon
    // lues comme un tuple supplémentaire.
    if (!/\s|,/.test(char ?? '')) break;

    index += 1;
  }

  return tuples;
}

/** Retire les suffixes de cast (`'active'::public.content_status` → `active`). */
export function stripCast(value: string): string {
  return value.replace(/::[a-z_.]+$/i, '').trim();
}

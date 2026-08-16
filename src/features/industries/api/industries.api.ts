import { supabase, unwrap } from '@/services/supabase';
import {
  DEFAULT_VOCABULARY,
  isIndustryCode,
  type IndustryCode,
  type IndustryVocabulary,
} from '@/config/industries';

/**
 * Accès au référentiel des métiers.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UNE TABLE PUBLIQUE, ET C'EST VOULU
 *
 * `industries` est lisible par `anon` : la page de création d'entreprise doit
 * proposer la liste des métiers, et elle est accessible avant toute session.
 * Le référentiel ne contient aucune donnée d'entreprise — il n'y a rien à
 * protéger, et le protéger obligerait à dupliquer la liste côté client.
 *
 * Aucune écriture : la table n'a pas de policy pour cela. Un métier s'ajoute
 * par migration, versionné avec le code qui l'exploite.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface Industry {
  code: IndustryCode;
  label: string;
  description: string | null;
  icon: string;
  sortOrder: number;
  vocabulary: IndustryVocabulary;
  /** Clés supplémentaires du `vocabulary` : pluriels irréguliers, notamment. */
  overrides: Record<string, string>;
}

/**
 * Le `vocabulary` arrive en `jsonb`, donc en `unknown` du point de vue des
 * types. On ne le fait pas confiance : une clé absente ou d'un mauvais type
 * retombe sur le libellé par défaut plutôt que d'afficher `undefined` dans
 * l'interface.
 */
function toVocabulary(raw: unknown): IndustryVocabulary {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_VOCABULARY;

  const source = raw as Record<string, unknown>;
  const read = (key: keyof IndustryVocabulary): string =>
    typeof source[key] === 'string' && source[key] !== '' ? source[key] : DEFAULT_VOCABULARY[key];

  return { worker: read('worker'), job: read('job'), visit: read('visit') };
}

/** Les clés du `vocabulary` qui ne sont pas l'un des trois termes typés. */
function toOverrides(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null) return {};

  const known = new Set(['worker', 'job', 'visit']);
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.has(key) && typeof value === 'string') out[key] = value;
  }
  return out;
}

export async function listIndustries(): Promise<Industry[]> {
  const rows = await unwrap(
    supabase
      .from('industries')
      .select('code, label, description, icon, sort_order, vocabulary')
      .order('sort_order', { ascending: true }),
  );

  // Un code présent en base mais absent du miroir TypeScript est écarté : le
  // reste du code le traiterait comme inconnu de toute façon, et l'afficher
  // laisserait choisir un métier que rien n'exploite. Le test
  // `industries.test.ts` rend ce cas normalement impossible.
  return rows.filter((row) => isIndustryCode(row.code)).map((row) => ({
    code: row.code as IndustryCode,
    label: row.label,
    description: row.description,
    icon: row.icon,
    sortOrder: row.sort_order,
    vocabulary: toVocabulary(row.vocabulary),
    overrides: toOverrides(row.vocabulary),
  }));
}

export interface InterventionType {
  id: string;
  industryCode: string;
  code: string;
  label: string;
  description: string | null;
  icon: string;
}

/**
 * Types d'intervention proposables à une organisation.
 *
 * Le métier de l'entreprise, PLUS le socle `general` : une entreprise
 * spécialisée enregistre aussi des visites techniques et des dépannages sans
 * caractère métier. Le trigger `missions_intervention_type_matches_industry`
 * applique exactement la même règle côté serveur — ce filtre n'est qu'un
 * confort de saisie, jamais une barrière.
 */
export async function listInterventionTypes(industry: string): Promise<InterventionType[]> {
  const codes = industry === 'general' ? ['general'] : [industry, 'general'];

  const rows = await unwrap(
    supabase
      .from('intervention_types')
      .select('id, industry_code, code, label, description, icon')
      .in('industry_code', codes)
      .order('industry_code', { ascending: false })
      .order('sort_order', { ascending: true }),
  );

  return rows.map((row) => ({
    id: row.id,
    industryCode: row.industry_code,
    code: row.code,
    label: row.label,
    description: row.description,
    icon: row.icon,
  }));
}

export interface EquipmentCategoryRef {
  id: string;
  industryCode: string | null;
  code: string;
  label: string;
  icon: string;
}

/**
 * Catégories de matériel proposables à une organisation.
 *
 * Celles du métier, PLUS les communes (`industry_code` nul) : « Sécurité &
 * EPI » ou « Outillage à main » sont les mêmes partout.
 *
 * Contrairement aux types d'intervention, aucun trigger ne restreint le
 * classement du matériel au métier de l'organisation. C'est délibéré : on RANGE
 * un outil, on ne l'AUTORISE pas. Une entreprise de fibre qui possède un
 * détecteur de fuite doit pouvoir le classer comme tel.
 */
export async function listEquipmentCategories(
  industry: string | null,
): Promise<EquipmentCategoryRef[]> {
  let query = supabase
    .from('equipment_categories')
    .select('id, industry_code, code, label, icon')
    .order('sort_order', { ascending: true });

  // `or` plutôt que deux requêtes : les communes et celles du métier forment
  // une seule liste, triée d'un bloc par ordre d'affichage.
  query =
    industry === null || industry === 'general'
      ? query.is('industry_code', null)
      : query.or(`industry_code.is.null,industry_code.eq.${industry}`);

  const rows = await unwrap(query);

  return rows.map((row) => ({
    id: row.id,
    industryCode: row.industry_code,
    code: row.code,
    label: row.label,
    icon: row.icon,
  }));
}

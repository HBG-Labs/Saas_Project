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
  }));
}

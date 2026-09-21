import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import { construirePromptStt } from './stt-glossary.ts';

/**
 * La phrase de contexte d'une organisation pour la chaîne v2 : son
 * dictionnaire (phase 6) en tête, puis le glossaire de son secteur.
 *
 * Le worker lit par `organization_id` explicite, jamais tout : le dictionnaire
 * d'une entreprise ne sert qu'à elle. Les types les plus spécifiques passent
 * d'abord — un nom de client mal transcrit coûte plus qu'un terme technique —
 * et on s'arrête à 150 termes : au-delà, la limite de longueur du prompt les
 * ferait tomber de toute façon.
 */

export const ORDRE_TYPES: readonly string[] = [
  'client',
  'site',
  'personne',
  'lieu',
  'materiel',
  'technique',
  'autre',
];
export const TERMES_MAX = 150;

export async function chargerTermesOrganisation(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from('organization_vocabulary')
    .select('term, type')
    .eq('organization_id', organizationId)
    .limit(500);
  if (error || !data) return [];
  const rows = data as Array<{ term: string; type: string }>;
  const rang = (t: string) => {
    const i = ORDRE_TYPES.indexOf(t);
    return i === -1 ? ORDRE_TYPES.length : i;
  };
  return rows
    .sort((a, b) => rang(a.type) - rang(b.type) || a.term.localeCompare(b.term, 'fr'))
    .map((r) => r.term)
    .slice(0, TERMES_MAX);
}

export async function contexteOrganisation(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string> {
  const [{ data: org }, termes] = await Promise.all([
    admin.from('organizations').select('industry').eq('id', organizationId).maybeSingle(),
    chargerTermesOrganisation(admin, organizationId),
  ]);
  const industry = (org as { industry?: string | null } | null)?.industry ?? null;
  return construirePromptStt({ industry, termesSupplementaires: termes });
}

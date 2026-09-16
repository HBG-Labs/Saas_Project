import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { ProspectDetail, ProspectFollowup, ProspectListRow, ProspectNote } from '@/types/domain';
import type { ProspectStatus } from '@/types/database';

/**
 * Accès aux données de Prospect Radar — module INTERNE, réservé aux
 * administrateurs plateforme (`platform_admins`/`prospecting.view`).
 *
 * Aucune fonction ici ne prend d'`organizationId` : ces tables n'appartiennent
 * à aucun tenant (voir `README-PROSPECT-RADAR.md`). La RLS refuse déjà tout
 * client REZO360 ; ce fichier ne fait qu'exprimer les requêtes, jamais un
 * filtre de sécurité supplémentaire ne doit être ajouté ici — il vivrait au
 * mauvais endroit.
 */

// -----------------------------------------------------------------------------
// Statut administrateur plateforme
// -----------------------------------------------------------------------------

export interface PlatformAdminStatus {
  isAdmin: boolean;
  permissions: string[];
}

/**
 * Lit `platform_admins`/`platform_admin_permissions` DIRECTEMENT (pas de RPC) :
 * chaque table porte une policy `select` restreinte à sa propre ligne
 * (`user_id = auth.uid()`), posée précisément pour ce contrôle côté client —
 * voir Phase 2. Une absence de ligne, jamais une erreur, signifie « pas
 * administrateur ».
 */
export async function checkPlatformAdminStatus(userId: string): Promise<PlatformAdminStatus> {
  const admin = await unwrapMaybe(
    supabase.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
  );
  if (!admin) return { isAdmin: false, permissions: [] };

  const rows = await unwrap(
    supabase.from('platform_admin_permissions').select('permission').eq('user_id', userId),
  );
  return { isAdmin: true, permissions: rows.map((row) => row.permission) };
}

// -----------------------------------------------------------------------------
// Tableau de bord
// -----------------------------------------------------------------------------

export interface ProspectingDashboardStats {
  total: number;
  detected_today: number;
  score_tiers: { forte: number; moyenne: number; basse: number };
  by_status: Partial<Record<ProspectStatus, number>>;
  by_zone: Record<string, number>;
}

/**
 * Compteurs agrégés — jamais une ligne de `prospects` chargée pour les
 * calculer (§29 : ne jamais charger toute la base en navigateur).
 */
export async function getProspectingDashboardStats(): Promise<ProspectingDashboardStats> {
  return unwrap(
    supabase.rpc('prospecting_dashboard_stats').single<ProspectingDashboardStats>(),
  );
}

// -----------------------------------------------------------------------------
// Liste, filtrée et paginée par la base
// -----------------------------------------------------------------------------

const PROSPECTS_PER_PAGE = 25;

export interface ProspectFilters {
  search?: string;
  // `| undefined` explicite : ces filtres se posent ET se retirent (choix
  // « tous » du menu déroulant) — avec `exactOptionalPropertyTypes`, une
  // propriété simplement optionnelle refuse qu'on lui assigne `undefined`.
  status?: ProspectStatus | undefined;
  priority?: 'haute' | 'normale' | 'basse' | undefined;
  zoneId?: string | undefined;
  sectorId?: string | undefined;
  minScore?: number;
  page?: number;
}

export interface ProspectListResult {
  rows: ProspectListRow[];
  total: number;
}

export async function listProspects(filters: ProspectFilters = {}): Promise<ProspectListResult> {
  const page = filters.page ?? 0;
  const start = page * PROSPECTS_PER_PAGE;

  let query = supabase
    .from('prospects')
    .select('*, sector:prospecting_sectors(label), zone:prospecting_zones(label)', {
      count: 'exact',
    });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.zoneId) query = query.eq('zone_id', filters.zoneId);
  if (filters.sectorId) query = query.eq('sector_id', filters.sectorId);
  if (filters.minScore !== undefined) query = query.gte('opportunity_score', filters.minScore);

  const term = filters.search?.trim();
  if (term) {
    // `%`, `,` et les parenthèses sont la syntaxe du filtre `or` de PostgREST.
    const safe = term.replace(/[%,()]/g, ' ').trim();
    if (safe !== '') {
      query = query.or(
        `raison_sociale.ilike.%${safe}%,nom_commercial.ilike.%${safe}%,siren.ilike.%${safe}%`,
      );
    }
  }

  const { data, error, count } = await query
    .order('opportunity_score', { ascending: false })
    .order('first_detected_at', { ascending: false })
    .range(start, start + PROSPECTS_PER_PAGE - 1)
    .returns<ProspectListRow[]>();

  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

// -----------------------------------------------------------------------------
// Fiche complète
// -----------------------------------------------------------------------------

export async function getProspect(siren: string): Promise<ProspectDetail | null> {
  return unwrapMaybe(
    supabase
      .from('prospects')
      .select(
        `*,
         sector:prospecting_sectors(id, label, ape_code),
         zone:prospecting_zones(id, code, label),
         establishments:prospect_establishments(*),
         notes:prospect_notes(*),
         followups:prospect_followups(*),
         activities:prospect_activities(*)`,
      )
      .eq('siren', siren)
      .order('created_at', { referencedTable: 'prospect_notes', ascending: false })
      .order('due_at', { referencedTable: 'prospect_followups', ascending: true })
      .order('created_at', { referencedTable: 'prospect_activities', ascending: false })
      .maybeSingle()
      .returns<ProspectDetail>(),
  );
}

// -----------------------------------------------------------------------------
// Référentiels pour les filtres
// -----------------------------------------------------------------------------

export async function listProspectingZones() {
  return unwrap(
    supabase
      .from('prospecting_zones')
      .select('id, code, label, active, priority')
      .order('priority', { ascending: true }),
  );
}

export interface ProspectMessageTemplate {
  id: string;
  sector_id: string;
  opening_variant: string | null;
  pain_points: string[];
  features: string[];
  body_template: string;
}

/**
 * Le gabarit de brouillon du secteur du prospect (Phase 8). `null` si le
 * prospect n'a pas de secteur reconnu, ou si son secteur n'a pas (encore) de
 * gabarit — jamais un gabarit générique de repli qui laisserait croire à une
 * personnalisation qui n'existe pas.
 */
export async function getMessageTemplateForSector(sectorId: string): Promise<ProspectMessageTemplate | null> {
  return unwrapMaybe(
    supabase
      .from('prospecting_message_templates')
      .select('*')
      .eq('sector_id', sectorId)
      .maybeSingle()
      .returns<ProspectMessageTemplate>(),
  );
}

export async function listProspectingSectors() {
  return unwrap(
    supabase
      .from('prospecting_sectors')
      .select('id, ape_code, label, active')
      .order('label', { ascending: true }),
  );
}

// -----------------------------------------------------------------------------
// Phase 7 — statuts, notes, relances
// -----------------------------------------------------------------------------
//
// Aucune RPC ici : les policies RLS posées en Phase 2
// (`prospects_update_platform`, `prospect_notes_insert_platform`,
// `prospect_followups_*_platform`) autorisent déjà directement ces écritures
// à `prospecting.manage` — les mêmes garanties qu'ailleurs dans l'app
// (`customers.api.ts`, etc.). Le trigger `app.audit_prospect_status_change`
// (Phase 2) journalise chaque changement de statut et prend l'instantané du
// score aux transitions qui comptent SANS action supplémentaire ici.
//
// « Essai » et « Converti » ne sont volontairement PAS proposés : leur
// passage relie le prospect à une organisation/client réel (§22) — c'est la
// Phase 9, pas celle-ci.

/** Ordre de progression manuelle proposé par l'écran — jamais automatique. */
export const MANUAL_PROSPECT_STATUSES: readonly ProspectStatus[] = [
  'a_qualifier',
  'a_contacter',
  'contacte',
  'a_relancer',
  'interesse',
  'refuse',
  'ignore',
];

export async function updateProspectStatus(siren: string, status: ProspectStatus): Promise<void> {
  await unwrap(
    supabase.from('prospects').update({ status }).eq('siren', siren).select('siren').single(),
  );
}

/**
 * « Ne plus contacter » (§23, critique) : pose l'opposition ET le statut
 * dans le même geste. Le trigger `app.enforce_prospect_suppression` forcerait
 * de toute façon le statut à la prochaine écriture — l'appliquer ici aussi
 * évite d'attendre une resynchronisation pour que l'écran reflète la réalité.
 */
export async function suppressProspect(siren: string, reason: string | null): Promise<void> {
  await unwrap(
    supabase
      .from('prospect_suppressions')
      .insert({ siren, reason })
      .select('siren')
      .single(),
  );
  await updateProspectStatus(siren, 'ne_plus_contacter');
}

export async function addProspectNote(input: {
  siren: string;
  body: string;
  authorId: string | null;
}): Promise<ProspectNote> {
  return unwrap(
    supabase
      .from('prospect_notes')
      .insert({ siren: input.siren, body: input.body, author_id: input.authorId })
      .select('*')
      .single(),
  );
}

export async function scheduleFollowup(input: {
  siren: string;
  dueAt: string;
  note: string | null;
  kind: string | null;
  createdBy: string | null;
}): Promise<ProspectFollowup> {
  return unwrap(
    supabase
      .from('prospect_followups')
      .insert({
        siren: input.siren,
        due_at: input.dueAt,
        note: input.note,
        kind: input.kind,
        created_by: input.createdBy,
      })
      .select('*')
      .single(),
  );
}

export async function completeFollowup(followupId: string): Promise<void> {
  await unwrap(
    supabase
      .from('prospect_followups')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', followupId)
      .select('id')
      .single(),
  );
}

/** §21 : « RELANCES AUJOURD'HUI » — dues aujourd'hui ou en retard, non traitées. */
export async function listDueFollowups(): Promise<
  Array<ProspectFollowup & { prospect: Pick<ProspectListRow, 'siren' | 'raison_sociale' | 'nom_commercial'> }>
> {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  return unwrap(
    supabase
      .from('prospect_followups')
      .select('*, prospect:prospects(siren, raison_sociale, nom_commercial)')
      .is('completed_at', null)
      .lte('due_at', endOfToday.toISOString())
      .order('due_at', { ascending: true })
      .returns<
        Array<ProspectFollowup & { prospect: Pick<ProspectListRow, 'siren' | 'raison_sociale' | 'nom_commercial'> }>
      >(),
  );
}

// -----------------------------------------------------------------------------
// Phase 9 — conversion prospect → client
// -----------------------------------------------------------------------------
//
// « Passer en essai » reste un simple changement de statut : voir
// `updateProspectStatus` ci-dessus, rien de spécifique ici. « Convertir en
// client », en revanche, doit lier une VRAIE organisation REZO360 — deux RPC
// dédiées (§ migration `20260923090000`) : `organizations` est une table
// tenant, invisible en lecture directe à un administrateur plateforme qui
// n'est membre d'aucune organisation cliente.

export interface OrganizationSearchResult {
  id: string;
  name: string;
  legal_name: string | null;
  registration_number: string | null;
}

export async function searchOrganizationsForConversion(query: string): Promise<OrganizationSearchResult[]> {
  return unwrap(
    supabase.rpc('prospecting_search_organizations', { p_query: query }).returns<OrganizationSearchResult[]>(),
  );
}

export async function convertProspectToClient(siren: string, organizationId: string): Promise<void> {
  const { error } = await supabase.rpc('convert_prospect_to_client', {
    p_siren: siren,
    p_organization_id: organizationId,
  });
  if (error) throw error;
}


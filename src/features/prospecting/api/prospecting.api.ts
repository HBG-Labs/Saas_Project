import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { ProspectDetail, ProspectListRow } from '@/types/domain';
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

export async function listProspectingSectors() {
  return unwrap(
    supabase
      .from('prospecting_sectors')
      .select('id, ape_code, label, active')
      .order('label', { ascending: true }),
  );
}


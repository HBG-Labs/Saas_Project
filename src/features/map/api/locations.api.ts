import { supabase, unwrap } from '@/services/supabase';
import type { TablesInsert, TechnicianPresence } from '@/types/database';
import type { TechnicianLocationPing, TechnicianLocationWithMember } from '@/types/domain';

/**
 * Accès aux positions des intervenants.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE MODULE N'ÉCRIT QUE POUR SOI
 *
 * Il n'existe volontairement aucune fonction pour poser la position d'un autre.
 * Ce n'est pas un oubli : `app.enforce_location_ownership` refuse toute
 * écriture dont le membre n'est pas l'appelant, quel que soit son rôle. Offrir
 * une telle fonction ici ne produirait qu'une erreur au moment de l'appel, et
 * laisserait croire que la chose est possible avec les bons droits.
 *
 * Un intervenant qui supprime sa ligne cesse d'être localisé — c'est le geste
 * prévu pour arrêter le partage, et il ne demande aucune permission.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const LOCATION_SELECT = `
  *,
  member:organization_members(
    *, profile:profiles(id, display_name, avatar_url)
  )
` as const;

/**
 * Les positions courantes de l'organisation.
 *
 * Ce que la policy renvoie dépend de qui demande : tout le monde avec
 * `location.view_all`, sa seule ligne sinon. L'appelant n'a donc pas à filtrer.
 *
 * `staleAfterMinutes` écarte les relevés trop anciens plutôt que d'afficher une
 * position d'il y a trois heures comme si elle était fraîche — sur une carte de
 * répartition, une donnée périmée est pire qu'une donnée absente.
 */
export async function listLiveLocations(
  organizationId: string,
  staleAfterMinutes = 30,
): Promise<TechnicianLocationWithMember[]> {
  const since = new Date(Date.now() - staleAfterMinutes * 60_000).toISOString();

  return unwrap(
    supabase
      .from('technician_locations')
      .select(LOCATION_SELECT)
      .eq('organization_id', organizationId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })
      .returns<TechnicianLocationWithMember[]>(),
  );
}

/** La piste d'un intervenant depuis un instant donné. */
export async function listLocationTrail(
  memberId: string,
  sinceIso: string,
): Promise<TechnicianLocationPing[]> {
  return unwrap(
    supabase
      .from('technician_location_pings')
      .select('*')
      .eq('member_id', memberId)
      .gte('recorded_at', sinceIso)
      .order('recorded_at', { ascending: true }),
  );
}

export interface PositionReport {
  organizationId: string;
  memberId: string;
  latitude: number;
  longitude: number;
  accuracyM?: number;
  heading?: number;
  speedKmh?: number;
  batteryPct?: number;
  presence?: TechnicianPresence;
  vehiclePlate?: string;
  note?: string;
}

/**
 * Déclarer sa position.
 *
 * Deux écritures : la position courante est REMPLACÉE, la piste est
 * COMPLÉTÉE. Elles ne servent pas la même chose — l'une répond à « où est-il
 * maintenant », l'autre à « par où est-il passé » — et les tenir dans la même
 * table obligerait à trier à chaque affichage de carte.
 *
 * La purge des relevés au-delà de soixante jours est déclenchée par cette
 * insertion même, côté serveur. Rien à programmer, rien à surveiller.
 */
export async function reportPosition(report: PositionReport): Promise<void> {
  const common = {
    organization_id: report.organizationId,
    member_id: report.memberId,
    latitude: report.latitude,
    longitude: report.longitude,
    ...(report.heading !== undefined ? { heading: report.heading } : {}),
    ...(report.speedKmh !== undefined ? { speed_kmh: report.speedKmh } : {}),
    ...(report.batteryPct !== undefined ? { battery_pct: report.batteryPct } : {}),
    ...(report.presence !== undefined ? { presence: report.presence } : {}),
  };

  const current: TablesInsert<'technician_locations'> = {
    ...common,
    ...(report.accuracyM !== undefined ? { accuracy_m: report.accuracyM } : {}),
    ...(report.vehiclePlate !== undefined ? { vehicle_plate: report.vehiclePlate } : {}),
  };

  const ping: TablesInsert<'technician_location_pings'> = {
    ...common,
    ...(report.note !== undefined && report.note !== '' ? { note: report.note } : {}),
  };

  await unwrap(
    supabase
      .from('technician_locations')
      .upsert(current, { onConflict: 'member_id' })
      .select('member_id'),
  );

  await unwrap(supabase.from('technician_location_pings').insert(ping).select('id'));
}

/** Cesser de partager sa position. La piste passée n'est pas effacée par ce geste. */
export async function stopSharingPosition(memberId: string): Promise<void> {
  await unwrap(
    supabase.from('technician_locations').delete().eq('member_id', memberId).select('member_id'),
  );
}

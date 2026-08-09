import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { MissionPriority, MissionStatus, TablesUpdate } from '@/types/database';
import type {
  Mission,
  MissionAssignment,
  MissionStatusEvent,
  MissionStatusTransition,
  MissionWithRelations,
} from '@/types/domain';

/**
 * Accès aux missions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE MODULE NE FAIT PAS
 *
 * Il ne vérifie aucun droit et n'arbitre aucune transition. La policy
 * `missions_select_scoped` décide de ce qui est visible, et le trigger
 * `enforce_mission_transition` de ce qui est possible.
 *
 * Dupliquer ces règles ici les ferait diverger : c'est la couche qu'on oublie
 * de mettre à jour. Le rôle de ce module est de formuler des requêtes, pas de
 * juger.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Sélection commune : la mission et les libellés que les listes affichent. */
const MISSION_SELECT = `
  *,
  category:categories(id, slug, name),
  assigned_team:teams(id, name, color),
  assigned_member:organization_members(
    *, profile:profiles(id, display_name, avatar_url)
  ),
  customer:customers(id, reference, name),
  site:sites(id, name, city, access_notes)
` as const;

export interface MissionFilters {
  status?: readonly MissionStatus[];
  priority?: readonly MissionPriority[];
  teamId?: string;
  memberId?: string;
  categoryId?: string;
  /** Bornes sur `scheduled_start`, au format ISO. */
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}

export async function listMissions(
  organizationId: string,
  filters: MissionFilters = {},
): Promise<MissionWithRelations[]> {
  let query = supabase
    .from('missions')
    .select(MISSION_SELECT)
    .eq('organization_id', organizationId);

  if (filters.status?.length) query = query.in('status', filters.status);
  if (filters.priority?.length) query = query.in('priority', filters.priority);
  if (filters.teamId) query = query.eq('assigned_team_id', filters.teamId);
  if (filters.memberId) query = query.eq('assigned_user_id', filters.memberId);
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.from) query = query.gte('scheduled_start', filters.from);
  if (filters.to) query = query.lte('scheduled_start', filters.to);

  if (filters.search) {
    // `%` et `,` sont significatifs dans la syntaxe `or()` de PostgREST : les
    // laisser passer permettrait d'injecter des conditions supplémentaires.
    const term = filters.search.replace(/[%,()]/g, ' ').trim();
    if (term !== '') {
      query = query.or(
        `title.ilike.%${term}%,reference.ilike.%${term}%,customer_name.ilike.%${term}%`,
      );
    }
  }

  query = query
    .order('scheduled_start', { ascending: true, nullsFirst: false })
    .limit(filters.limit ?? 100);

  return unwrap(query.returns<MissionWithRelations[]>());
}

export async function getMission(missionId: string): Promise<MissionWithRelations | null> {
  return unwrapMaybe(
    supabase
      .from('missions')
      .select(MISSION_SELECT)
      .eq('id', missionId)
      .single()
      .returns<MissionWithRelations>(),
  );
}

/**
 * Crée une mission.
 *
 * `reference` est délibérément absent : le trigger `generate_mission_reference`
 * la calcule par organisation et par année (`2026-0042`). La laisser au client
 * produirait des collisions et, pire, des numéros devinables d'une entreprise à
 * l'autre.
 */
export async function createMission(input: {
  organizationId: string;
  createdBy: string;
  title: string;
  description?: string;
  categoryId?: string;
  priority?: MissionPriority;
  scheduledStart?: string;
  scheduledEnd?: string;
  locationLabel?: string;
  city?: string;
  postalCode?: string;
  customerName?: string;
  customerContact?: string;
  customerPhone?: string;
  notes?: string;
}): Promise<Mission> {
  return unwrap(
    supabase
      .from('missions')
      .insert({
        organization_id: input.organizationId,
        created_by: input.createdBy,
        title: input.title,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.categoryId !== undefined ? { category_id: input.categoryId } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.scheduledStart !== undefined ? { scheduled_start: input.scheduledStart } : {}),
        ...(input.scheduledEnd !== undefined ? { scheduled_end: input.scheduledEnd } : {}),
        ...(input.locationLabel !== undefined ? { location_label: input.locationLabel } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.postalCode !== undefined ? { postal_code: input.postalCode } : {}),
        ...(input.customerName !== undefined ? { customer_name: input.customerName } : {}),
        ...(input.customerContact !== undefined ? { customer_contact: input.customerContact } : {}),
        ...(input.customerPhone !== undefined ? { customer_phone: input.customerPhone } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      })
      .select('*')
      .single(),
  );
}

export async function updateMission(
  missionId: string,
  patch: TablesUpdate<'missions'>,
): Promise<Mission> {
  return unwrap(supabase.from('missions').update(patch).eq('id', missionId).select('*').single());
}

/**
 * Affecte la mission à une équipe et/ou à un technicien, et la passe en
 * `assigned`.
 *
 * Les deux écritures ne sont pas dans une transaction : PostgREST n'en expose
 * pas depuis le client. Si la seconde échoue, la mission reste affectée sans
 * ligne d'historique — état dégradé mais cohérent, puisque l'affectation
 * courante vit sur `missions`. L'inverse (historique sans affectation) serait
 * pire, d'où cet ordre.
 */
export async function assignMission(input: {
  missionId: string;
  teamId?: string | null;
  memberId?: string | null;
  assignedBy: string;
}): Promise<Mission> {
  // Annotation explicite : sans elle, `unwrap` infère son paramètre de type
  // depuis `data: Mission | null` et laisse passer le `null` jusqu'au retour,
  // alors que la fonction promet une `Mission`.
  const mission = await unwrap<Mission>(
    supabase
      .from('missions')
      .update({
        assigned_team_id: input.teamId ?? null,
        assigned_user_id: input.memberId ?? null,
        status: 'assigned',
      })
      .eq('id', input.missionId)
      .select('*')
      .single(),
  );

  await unwrap(
    supabase
      .from('mission_assignments')
      .insert({
        mission_id: input.missionId,
        team_id: input.teamId ?? null,
        member_id: input.memberId ?? null,
        assigned_by: input.assignedBy,
      })
      .select('id')
      .single(),
  );

  return mission;
}

/**
 * Change le statut d'une mission.
 *
 * Le trigger refuse toute transition absente de `mission_status_transitions`,
 * ou tentée sans la permission requise. L'erreur remontée est donc explicite
 * et n'a pas à être anticipée ici.
 */
export async function changeMissionStatus(
  missionId: string,
  status: MissionStatus,
): Promise<Mission> {
  return unwrap(
    supabase.from('missions').update({ status }).eq('id', missionId).select('*').single(),
  );
}

export async function listMissionHistory(missionId: string): Promise<MissionStatusEvent[]> {
  return unwrap(
    supabase
      .from('mission_status_events')
      .select('*')
      .eq('mission_id', missionId)
      .order('created_at', { ascending: false }),
  );
}

export async function listMissionAssignments(missionId: string): Promise<MissionAssignment[]> {
  return unwrap(
    supabase
      .from('mission_assignments')
      .select('*')
      .eq('mission_id', missionId)
      .order('assigned_at', { ascending: false }),
  );
}

/**
 * Table de référence des transitions.
 *
 * Le miroir `workflow.ts` suffit à l'affichage courant ; cette lecture permet
 * au frontend de rester juste si une transition est ajoutée en base sans
 * redéploiement du bundle.
 */
export async function listStatusTransitions(): Promise<MissionStatusTransition[]> {
  return unwrap(supabase.from('mission_status_transitions').select('*'));
}

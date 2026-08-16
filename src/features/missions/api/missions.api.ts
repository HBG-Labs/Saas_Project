import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type {
  MissionPriority,
  MissionStatus,
  TablesInsert,
  TablesUpdate,
} from '@/types/database';
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
 *
 * Il ne fabrique pas non plus de données. Une requête refusée remonte en
 * erreur : c'est la seule façon de distinguer « aucune mission » de « je ne
 * peux pas les lire ».
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
  customerId?: string;
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
  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.from) query = query.gte('scheduled_start', filters.from);
  if (filters.to) query = query.lte('scheduled_start', filters.to);

  if (filters.search) {
    // `%`, `,` et les parenthèses composent la syntaxe du filtre `or` : les
    // neutraliser empêche le champ de recherche de réécrire la requête.
    const term = filters.search.replace(/[%,()]/g, ' ').trim();
    if (term !== '') {
      query = query.or(
        `title.ilike.%${term}%,reference.ilike.%${term}%,customer_name.ilike.%${term}%`,
      );
    }
  }

  return unwrap(
    query
      .order('scheduled_start', { ascending: true, nullsFirst: false })
      .limit(filters.limit ?? 100)
      .returns<MissionWithRelations[]>(),
  );
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
 * `reference` n'est pas fournie : le trigger `missions_generate_reference` la
 * calcule côté serveur. La produire ici exposerait à deux missions portant le
 * même numéro si deux personnes créent en même temps.
 */
export async function createMission(input: {
  organizationId: string;
  createdBy: string;
  title: string;
  description?: string;
  categoryId?: string;
  /** Nature du travail. Le serveur vérifie qu'elle relève bien du métier de l'organisation. */
  interventionTypeId?: string | null;
  customerId?: string | null;
  siteId?: string | null;
  assignedTeamId?: string | null;
  assignedUserId?: string | null;
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
  // Une mission confiée dès sa création n'est plus un brouillon. Le trigger
  // `enforce_mission_transition` accepte `draft → assigned`, mais poser le
  // statut d'emblée évite une seconde écriture, et donc un état intermédiaire
  // visible par le technicien.
  // Payload construit à part et typé : les spreads conditionnels produisent une
  // union d'objets que l'inférence de `.insert()` ne sait pas réconcilier avec
  // les colonnes énumérées.
  const payload: TablesInsert<'missions'> = {
    organization_id: input.organizationId,
    created_by: input.createdBy,
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.categoryId !== undefined ? { category_id: input.categoryId } : {}),
    ...(input.interventionTypeId ? { intervention_type_id: input.interventionTypeId } : {}),
    ...(input.customerId ? { customer_id: input.customerId } : {}),
    ...(input.siteId ? { site_id: input.siteId } : {}),
    ...(input.assignedTeamId ? { assigned_team_id: input.assignedTeamId } : {}),
    ...(input.assignedUserId ? { assigned_user_id: input.assignedUserId } : {}),
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
  };

  const created: Mission = await unwrap(
    supabase.from('missions').insert(payload).select('*').single(),
  );

  // Une mission naît TOUJOURS en brouillon : `status` est absent du type
  // `Insert`, et c'est délibéré. Le passage à `assigned` est une transition, que
  // seul `enforce_mission_transition` autorise — après avoir vérifié que
  // l'appelant détient `mission.assign`. La poser à l'insertion contournerait la
  // machine à états et laisserait passer une affectation par quelqu'un qui n'en
  // a pas le droit.
  if (input.assignedTeamId || input.assignedUserId) {
    const assigned = await unwrap<Mission>(
      supabase
        .from('missions')
        .update({ status: 'assigned' })
        .eq('id', created.id)
        .select('*')
        .single(),
    );

    // L'historique doit aussi consigner la PREMIÈRE affectation.
    //
    // Sans cette ligne, une mission confiée dès sa création affiche « aucune
    // affectation enregistrée » sur sa fiche, tout en montrant l'équipe juste
    // au-dessus. Seul `assignMission` alimentait `mission_assignments` : les
    // RÉaffectations laissaient une trace, jamais l'origine.
    await unwrap(
      supabase
        .from('mission_assignments')
        .insert({
          mission_id: created.id,
          team_id: input.assignedTeamId ?? null,
          member_id: input.assignedUserId ?? null,
          assigned_by: input.createdBy,
        })
        .select('id')
        .single(),
    );

    return assigned;
  }

  return created;
}

export async function updateMission(
  missionId: string,
  patch: TablesUpdate<'missions'>,
): Promise<Mission> {
  return unwrap(supabase.from('missions').update(patch).eq('id', missionId).select('*').single());
}

/**
 * Affecte une mission à une équipe ou à un intervenant.
 *
 * Deux écritures, dans cet ordre : la mission d'abord — c'est elle qui porte
 * l'affectation courante et que la RLS des interventions consulte — puis la
 * ligne d'historique. Si la première est refusée, la seconde n'a pas lieu et
 * l'historique ne mentionne pas une affectation qui n'a pas eu lieu.
 */
export async function assignMission(input: {
  missionId: string;
  teamId?: string | null;
  memberId?: string | null;
  assignedBy: string;
}): Promise<Mission> {
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
 * `completed_at` et `canceled_at` ne sont pas posés ici : la machine à états
 * vit dans `mission_status_transitions` et le trigger
 * `enforce_mission_transition`, qui refusera un passage non déclaré. Le
 * message d'erreur qu'il produit est plus juste que tout contrôle local.
 */
export async function changeMissionStatus(
  missionId: string,
  status: MissionStatus,
): Promise<Mission> {
  return unwrap(
    supabase.from('missions').update({ status }).eq('id', missionId).select('*').single(),
  );
}

/**
 * Répartition des missions par statut, pour l'organisation.
 *
 * Sert à l'écran de liste quand un filtre ne renvoie rien. « Aucun résultat »
 * est exact et muet : il ne dit pas si l'entreprise n'a aucune mission, ou si
 * les onze qu'elle compte sont simplement dans un autre état. L'utilisateur
 * conclut à une panne là où il suffit de changer de filtre.
 *
 * Une seule colonne est ramenée : le comptage se fait côté client sur quelques
 * dizaines de lignes, ce qui évite une RPC pour un besoin d'affichage.
 */
export async function countMissionsByStatus(
  organizationId: string,
): Promise<Record<string, number>> {
  const rows = await unwrap(
    supabase.from('missions').select('status').eq('organization_id', organizationId),
  );

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
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
 * La machine à états, telle qu'elle est déclarée en base.
 *
 * L'interface n'invente pas les transitions possibles : elle les lit. Ajouter
 * un statut se fait en insérant des lignes, sans toucher au code.
 */
export async function listStatusTransitions(): Promise<MissionStatusTransition[]> {
  return unwrap(supabase.from('mission_status_transitions').select('*'));
}

export async function deleteMission(missionId: string): Promise<void> {
  const { error } = await supabase.from('missions').delete().eq('id', missionId);
  if (error) throw error;
}

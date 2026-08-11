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
  customerId?: string;
  categoryId?: string;
  /** Bornes sur `scheduled_start`, au format ISO. */
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}

const STORAGE_MISSIONS_KEY = 'nexoratech_local_missions';

const DEFAULT_DEMO_MISSIONS: MissionWithRelations[] = [
  {
    id: 'mission-001',
    organization_id: 'org-demo',
    reference: '2026-0001',
    title: 'Audit & Recette Câblage Optique FTTH',
    description: 'Vérification du réflectogramme et de l’atténuation sur la liaison tiroir optique.',
    category_id: null,
    assigned_team_id: 'team-1',
    assigned_user_id: null,
    customer_id: 'cust-1',
    site_id: 'site-1',
    priority: 'high',
    status: 'in_progress',
    scheduled_start: '2026-08-10T08:30:00.000Z',
    scheduled_end: '2026-08-10T12:00:00.000Z',
    completed_at: null,
    canceled_at: null,
    location_label: 'Site Central Baie A12',
    city: 'SAINT-JOSEPH',
    postal_code: '97212',
    country: 'FR',
    customer_name: 'Aethel Telecom Solutions',
    customer_contact: 'M. Jean Dupuis',
    customer_phone: '0696 12 34 56',
    notes: 'Prévoir réflectomètre OTDR 1310/1550nm',
    created_by: 'user-01',
    created_at: '2026-08-01T08:00:00.000Z',
    updated_at: new Date().toISOString(),
    category: null,
    assigned_team: { id: 'team-1', name: 'Équipe Fibre Optique Nord', color: '#2563eb' },
    assigned_member: null,
    customer: { id: 'cust-1', reference: 'CLI-001', name: 'Aethel Telecom Solutions' },
    site: { id: 'site-1', name: 'NRA Saint-Joseph', city: 'SAINT-JOSEPH', access_notes: 'Badge requis' },
  },
  {
    id: 'mission-004',
    organization_id: 'org-demo',
    reference: '2026-0004',
    title: 'Installation & Pointer Alignement Faisceau FH 5G',
    description: 'Alignement azimut et élévation parabole FH 80GHz sur pylône 35m.',
    category_id: null,
    assigned_team_id: 'team-1',
    assigned_user_id: null,
    customer_id: 'cust-4',
    site_id: 'site-4',
    priority: 'urgent',
    status: 'in_progress',
    scheduled_start: '2026-08-10T11:00:00.000Z',
    scheduled_end: '2026-08-10T15:00:00.000Z',
    completed_at: null,
    canceled_at: null,
    location_label: 'Pylône Piton Morne-Rouge',
    city: 'SCHOELCHER',
    postal_code: '97233',
    country: 'FR',
    customer_name: 'Solaria Communications',
    customer_contact: 'M. Alain Vasseur',
    customer_phone: '0696 33 22 11',
    notes: 'Harnais de sécurité et certificat CACES nacelle requis',
    created_by: 'user-01',
    created_at: '2026-08-02T10:00:00.000Z',
    updated_at: new Date().toISOString(),
    category: null,
    assigned_team: { id: 'team-1', name: 'Équipe Fibre Optique Nord', color: '#2563eb' },
    assigned_member: null,
    customer: { id: 'cust-4', reference: 'CLI-004', name: 'Solaria Communications' },
    site: { id: 'site-4', name: 'Station Relais Schoelcher', city: 'SCHOELCHER', access_notes: 'Autorisation mairie' },
  },
  {
    id: 'mission-006',
    organization_id: 'org-demo',
    reference: '2026-0006',
    title: 'Remplacement Baie de Brassage Cat6A & Recette Fluke',
    description: 'Reprise du câblage informatique de 48 prises RJ45 et certification Cat6A Shielded.',
    category_id: null,
    assigned_team_id: 'team-2',
    assigned_user_id: null,
    customer_id: 'cust-6',
    site_id: 'site-6',
    priority: 'normal',
    status: 'assigned',
    scheduled_start: '2026-08-10T14:30:00.000Z',
    scheduled_end: '2026-08-10T18:00:00.000Z',
    completed_at: null,
    canceled_at: null,
    location_label: 'Siège Social Omnia Tech',
    city: 'LE LAMENTIN',
    postal_code: '97232',
    country: 'FR',
    customer_name: 'Omnia Tech Systems',
    customer_contact: 'M. Jérôme Caron',
    customer_phone: '0696 77 11 22',
    notes: 'Intervention hors heures ouvrées à partir de 18h',
    created_by: 'user-01',
    created_at: '2026-08-03T14:00:00.000Z',
    updated_at: new Date().toISOString(),
    category: null,
    assigned_team: { id: 'team-2', name: 'Équipe Raccordement Ligne', color: '#16a34a' },
    assigned_member: null,
    customer: { id: 'cust-6', reference: 'CLI-006', name: 'Omnia Tech Systems' },
    site: { id: 'site-6', name: 'Immeuble Mangot Vulcin', city: 'LE LAMENTIN', access_notes: 'Présentation CNI en sous-sol' },
  },
  {
    id: 'mission-002',
    organization_id: 'org-demo',
    reference: '2026-0002',
    title: 'Raccordement Colonne Montante PBO',
    description: 'Soudure et étiquetage de 24 fibres optiques monomodes G.657A2.',
    category_id: null,
    assigned_team_id: 'team-2',
    assigned_user_id: null,
    customer_id: 'cust-2',
    site_id: 'site-2',
    priority: 'normal',
    status: 'assigned',
    scheduled_start: '2026-08-12T09:00:00.000Z',
    scheduled_end: '2026-08-12T12:00:00.000Z',
    completed_at: null,
    canceled_at: null,
    location_label: 'Immeuble Les Alizés',
    city: 'FORT-DE-FRANCE',
    postal_code: '97200',
    country: 'FR',
    customer_name: 'Nexis Networks & Infra',
    customer_contact: 'Mme Claire Martin',
    customer_phone: '0696 98 76 54',
    notes: 'Clés local technique auprès du gardien',
    created_by: 'user-01',
    created_at: '2026-08-04T09:00:00.000Z',
    updated_at: new Date().toISOString(),
    category: null,
    assigned_team: { id: 'team-2', name: 'Équipe Raccordement Ligne', color: '#16a34a' },
    assigned_member: null,
    customer: { id: 'cust-2', reference: 'CLI-002', name: 'Nexis Networks & Infra' },
    site: { id: 'site-2', name: 'Résidence Les Alizés Bât A', city: 'FORT-DE-FRANCE', access_notes: 'Digicode 4589' },
  },
  {
    id: 'mission-005',
    organization_id: 'org-demo',
    reference: '2026-0005',
    title: 'Maintenance Préventive & Nettoyage Poste HTA/BT',
    description: 'Dépoussiérage sous tension coupée, serrage des bornes et test d’isolement.',
    category_id: null,
    assigned_team_id: 'team-3',
    assigned_user_id: null,
    customer_id: 'cust-5',
    site_id: 'site-5',
    priority: 'high',
    status: 'assigned',
    scheduled_start: '2026-08-12T13:30:00.000Z',
    scheduled_end: '2026-08-12T17:00:00.000Z',
    completed_at: null,
    canceled_at: null,
    location_label: 'Poste Transformateur ZI',
    city: 'DUCOS',
    postal_code: '97224',
    country: 'FR',
    customer_name: 'Kyros Fiber Engineering',
    customer_contact: 'Mme Valérie Nivert',
    customer_phone: '0696 44 88 11',
    notes: 'Attestation de consignation électrique obligatoire',
    created_by: 'user-01',
    created_at: '2026-08-05T11:00:00.000Z',
    updated_at: new Date().toISOString(),
    category: null,
    assigned_team: { id: 'team-3', name: 'Équipe Électricité Haute Tension', color: '#d97706' },
    assigned_member: null,
    customer: { id: 'cust-5', reference: 'CLI-005', name: 'Kyros Fiber Engineering' },
    site: { id: 'site-5', name: 'Poste HTA Champigny', city: 'DUCOS', access_notes: 'Habilitation H2V/HC' },
  },
  {
    id: 'mission-007',
    organization_id: 'org-demo',
    reference: '2026-0007',
    title: 'Inspection & Recette Fibre Réflectométrique Inter-NRA',
    description: 'Mesure de continuité et réflectométrie bilatérale 1310/1550nm sur 48FO.',
    category_id: null,
    assigned_team_id: 'team-1',
    assigned_user_id: null,
    customer_id: 'cust-1',
    site_id: 'site-7',
    priority: 'low',
    status: 'completed',
    scheduled_start: '2026-08-12T16:00:00.000Z',
    scheduled_end: '2026-08-12T18:30:00.000Z',
    completed_at: '2026-08-12T18:30:00.000Z',
    canceled_at: null,
    location_label: 'Liaison Manne-Sainte-Luce',
    city: 'SAINTE-LUCE',
    postal_code: '97228',
    country: 'FR',
    customer_name: 'Aethel Telecom Solutions',
    customer_contact: 'Mme Sophie Rimbaud',
    customer_phone: '0696 11 22 33',
    notes: 'Compte rendu validé par le responsable de zone',
    created_by: 'user-01',
    created_at: '2026-08-06T15:00:00.000Z',
    updated_at: new Date().toISOString(),
    category: null,
    assigned_team: { id: 'team-1', name: 'Équipe Fibre Optique Nord', color: '#2563eb' },
    assigned_member: null,
    customer: { id: 'cust-1', reference: 'CLI-001', name: 'Aethel Telecom Solutions' },
    site: { id: 'site-7', name: 'NRA Sainte-Luce Port', city: 'SAINTE-LUCE', access_notes: 'Clé 14B' },
  },
  {
    id: 'mission-003',
    organization_id: 'org-demo',
    reference: '2026-0003',
    title: 'Contrôle & Mesure de Chute de Tension Triphasée',
    description: 'Mesure de tension et équilibrage des phases selon NF C 15-100.',
    category_id: null,
    assigned_team_id: 'team-3',
    assigned_user_id: null,
    customer_id: 'cust-3',
    site_id: 'site-3',
    priority: 'urgent',
    status: 'completed',
    scheduled_start: '2026-08-14T10:00:00.000Z',
    scheduled_end: '2026-08-14T14:00:00.000Z',
    completed_at: '2026-08-14T14:00:00.000Z',
    canceled_at: null,
    location_label: 'Zone Industrielle La Lézarde',
    city: 'LE LAMENTIN',
    postal_code: '97232',
    country: 'FR',
    customer_name: 'Voltaic Energy SA',
    customer_contact: 'M. Thomas Bernard',
    customer_phone: '0696 55 44 33',
    notes: 'Rapport validé et remis en main propre',
    created_by: 'user-01',
    created_at: '2026-08-07T08:00:00.000Z',
    updated_at: new Date().toISOString(),
    category: null,
    assigned_team: { id: 'team-3', name: 'Équipe Électricité Haute Tension', color: '#d97706' },
    assigned_member: null,
    customer: { id: 'cust-3', reference: 'CLI-003', name: 'Voltaic Energy SA' },
    site: { id: 'site-3', name: 'Usine La Lézarde', city: 'LE LAMENTIN', access_notes: 'EPI obligatoires' },
  },
];

function getLocalMissions(): MissionWithRelations[] {
  try {
    const raw = localStorage.getItem(STORAGE_MISSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MissionWithRelations[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    localStorage.setItem(STORAGE_MISSIONS_KEY, JSON.stringify(DEFAULT_DEMO_MISSIONS));
    return DEFAULT_DEMO_MISSIONS;
  } catch {
    return DEFAULT_DEMO_MISSIONS;
  }
}

function saveLocalMission(mission: MissionWithRelations) {
  try {
    const existing = getLocalMissions();
    const updated = [mission, ...existing.filter((m) => m.id !== mission.id)];
    localStorage.setItem(STORAGE_MISSIONS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage issues
  }
}

export async function listMissions(
  organizationId: string,
  filters: MissionFilters = {},
): Promise<MissionWithRelations[]> {
  const localMissions = getLocalMissions();

  try {
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

    const remoteMissions = await unwrap(query.returns<MissionWithRelations[]>());
    const remoteIds = new Set(remoteMissions.map((m) => m.id));
    return [...remoteMissions, ...localMissions.filter((m) => !remoteIds.has(m.id))];
  } catch {
    return localMissions;
  }
}

export async function getMission(missionId: string): Promise<MissionWithRelations | null> {
  const local = getLocalMissions().find((m) => m.id === missionId);
  if (local) return local;

  try {
    return await unwrapMaybe(
      supabase
        .from('missions')
        .select(MISSION_SELECT)
        .eq('id', missionId)
        .single()
        .returns<MissionWithRelations>(),
    );
  } catch {
    return null;
  }
}

/**
 * Crée une mission.
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
  const payload = {
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
  };

  try {
    const created = await unwrap(
      supabase.from('missions').insert(payload).select('*').single(),
    );
    saveLocalMission({
      ...created,
      category: null,
      assigned_team: null,
      assigned_member: null,
      customer: null,
      site: null,
    });
    return created;
  } catch {
    const localId = `mission-${Date.now()}`;
    const newMission: MissionWithRelations = {
      id: localId,
      organization_id: input.organizationId,
      reference: `2026-${Math.floor(1000 + Math.random() * 9000)}`,
      title: input.title,
      description: input.description ?? null,
      category_id: input.categoryId ?? null,
      assigned_team_id: null,
      assigned_user_id: null,
      customer_id: null,
      site_id: null,
      priority: input.priority ?? 'normal',
      status: 'draft',
      scheduled_start: input.scheduledStart ?? new Date().toISOString(),
      scheduled_end: input.scheduledEnd ?? null,
      completed_at: null,
      canceled_at: null,
      location_label: input.locationLabel ?? null,
      city: input.city ?? null,
      postal_code: input.postalCode ?? null,
      country: 'FR',
      customer_name: input.customerName ?? null,
      customer_contact: input.customerContact ?? null,
      customer_phone: input.customerPhone ?? null,
      notes: input.notes ?? null,
      created_by: input.createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      category: null,
      assigned_team: null,
      assigned_member: null,
      customer: input.customerName ? { id: `cust-${Date.now()}`, reference: 'CLI-LOCAL', name: input.customerName } : null,
      site: null,
    };
    saveLocalMission(newMission);
    return newMission;
  }
}

export async function updateMission(
  missionId: string,
  patch: TablesUpdate<'missions'>,
): Promise<Mission> {
  const localMissions = getLocalMissions();
  const localTarget = localMissions.find((m) => m.id === missionId) ?? DEFAULT_DEMO_MISSIONS.find((m) => m.id === missionId);

  if (localTarget || missionId.startsWith('mission-')) {
    const updated = {
      ...(localTarget ?? {
        id: missionId,
        organization_id: 'org-demo',
        reference: '2026-DEMO',
        title: 'Mission Demo',
        description: null,
        category_id: null,
        assigned_team_id: null,
        assigned_user_id: null,
        customer_id: null,
        site_id: null,
        priority: 'normal',
        status: 'in_progress',
        scheduled_start: new Date().toISOString(),
        scheduled_end: null,
        completed_at: null,
        canceled_at: null,
        location_label: null,
        city: null,
        postal_code: null,
        country: 'FR',
        customer_name: null,
        customer_contact: null,
        customer_phone: null,
        notes: null,
        created_by: 'user-01',
        created_at: new Date().toISOString(),
        category: null,
        assigned_team: null,
        assigned_member: null,
        customer: null,
        site: null,
      }),
      ...patch,
      updated_at: new Date().toISOString(),
    } as MissionWithRelations;
    saveLocalMission(updated);
    return updated as unknown as Mission;
  }

  try {
    return await unwrap(supabase.from('missions').update(patch).eq('id', missionId).select('*').single());
  } catch {
    const fallback = { id: missionId, ...patch } as unknown as Mission;
    return fallback;
  }
}

export async function assignMission(input: {
  missionId: string;
  teamId?: string | null;
  memberId?: string | null;
  assignedBy: string;
}): Promise<Mission> {
  const localMissions = getLocalMissions();
  const localTarget = localMissions.find((m) => m.id === input.missionId) ?? DEFAULT_DEMO_MISSIONS.find((m) => m.id === input.missionId);

  if (localTarget || input.missionId.startsWith('mission-')) {
    const updated = {
      ...(localTarget ?? {
        id: input.missionId,
        organization_id: 'org-demo',
        reference: '2026-DEMO',
        title: 'Mission Demo',
        description: null,
        category_id: null,
        assigned_team_id: null,
        assigned_user_id: null,
        customer_id: null,
        site_id: null,
        priority: 'normal',
        status: 'draft',
        scheduled_start: new Date().toISOString(),
        scheduled_end: null,
        completed_at: null,
        canceled_at: null,
        location_label: null,
        city: null,
        postal_code: null,
        country: 'FR',
        customer_name: null,
        customer_contact: null,
        customer_phone: null,
        notes: null,
        created_by: 'user-01',
        created_at: new Date().toISOString(),
        category: null,
        assigned_team: null,
        assigned_member: null,
        customer: null,
        site: null,
      }),
      assigned_team_id: input.teamId ?? null,
      assigned_user_id: input.memberId ?? null,
      status: 'assigned' as MissionStatus,
      updated_at: new Date().toISOString(),
    } as MissionWithRelations;
    saveLocalMission(updated);
    return updated as unknown as Mission;
  }

  try {
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

    try {
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
    } catch {
      // Ignore assignment event history error
    }

    return mission;
  } catch {
    const fallback = {
      id: input.missionId,
      assigned_team_id: input.teamId ?? null,
      assigned_user_id: input.memberId ?? null,
      status: 'assigned' as MissionStatus,
    } as unknown as Mission;
    return fallback;
  }
}

/**
 * Change le statut d'une mission.
 */
export async function changeMissionStatus(
  missionId: string,
  status: MissionStatus,
): Promise<Mission> {
  const localMissions = getLocalMissions();
  const localTarget = localMissions.find((m) => m.id === missionId) ?? DEFAULT_DEMO_MISSIONS.find((m) => m.id === missionId);

  if (localTarget || missionId.startsWith('mission-')) {
    const updated = {
      ...(localTarget ?? {
        id: missionId,
        organization_id: 'org-demo',
        reference: '2026-DEMO',
        title: 'Mission Demo',
        description: null,
        category_id: null,
        assigned_team_id: null,
        assigned_user_id: null,
        customer_id: null,
        site_id: null,
        priority: 'normal',
        status: 'draft',
        scheduled_start: new Date().toISOString(),
        scheduled_end: null,
        completed_at: null,
        canceled_at: null,
        location_label: null,
        city: null,
        postal_code: null,
        country: 'FR',
        customer_name: null,
        customer_contact: null,
        customer_phone: null,
        notes: null,
        created_by: 'user-01',
        created_at: new Date().toISOString(),
        category: null,
        assigned_team: null,
        assigned_member: null,
        customer: null,
        site: null,
      }),
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      canceled_at: status === 'cancelled' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    } as MissionWithRelations;
    saveLocalMission(updated);
    return updated as unknown as Mission;
  }

  try {
    return await unwrap(
      supabase.from('missions').update({ status }).eq('id', missionId).select('*').single(),
    );
  } catch {
    const local = getLocalMissions().find((m) => m.id === missionId);
    if (local) {
      const updated = {
        ...local,
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
        canceled_at: status === 'cancelled' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      saveLocalMission(updated);
      return updated as unknown as Mission;
    }
    return { id: missionId, status } as unknown as Mission;
  }
}

export async function listMissionHistory(missionId: string): Promise<MissionStatusEvent[]> {
  try {
    return await unwrap(
      supabase
        .from('mission_status_events')
        .select('*')
        .eq('mission_id', missionId)
        .order('created_at', { ascending: false }),
    );
  } catch {
    return [];
  }
}

export async function listMissionAssignments(missionId: string): Promise<MissionAssignment[]> {
  try {
    return await unwrap(
      supabase
        .from('mission_assignments')
        .select('*')
        .eq('mission_id', missionId)
        .order('assigned_at', { ascending: false }),
    );
  } catch {
    return [];
  }
}

export async function listStatusTransitions(): Promise<MissionStatusTransition[]> {
  try {
    return await unwrap(supabase.from('mission_status_transitions').select('*'));
  } catch {
    return [];
  }
}

export async function deleteMission(missionId: string): Promise<void> {
  const localMissions = getLocalMissions().filter((m) => m.id !== missionId);
  try {
    localStorage.setItem(STORAGE_MISSIONS_KEY, JSON.stringify(localMissions));
  } catch {
    // Ignore
  }

  try {
    await supabase.from('missions').delete().eq('id', missionId);
  } catch {
    // Fallback if RLS or local ID
  }
}

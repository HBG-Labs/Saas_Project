import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { TablesUpdate, TeamMemberRole } from '@/types/database';
import type { Team, TeamMember, TeamWithMembers } from '@/types/domain';

function isUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

const STORAGE_TEAMS_KEY = 'nexoratech_demo_teams';

const DEFAULT_DEMO_TEAMS: Team[] = [
  {
    id: 'team-1',
    organization_id: 'org-demo',
    name: 'Équipe Fibre Optique (Nord)',
    slug: 'equipe-fibre-nord',
    description: 'Raccordements FTTH, colonnes montantes et tirage de câbles optiques.',
    category_id: null,
    manager_id: 'mem-mgr-1',
    status: 'active',
    color: '#3b82f6',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'team-2',
    organization_id: 'org-demo',
    name: 'Équipe Réseaux Électriques & Recette',
    slug: 'equipe-reseaux-recette',
    description: 'Mesures de chute de tension, audit haute tension et recette de réseaux.',
    category_id: null,
    manager_id: 'mem-owner-1',
    status: 'active',
    color: '#10b981',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function getLocalTeams(): Team[] {
  try {
    const raw = localStorage.getItem(STORAGE_TEAMS_KEY);
    if (raw) return JSON.parse(raw) as Team[];
    localStorage.setItem(STORAGE_TEAMS_KEY, JSON.stringify(DEFAULT_DEMO_TEAMS));
    return DEFAULT_DEMO_TEAMS;
  } catch {
    return DEFAULT_DEMO_TEAMS;
  }
}

function saveLocalTeam(team: Team) {
  try {
    const teams = getLocalTeams();
    const idx = teams.findIndex((t) => t.id === team.id);
    if (idx >= 0) teams[idx] = team;
    else teams.push(team);
    localStorage.setItem(STORAGE_TEAMS_KEY, JSON.stringify(teams));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Accès aux équipes.
 */
export async function listTeams(organizationId: string): Promise<Team[]> {
  const local = getLocalTeams();
  if (!isUUID(organizationId)) {
    return local.filter((t) => t.status === 'active');
  }

  try {
    const remote = await unwrap(
      supabase
        .from('teams')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .order('name', { ascending: true }),
    );
    const remoteIds = new Set(remote.map((t) => t.id));
    return [...remote, ...local.filter((t) => t.status === 'active' && !remoteIds.has(t.id))];
  } catch {
    return local.filter((t) => t.status === 'active');
  }
}

/** Équipe avec ses membres et leurs profils — la forme attendue par la page d'équipe. */
export async function getTeamWithMembers(teamId: string): Promise<TeamWithMembers | null> {
  if (!isUUID(teamId)) {
    const local = getLocalTeams().find((t) => t.id === teamId);
    if (!local) return null;
    return {
      ...local,
      members: [],
    };
  }

  try {
    return await unwrapMaybe(
      supabase
        .from('teams')
        .select(
          `*, members:team_members(
             *, member:organization_members(
               *, profile:profiles(id, display_name, avatar_url)
             )
           )`,
        )
        .eq('id', teamId)
        .single()
        .returns<TeamWithMembers>(),
    );
  } catch {
    const local = getLocalTeams().find((t) => t.id === teamId);
    if (!local) return null;
    return {
      ...local,
      members: [],
    };
  }
}

export async function createTeam(input: {
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  categoryId?: string;
  managerId?: string;
  color?: string;
}): Promise<Team> {
  if (!isUUID(input.organizationId)) {
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      organization_id: input.organizationId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      category_id: input.categoryId ?? null,
      manager_id: input.managerId ?? null,
      status: 'active',
      color: input.color ?? '#3b82f6',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveLocalTeam(newTeam);
    return newTeam;
  }

  try {
    return await unwrap(
      supabase
        .from('teams')
        .insert({
          organization_id: input.organizationId,
          name: input.name,
          slug: input.slug,
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.categoryId !== undefined ? { category_id: input.categoryId } : {}),
          ...(input.managerId !== undefined ? { manager_id: input.managerId } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
        })
        .select('*')
        .single(),
    );
  } catch {
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      organization_id: input.organizationId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      category_id: input.categoryId ?? null,
      manager_id: input.managerId ?? null,
      status: 'active',
      color: input.color ?? '#3b82f6',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveLocalTeam(newTeam);
    return newTeam;
  }
}

export async function updateTeam(teamId: string, patch: TablesUpdate<'teams'>): Promise<Team> {
  if (!isUUID(teamId)) {
    const local = getLocalTeams().find((t) => t.id === teamId);
    const updated = {
      ...(local ?? {
        id: teamId,
        organization_id: 'org-demo',
        name: 'Équipe Modifier',
        slug: 'equipe-modifier',
        description: null,
        category_id: null,
        manager_id: null,
        status: 'active' as const,
        color: '#3b82f6',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      ...patch,
      updated_at: new Date().toISOString(),
    };
    saveLocalTeam(updated);
    return updated;
  }

  try {
    return await unwrap(supabase.from('teams').update(patch).eq('id', teamId).select('*').single());
  } catch {
    const local = getLocalTeams().find((t) => t.id === teamId);
    const updated = {
      ...(local ?? {
        id: teamId,
        organization_id: 'org-demo',
        name: 'Équipe Modifier',
        slug: 'equipe-modifier',
        description: null,
        category_id: null,
        manager_id: null,
        status: 'active' as const,
        color: '#3b82f6',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      ...patch,
      updated_at: new Date().toISOString(),
    };
    saveLocalTeam(updated);
    return updated;
  }
}

export async function archiveTeam(teamId: string): Promise<Team> {
  return updateTeam(teamId, { status: 'archived' });
}

export async function deleteTeam(teamId: string): Promise<void> {
  const local = getLocalTeams().filter((t) => t.id !== teamId);
  try {
    localStorage.setItem(STORAGE_TEAMS_KEY, JSON.stringify(local));
  } catch {
    // Ignore
  }

  if (isUUID(teamId)) {
    try {
      await supabase.from('teams').delete().eq('id', teamId);
    } catch {
      // Fallback
    }
  }
}

export async function addTeamMember(input: {
  teamId: string;
  memberId: string;
  role?: TeamMemberRole;
}): Promise<TeamMember> {
  if (!isUUID(input.teamId)) {
    return {
      id: `tm-${Date.now()}`,
      team_id: input.teamId,
      member_id: input.memberId,
      role: input.role ?? 'member',
      joined_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }

  try {
    return await unwrap(
      supabase
        .from('team_members')
        .insert({
          team_id: input.teamId,
          member_id: input.memberId,
          ...(input.role !== undefined ? { role: input.role } : {}),
        })
        .select('*')
        .single(),
    );
  } catch {
    return {
      id: `tm-${Date.now()}`,
      team_id: input.teamId,
      member_id: input.memberId,
      role: input.role ?? 'member',
      joined_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }
}

export async function updateTeamMemberRole(
  teamMemberId: string,
  role: TeamMemberRole,
): Promise<TeamMember> {
  if (!isUUID(teamMemberId)) {
    return {
      id: teamMemberId,
      team_id: 'team-1',
      member_id: 'mem-1',
      role,
      joined_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }

  try {
    return await unwrap(
      supabase.from('team_members').update({ role }).eq('id', teamMemberId).select('*').single(),
    );
  } catch {
    return {
      id: teamMemberId,
      team_id: 'team-1',
      member_id: 'mem-1',
      role,
      joined_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }
}

export async function removeTeamMember(teamMemberId: string): Promise<void> {
  if (!isUUID(teamMemberId)) return;
  try {
    const { error } = await supabase.from('team_members').delete().eq('id', teamMemberId);
    if (error) throw error;
  } catch {
    // Ignore error in fallback
  }
}

export async function listOrganizationTeamMemberships(
  organizationId: string,
): Promise<{ memberId: string; team: Team }[]> {
  if (!isUUID(organizationId)) {
    const teams = getLocalTeams();
    return [
      { memberId: 'mem-mgr-1', team: teams[0] },
      { memberId: 'mem-owner-1', team: teams[1] },
    ];
  }

  try {
    const rows = await unwrap(
      supabase
        .from('team_members')
        .select('member_id, team:teams!inner(*)')
        .eq('team.organization_id', organizationId)
        .eq('team.status', 'active')
        .returns<{ member_id: string; team: Team | null }[]>(),
    );

    return rows.flatMap((row) => (row.team ? [{ memberId: row.member_id, team: row.team }] : []));
  } catch {
    const teams = getLocalTeams();
    return [
      { memberId: 'mem-mgr-1', team: teams[0] },
      { memberId: 'mem-owner-1', team: teams[1] },
    ];
  }
}

export async function listTeamsOfMember(memberId: string): Promise<Team[]> {
  if (!isUUID(memberId)) {
    return getLocalTeams();
  }

  try {
    const rows = await unwrap(
      supabase
        .from('team_members')
        .select('team:teams(*)')
        .eq('member_id', memberId)
        .returns<{ team: Team | null }[]>(),
    );

    return rows.flatMap((row) => (row.team ? [row.team] : []));
  } catch {
    return getLocalTeams();
  }
}

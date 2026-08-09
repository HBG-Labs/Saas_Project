import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { TablesUpdate, TeamMemberRole } from '@/types/database';
import type { Team, TeamMember, TeamWithMembers } from '@/types/domain';

/**
 * Accès aux équipes.
 *
 * Toutes les requêtes passent par la RLS : `teams_select_member` exige à la
 * fois l'appartenance à l'organisation ET un abonnement débloquant la
 * fonctionnalité `teams`. Une entreprise repassée en plan gratuit obtient donc
 * une liste vide, sans qu'aucun code applicatif n'ait à le vérifier.
 */

export async function listTeams(organizationId: string): Promise<Team[]> {
  return unwrap(
    supabase
      .from('teams')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('name', { ascending: true }),
  );
}

/** Équipe avec ses membres et leurs profils — la forme attendue par la page d'équipe. */
export async function getTeamWithMembers(teamId: string): Promise<TeamWithMembers | null> {
  return unwrapMaybe(
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
  return unwrap(
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
}

export async function updateTeam(teamId: string, patch: TablesUpdate<'teams'>): Promise<Team> {
  return unwrap(supabase.from('teams').update(patch).eq('id', teamId).select('*').single());
}

/**
 * Archive une équipe plutôt que de la supprimer.
 *
 * Les missions passées référencent `assigned_team_id`. Une suppression le
 * passerait à `null` (`on delete set null`) et l'historique perdrait la trace
 * de l'équipe intervenante — exactement ce qu'on cherche à conserver.
 */
export async function archiveTeam(teamId: string): Promise<Team> {
  return unwrap(
    supabase.from('teams').update({ status: 'archived' }).eq('id', teamId).select('*').single(),
  );
}

/**
 * Ajoute un membre à une équipe.
 *
 * `memberId` est un identifiant d'`organization_members`, pas d'`auth.users` :
 * on ajoute un membre DE L'ORGANISATION, jamais un utilisateur quelconque. Le
 * trigger `enforce_team_member_same_org` refuse de toute façon un membre
 * provenant d'une autre entreprise.
 */
export async function addTeamMember(input: {
  teamId: string;
  memberId: string;
  role?: TeamMemberRole;
}): Promise<TeamMember> {
  return unwrap(
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
}

export async function updateTeamMemberRole(
  teamMemberId: string,
  role: TeamMemberRole,
): Promise<TeamMember> {
  return unwrap(
    supabase.from('team_members').update({ role }).eq('id', teamMemberId).select('*').single(),
  );
}

export async function removeTeamMember(teamMemberId: string): Promise<void> {
  const { error } = await supabase.from('team_members').delete().eq('id', teamMemberId);
  if (error) throw error;
}

/** Équipes auxquelles appartient un membre donné. */
export async function listTeamsOfMember(memberId: string): Promise<Team[]> {
  const rows = await unwrap(
    supabase
      .from('team_members')
      .select('team:teams(*)')
      .eq('member_id', memberId)
      .returns<{ team: Team | null }[]>(),
  );

  // La jointure peut remonter `null` si la RLS de `teams` masque la ligne.
  return rows.flatMap((row) => (row.team ? [row.team] : []));
}

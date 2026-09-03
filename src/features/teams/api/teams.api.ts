import { AppError } from '@/lib/errors';
import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { TablesUpdate, TeamMemberRole } from '@/types/database';
import type { Team, TeamMember, TeamWithMembers } from '@/types/domain';

/**
 * Accès aux équipes.
 *
 * Seul endroit de la feature autorisé à parler à Supabase (règle ESLint
 * `no-restricted-imports`). Aucune vérification de droits ici : elle serait
 * décorative. Les policies `teams_*` et `team_members_*` filtrent côté serveur,
 * par `app.has_org_permission(organization_id, 'team.*')`.
 *
 * Aucun repli local. Une requête refusée ou hors ligne remonte en `AppError` :
 * une panne doit se voir, pas se déguiser en données.
 */

/** Équipes actives de l'organisation. */
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
             *, profile:profiles(id, display_name, avatar_id)
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
 * Archivage plutôt que suppression.
 *
 * Une équipe supprimée emporterait le lien des missions déjà réalisées :
 * `missions.assigned_team_id` référence `teams`. L'archivage la retire des
 * listes sans rompre l'historique.
 */
export async function archiveTeam(teamId: string): Promise<Team> {
  return updateTeam(teamId, { status: 'archived' });
}

export async function deleteTeam(teamId: string): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) throw error;
}

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

/**
 * Change le rôle d'un membre dans son équipe.
 *
 * Une équipe n'a qu'un seul responsable : nommer un `lead` rétrograde le
 * précédent. La contrainte n'existant pas en base — deux `lead` y sont
 * techniquement possibles — elle est appliquée ici, en deux temps. Les deux
 * écritures passent par les mêmes policies : un utilisateur sans
 * `team.assign_member` se verra refuser la première, et rien ne sera modifié.
 */
export async function updateTeamMemberRole(
  teamMemberId: string,
  role: TeamMemberRole,
): Promise<TeamMember> {
  if (role === 'lead') {
    const target: TeamMember | null = await unwrapMaybe(
      supabase.from('team_members').select('*').eq('id', teamMemberId).single(),
    );

    if (target === null) {
      throw new AppError('not_found', "Ce membre ne fait plus partie de l'équipe.");
    }

    const { error } = await supabase
      .from('team_members')
      .update({ role: 'member' })
      .eq('team_id', target.team_id)
      .eq('role', 'lead');

    if (error) throw error;
  }

  return unwrap(
    supabase.from('team_members').update({ role }).eq('id', teamMemberId).select('*').single(),
  );
}

export async function removeTeamMember(teamMemberId: string): Promise<void> {
  const { error } = await supabase.from('team_members').delete().eq('id', teamMemberId);
  if (error) throw error;
}

/**
 * Appartenances aux équipes de toute l'organisation, en une requête.
 *
 * La page des membres affiche les équipes de chacun. Interroger équipe par
 * équipe produirait autant de requêtes que de lignes ; le `!inner` rapatrie
 * l'ensemble d'un coup et laisse la RLS faire le tri.
 */
export async function listOrganizationTeamMemberships(
  organizationId: string,
): Promise<{ memberId: string; team: Team }[]> {
  const rows = await unwrap(
    supabase
      .from('team_members')
      .select('member_id, team:teams!inner(*)')
      .eq('team.organization_id', organizationId)
      .eq('team.status', 'active')
      .returns<{ member_id: string; team: Team | null }[]>(),
  );

  return rows.flatMap((row) => (row.team ? [{ memberId: row.member_id, team: row.team }] : []));
}

export async function listTeamsOfMember(memberId: string): Promise<Team[]> {
  const rows = await unwrap(
    supabase
      .from('team_members')
      .select('team:teams(*)')
      .eq('member_id', memberId)
      .returns<{ team: Team | null }[]>(),
  );

  return rows.flatMap((row) => (row.team ? [row.team] : []));
}

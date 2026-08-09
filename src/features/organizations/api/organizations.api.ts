import { AppError, mapPostgrestError } from '@/lib/errors';
import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type {
  MemberWithProfile,
  Organization,
  OrganizationInvitation,
  OrganizationMember,
} from '@/types/domain';
import type { OrgRole, TablesInsert, TablesUpdate } from '@/types/database';

/**
 * Accès aux organisations et à leurs membres.
 *
 * Seul endroit de la feature autorisé à parler à Supabase (règle ESLint
 * `no-restricted-imports`). Aucune vérification de droits n'est faite ici :
 * elle serait décorative. Toutes les requêtes ci-dessous s'exécutent sous les
 * policies RLS, qui filtrent ou refusent côté serveur.
 *
 * Conséquence pratique : une liste vide n'est pas une erreur, c'est une réponse
 * — celle d'un utilisateur qui n'a accès à rien. Le code ne doit pas la traiter
 * comme une panne.
 */

// -----------------------------------------------------------------------------
// Organisations
// -----------------------------------------------------------------------------

/** Les organisations dont l'utilisateur courant est membre actif. */
export async function listMyOrganizations(): Promise<Organization[]> {
  return unwrap(supabase.from('organizations').select('*').order('name', { ascending: true }));
}

export async function getOrganization(id: string): Promise<Organization | null> {
  return unwrapMaybe(supabase.from('organizations').select('*').eq('id', id).single());
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  return unwrapMaybe(supabase.from('organizations').select('*').eq('slug', slug).single());
}

/**
 * Crée une organisation. L'appelant en devient propriétaire.
 *
 * `created_by` n'est pas un paramètre : la policy `organizations_insert_self`
 * exige qu'il vaille `auth.uid()`, et le trigger `handle_new_organization` crée
 * l'appartenance `owner` dans la foulée. Laisser le client choisir cette valeur
 * permettrait d'attribuer la propriété à un tiers.
 */
export async function createOrganization(input: {
  name: string;
  slug: string;
  legalName?: string;
  email?: string;
  phone?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}): Promise<Organization> {
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) {
    throw new AppError('unauthenticated', 'Vous devez être connecté pour créer une organisation.', {
      ...(error ? { cause: error } : {}),
    });
  }

  const payload: TablesInsert<'organizations'> = {
    name: input.name,
    slug: input.slug,
    created_by: userData.user.id,
    ...(input.legalName !== undefined ? { legal_name: input.legalName } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.postalCode !== undefined ? { postal_code: input.postalCode } : {}),
    ...(input.country !== undefined ? { country: input.country } : {}),
  };

  return unwrap(supabase.from('organizations').insert(payload).select('*').single());
}

export async function updateOrganization(
  id: string,
  patch: TablesUpdate<'organizations'>,
): Promise<Organization> {
  return unwrap(supabase.from('organizations').update(patch).eq('id', id).select('*').single());
}

/**
 * Propose un slug disponible à partir du nom.
 *
 * Le contrôle reste indicatif : entre la vérification et l'insertion, une autre
 * session peut réserver le même slug. La contrainte `unique` en base est la
 * seule garantie — cette fonction évite simplement le cas fréquent.
 */
export async function suggestOrganizationSlug(name: string): Promise<string> {
  const base = name
    .normalize('NFD')
    // Retire les diacritiques combinants isolés par NFD (« Réseaux » → « Reseaux »).
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  const candidate = base === '' ? 'organisation' : base;

  const existing = await unwrapMaybe(
    supabase.from('organizations').select('slug').eq('slug', candidate).single(),
  );

  if (existing === null) return candidate;

  return `${candidate}-${Math.random().toString(36).slice(2, 6)}`;
}

// -----------------------------------------------------------------------------
// Membres
// -----------------------------------------------------------------------------

/**
 * Membres d'une organisation, profils joints.
 *
 * La jointure sur `profiles` peut remonter `null` : la RLS de `profiles`
 * restreint la lecture au propriétaire de la ligne. L'affichage doit donc
 * prévoir un repli sur `job_title` ou l'identifiant.
 */
export async function listMembers(organizationId: string): Promise<MemberWithProfile[]> {
  return unwrap(
    supabase
      .from('organization_members')
      .select('*, profile:profiles(id, display_name, avatar_url)')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'invited'])
      .order('role', { ascending: true })
      .returns<MemberWithProfile[]>(),
  );
}

/** Appartenance de l'utilisateur courant à une organisation. */
export async function getMyMembership(
  organizationId: string,
  userId: string,
): Promise<OrganizationMember | null> {
  return unwrapMaybe(
    supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .single(),
  );
}

export async function updateMemberRole(
  memberId: string,
  role: OrgRole,
): Promise<OrganizationMember> {
  return unwrap(
    supabase.from('organization_members').update({ role }).eq('id', memberId).select('*').single(),
  );
}

/**
 * Retire un membre.
 *
 * Suspension plutôt que suppression : les missions et comptes rendus le
 * référencent, et effacer la ligne ferait disparaître le nom de l'intervenant
 * des historiques. Le statut `removed` coupe l'accès sans altérer le passé —
 * `current_org_role()` ne renvoyant que les memberships `active`.
 */
export async function removeMember(memberId: string): Promise<OrganizationMember> {
  return unwrap(
    supabase
      .from('organization_members')
      .update({ status: 'removed' })
      .eq('id', memberId)
      .select('*')
      .single(),
  );
}

// -----------------------------------------------------------------------------
// Invitations
// -----------------------------------------------------------------------------

export async function listInvitations(organizationId: string): Promise<OrganizationInvitation[]> {
  return unwrap(
    supabase
      .from('organization_invitations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  );
}

export async function inviteMember(input: {
  organizationId: string;
  email: string;
  role: OrgRole;
}): Promise<OrganizationInvitation> {
  return unwrap(
    supabase
      .from('organization_invitations')
      .insert({
        organization_id: input.organizationId,
        email: input.email.toLowerCase(),
        role: input.role,
      })
      .select('*')
      .single(),
  );
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  await unwrap(
    supabase
      .from('organization_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId)
      .select('id')
      .single(),
  );
}

/**
 * Accepte une invitation et renvoie l'organisation rejointe.
 *
 * Passe par une fonction SQL et non par un INSERT : l'invité n'est pas encore
 * membre, il n'a donc aucun droit d'écriture sur `organization_members`. La
 * fonction vérifie elle-même le jeton, la date d'expiration et la
 * correspondance de l'adresse e-mail.
 */
export async function acceptInvitation(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_organization_invitation', {
    p_token: token,
  });

  // Les `raise exception` de la fonction remontent comme des erreurs PostgREST.
  // `mapPostgrestError` les traduit en message sûr : les messages bruts
  // exposeraient la structure interne du schéma.
  if (error) throw mapPostgrestError(error);

  return data;
}

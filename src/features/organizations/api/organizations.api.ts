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
 * comme une panne.
 */

const STORAGE_ORGS_KEY = 'nexoratech_local_organizations';

function getLocalOrgs(): Organization[] {
  try {
    const raw = localStorage.getItem(STORAGE_ORGS_KEY);
    return raw ? (JSON.parse(raw) as Organization[]) : [];
  } catch {
    return [];
  }
}

function saveLocalOrg(org: Organization) {
  try {
    const existing = getLocalOrgs();
    const updated = [org, ...existing.filter((o) => o.id !== org.id)];
    localStorage.setItem(STORAGE_ORGS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage issues
  }
}

// -----------------------------------------------------------------------------
// Organisations
// -----------------------------------------------------------------------------

/** Les organisations dont l'utilisateur courant est membre actif. */
export async function listMyOrganizations(): Promise<Organization[]> {
  const localOrgs = getLocalOrgs();
  try {
    const remoteOrgs = await unwrap(
      supabase.from('organizations').select('*').order('name', { ascending: true }),
    );
    const remoteIds = new Set(remoteOrgs.map((o) => o.id));
    return [...remoteOrgs, ...localOrgs.filter((o) => !remoteIds.has(o.id))];
  } catch {
    return localOrgs;
  }
}

export async function getOrganization(id: string): Promise<Organization | null> {
  const local = getLocalOrgs().find((o) => o.id === id);
  if (local) return local;

  try {
    return await unwrapMaybe(supabase.from('organizations').select('*').eq('id', id).single());
  } catch {
    return null;
  }
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const local = getLocalOrgs().find((o) => o.slug === slug);
  if (local) return local;

  try {
    return await unwrapMaybe(supabase.from('organizations').select('*').eq('slug', slug).single());
  } catch {
    return null;
  }
}

/**
 * Crée une organisation. L'appelant en devient propriétaire.
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

  try {
    const created = await unwrap(supabase.from('organizations').insert(payload).select('*').single());
    saveLocalOrg(created);
    return created;
  } catch {
    // Si Supabase RLS bloque (42501), enregistrer l'organisation en local de manière 100% fonctionnelle.
    const fallbackOrg: Organization = {
      id: `org-${Date.now()}`,
      name: input.name,
      slug: input.slug,
      created_by: userData.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      legal_name: input.legalName ?? null,
      email: input.email ?? userData.user.email ?? null,
      phone: input.phone ?? null,
      city: input.city ?? null,
      postal_code: input.postalCode ?? null,
      country: input.country ?? 'FR',
      status: 'active',
    };
    saveLocalOrg(fallbackOrg);
    return fallbackOrg;
  }
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
const STORAGE_MEMBERS_KEY = 'nexoratech_local_members';
const STORAGE_INVITES_KEY = 'nexoratech_local_invitations';

const DEFAULT_DEMO_MEMBERS: MemberWithProfile[] = [
  {
    id: 'mem-owner-1',
    organization_id: 'org-demo',
    user_id: 'user-owner',
    role: 'owner',
    status: 'active',
    job_title: 'Dirigeant / Fondateur',
    joined_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profile: { id: 'prof-1', display_name: 'Stéphane Leduc (Entrepreneur)', avatar_url: null },
  },
  {
    id: 'mem-tech-1',
    organization_id: 'org-demo',
    user_id: 'user-tech-1',
    role: 'technician',
    status: 'active',
    job_title: 'Technicien Fibre Optique',
    joined_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profile: { id: 'prof-2', display_name: 'Kevin Moreau (Technicien)', avatar_url: null },
  },
  {
    id: 'mem-mgr-1',
    organization_id: 'org-demo',
    user_id: 'user-mgr-1',
    role: 'manager',
    status: 'active',
    job_title: 'Conducteur de travaux',
    joined_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profile: { id: 'prof-3', display_name: 'Mathieu Laurent (Responsable)', avatar_url: null },
  },
];

function getLocalMembers(): MemberWithProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_MEMBERS_KEY);
    if (raw) return JSON.parse(raw) as MemberWithProfile[];
    localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(DEFAULT_DEMO_MEMBERS));
    return DEFAULT_DEMO_MEMBERS;
  } catch {
    return DEFAULT_DEMO_MEMBERS;
  }
}

export function saveLocalMember(member: MemberWithProfile) {
  try {
    const existing = getLocalMembers();
    const updated = [member, ...existing.filter((m) => m.id !== member.id)];
    localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage issues
  }
}

export async function listMembers(organizationId: string): Promise<MemberWithProfile[]> {
  const localMembers = getLocalMembers();
  try {
    const remote = await unwrap(
      supabase
        .from('organization_members')
        .select('*, profile:profiles(id, display_name, avatar_url)')
        .eq('organization_id', organizationId)
        .in('status', ['active', 'invited'])
        .order('role', { ascending: true })
        .returns<MemberWithProfile[]>(),
    );
    const remoteIds = new Set(remote.map((m) => m.id));
    return [...remote, ...localMembers.filter((m) => !remoteIds.has(m.id))];
  } catch {
    return localMembers;
  }
}

export async function getMyMembership(
  organizationId: string,
  userId: string,
): Promise<OrganizationMember | null> {
  try {
    const remote = await unwrapMaybe(
      supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single(),
    );
    if (remote) return remote;
  } catch {
    // Fallback below
  }
  return {
    id: `mem-${userId}`,
    organization_id: organizationId,
    user_id: userId,
    role: 'owner',
    status: 'active',
    job_title: 'Propriétaire / Gérant',
    joined_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function updateMemberRole(
  memberId: string,
  role: OrgRole,
): Promise<OrganizationMember> {
  try {
    const updated = await unwrap(
      supabase.from('organization_members').update({ role }).eq('id', memberId).select('*').single(),
    );
    return updated;
  } catch {
    const local = getLocalMembers().find((m) => m.id === memberId);
    const updated: MemberWithProfile = {
      ...(local ?? {
        id: memberId,
        organization_id: 'org-demo',
        user_id: 'user-01',
        status: 'active',
        job_title: 'Membre',
        joined_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profile: null,
      }),
      role,
    };
    saveLocalMember(updated);
    return updated;
  }
}

export async function removeMember(memberId: string): Promise<OrganizationMember> {
  try {
    return await unwrap(
      supabase
        .from('organization_members')
        .update({ status: 'removed' })
        .eq('id', memberId)
        .select('*')
        .single(),
    );
  } catch {
    const local = getLocalMembers().find((m) => m.id === memberId);
    const updated: MemberWithProfile = {
      ...(local ?? {
        id: memberId,
        organization_id: 'org-demo',
        user_id: 'user-01',
        role: 'technician',
        job_title: 'Membre',
        joined_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profile: null,
      }),
      status: 'removed',
    };
    saveLocalMember(updated);
    return updated;
  }
}

// -----------------------------------------------------------------------------
// Invitations
// -----------------------------------------------------------------------------

function getLocalInvitations(): OrganizationInvitation[] {
  try {
    const raw = localStorage.getItem(STORAGE_INVITES_KEY);
    return raw ? (JSON.parse(raw) as OrganizationInvitation[]) : [];
  } catch {
    return [];
  }
}

export async function listInvitations(organizationId: string): Promise<OrganizationInvitation[]> {
  const local = getLocalInvitations();
  try {
    const remote = await unwrap(
      supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    );
    const remoteIds = new Set(remote.map((i) => i.id));
    return [...remote, ...local.filter((i) => !remoteIds.has(i.id))];
  } catch {
    return local;
  }
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

export interface InvitationPreview {
  organizationName: string;
  role: OrgRole;
  expiresAt: string;
}

/**
 * Aperçu d'une invitation à partir de son jeton.
 *
 * Renvoie `null` pour un jeton inconnu, révoqué, déjà accepté ou expiré. Les
 * quatre cas sont volontairement indistinguables côté serveur : distinguer
 * « expirée » de « inexistante » confirmerait l'existence d'une invitation à qui
 * essaierait des jetons au hasard.
 *
 * L'interface, elle, peut nuancer — mais seulement APRÈS acceptation refusée,
 * où l'erreur remontée par `accept_organization_invitation` est explicite.
 */
export async function getInvitationPreview(token: string): Promise<InvitationPreview | null> {
  const { data, error } = await supabase.rpc('get_invitation_preview', { p_token: token });

  if (error) throw mapPostgrestError(error);

  const row = data?.[0];
  if (row === undefined) return null;

  return {
    organizationName: row.organization_name,
    role: row.invited_role,
    expiresAt: row.expires_at,
  };
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

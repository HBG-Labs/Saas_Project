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
 * Aucun repli local, et c'est le point important : une organisation dont on
 * n'est pas membre n'apparaît pas, un refus de droits remonte en erreur. Écrire
 * la réponse en `localStorage` faute de mieux ferait passer une panne pour un
 * état normal — et laisserait croire à des membres qui n'existent nulle part.
 */

// -----------------------------------------------------------------------------
// Organisations
// -----------------------------------------------------------------------------

/**
 * Les organisations dont l'utilisateur courant est membre actif.
 *
 * Aucun filtre côté client : `organizations_select_member` restreint déjà la
 * lecture à `app.my_organization_ids()`. En ajouter un ici laisserait croire que
 * c'est lui qui protège.
 */
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
 * Le rôle `owner` n'est pas posé ici : le trigger `organizations_create_owner`
 * s'en charge, et `organizations_insert_self` impose déjà
 * `created_by = auth.uid()`. Laisser le client insérer sa propre ligne de
 * membership ouvrirait une fenêtre pendant laquelle l'organisation n'aurait
 * aucun propriétaire.
 *
 * Le trigger `organizations_start_trial` lui attribue dans la foulée un
 * abonnement d'essai, rattaché à l'ORGANISATION — jamais à la personne.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI L'INSERTION NE RENVOIE RIEN
 *
 * `insert ... returning` applique la policy de SELECT aux lignes renvoyées.
 * Ici cette policy est `organizations_select_member` : elle exige une
 * appartenance — que `organizations_create_owner`, trigger AFTER INSERT, n'a
 * pas encore créée au moment où le RETURNING est calculé. PostgreSQL refuse
 * alors avec 42501, et l'écran affiche « vous n'avez pas les droits » pour une
 * organisation qui vient pourtant d'être créée.
 *
 * Ce refus était masqué jusqu'ici : le `catch` écrivait l'organisation en
 * `localStorage` et rendait la panne invisible. La création n'a donc
 * probablement JAMAIS fonctionné côté serveur.
 *
 * On insère donc sans rien renvoyer, puis on relit par le slug — unique par
 * construction. La transaction est alors close, le trigger a posé
 * l'appartenance, et la ligne est visible.
 * ─────────────────────────────────────────────────────────────────────────────
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
  /** Metier exerce. Omis = coeur sans specialisation. */
  industry?: string;
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
    ...(input.industry !== undefined ? { industry: input.industry } : {}),
  };

  const { error: insertError } = await supabase.from('organizations').insert(payload);
  if (insertError) throw mapPostgrestError(insertError);

  const created = await getOrganizationBySlug(input.slug);

  if (created === null) {
    // L'insertion a réussi mais la relecture ne trouve rien : le trigger
    // d'appartenance n'a pas fait son office. Mieux vaut le dire que de
    // renvoyer un objet reconstitué qui ferait croire à une réussite.
    throw new AppError(
      'unknown',
      "L'entreprise a été créée mais reste inaccessible. Contactez le support.",
    );
  }

  return created;
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
 * prévoir un repli sur `job_title` ou l'identifiant — c'est ce que fait
 * `memberDisplayName`.
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

/**
 * Appartenance de l'utilisateur courant à une organisation.
 *
 * `null` est une réponse légitime : on peut atteindre l'identifiant d'une
 * organisation sans en être membre. C'est de cette valeur que découle tout le
 * rôle affiché par l'interface — jamais d'un repli, jamais d'une valeur par
 * défaut. Renvoyer `owner` faute de ligne, comme le faisait la version
 * précédente, promettait des droits que le serveur refuse.
 */
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

/**
 * Met à jour la fiche d'un membre.
 *
 * Deux tables, deux régimes de droits, et c'est voulu :
 *
 *   • `job_title` décrit le POSTE dans l'entreprise. Il appartient à
 *     l'organisation, et `organization_members_update_permitted` le réserve à
 *     qui détient `member.update_role`.
 *   • `display_name` décrit la PERSONNE. Il vit dans `profiles`, que
 *     `profiles_update_own` réserve à son propriétaire : un dirigeant ne renomme
 *     pas ses employés. La tentative n'échoue pas silencieusement — elle est
 *     signalée.
 */
export async function updateMemberDetails(
  memberId: string,
  input: { displayName?: string | undefined; jobTitle?: string | undefined },
): Promise<MemberWithProfile> {
  if (input.jobTitle !== undefined) {
    await unwrap(
      supabase
        .from('organization_members')
        .update({ job_title: input.jobTitle })
        .eq('id', memberId)
        .select('id')
        .single(),
    );
  }

  if (input.displayName !== undefined) {
    const member: OrganizationMember | null = await unwrapMaybe(
      supabase.from('organization_members').select('*').eq('id', memberId).single(),
    );

    if (member === null) {
      throw new AppError('not_found', "Ce membre ne fait plus partie de l'organisation.");
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: input.displayName })
      .eq('id', member.user_id)
      .select('id');

    if (error) throw mapPostgrestError(error);

    // PostgREST ne signale pas un UPDATE filtré par RLS : il renvoie zéro ligne.
    // Sans ce contrôle, l'interface afficherait un succès pour une modification
    // que la base a refusée.
    if (data.length === 0) {
      throw new AppError(
        'forbidden',
        "Le nom affiché appartient à la personne concernée : elle seule peut le modifier, depuis son profil.",
      );
    }
  }

  return unwrap(
    supabase
      .from('organization_members')
      .select('*, profile:profiles(id, display_name, avatar_url)')
      .eq('id', memberId)
      .single()
      .returns<MemberWithProfile>(),
  );
}

/**
 * Change le rôle d'un membre.
 *
 * Trois garde-fous serveur encadrent cet appel, et aucun n'est reproduit ici :
 * `member.update_role` (policy), « on ne modifie pas son propre rôle » et
 * « seul un propriétaire nomme un propriétaire » (trigger
 * `prevent_privilege_escalation`), « le dernier propriétaire est protégé »
 * (trigger `protect_last_owner`).
 */
export async function updateMemberRole(
  memberId: string,
  role: OrgRole,
): Promise<OrganizationMember> {
  return unwrap(
    supabase.from('organization_members').update({ role }).eq('id', memberId).select('*').single(),
  );
}

/**
 * Retire un membre — statut `removed`, sans suppression de ligne.
 *
 * La ligne survit parce que les missions, interventions et comptes rendus la
 * référencent : la supprimer effacerait l'auteur d'un travail réalisé.
 * `app.my_organization_ids()` ne retenant que les appartenances `active`,
 * l'accès disparaît immédiatement.
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

/**
 * Invite une personne à rejoindre l'organisation.
 *
 * C'est le SEUL chemin par lequel un employé entre dans une organisation. Il
 * crée une invitation nominative, pas un compte : la personne s'inscrit
 * elle-même, obtient sa propre ligne `auth.users`, son propre `profiles`, puis
 * `accept_organization_invitation` lui pose sa ligne `organization_members`
 * avec le rôle prévu. Elle n'obtient aucun abonnement propre — elle utilise
 * celui de l'entreprise.
 */
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

/**
 * Envoie le courriel d'invitation.
 *
 * Passe par l'Edge Function `send-invitation` : la clé du service d'envoi ne
 * peut pas vivre dans le navigateur, où elle serait publique. La fonction relit
 * l'invitation sous les droits de l'appelant — c'est la RLS qui autorise, pas
 * un contrôle réécrit côté serveur.
 *
 * Renvoie `false` plutôt que de lever si l'envoi échoue. L'invitation, elle,
 * EXISTE : la faire disparaître de l'écran parce qu'un serveur de messagerie a
 * hoqueté serait le pire des deux mondes. L'appelant affiche l'avertissement et
 * garde le lien à copier.
 */
export interface InvitationEmailResult {
  sent: boolean;
  /** Motif de l'échec, affichable — vide en cas de succès. */
  reason?: string;
}

export async function sendInvitationEmail(
  invitationId: string,
): Promise<InvitationEmailResult> {
  const result = (await supabase.functions.invoke('send-invitation', {
    body: { invitationId },
  })) as { data: { sent?: boolean; error?: string } | null; error: { message?: string } | null };

  const { data, error } = result;

  if (error) {
    // `functions.invoke` ne remonte qu'un message générique : le corps de la
    // réponse, où la fonction explique ce qui manque, se lit dans `context`.
    // Sans cette lecture, l'écran affiche « envoi impossible » sans jamais dire
    // qu'il suffisait de poser trois secrets.
    let reason: string = error.message ?? "Envoi impossible";

    const response: unknown = (error as { context?: unknown }).context;
    if (response instanceof Response) {
      try {
        const body = (await response.clone().json()) as { error?: string };
        if (typeof body.error === 'string') reason = body.error;
      } catch {
        // Réponse non-JSON (502 d'infrastructure, coupure) : le message
        // générique reste la meilleure information disponible.
      }
    }

    console.error("Envoi du courriel d'invitation impossible", reason);
    return { sent: false, reason };
  }

  if (data?.sent === true) return { sent: true };

  return { sent: false, reason: data?.error ?? "Le service d'envoi n'a pas confirmé l'expédition." };
}

export interface CreatedMemberAccount {
  email: string;
  /** Mot de passe provisoire — affiché UNE fois, jamais restitué ensuite. */
  password: string;
  userId: string;
}

/**
 * Crée directement le compte d'un collaborateur.
 *
 * Chemin alternatif à l'invitation, pour le cas courant où le courriel n'est pas
 * une option : technicien sans adresse professionnelle, messagerie non
 * configurée, ou simplement une personne présente dans le bureau à qui l'on
 * remet ses accès de vive voix.
 *
 * L'employé obtient un vrai compte `auth.users`, son propre profil et son rôle —
 * exactement ce que produit l'invitation. Il ne devient pas souscripteur : il
 * travaille sous l'abonnement de l'entreprise.
 *
 * Passe par l'Edge Function `create-member` : créer un compte pour autrui exige
 * `service_role`, qui n'a rien à faire dans un navigateur. La fonction vérifie
 * `member.invite` avant d'agir, et insère l'appartenance sous la RLS de
 * l'appelant — quota et interdiction d'escalade compris.
 */
export async function createMemberAccount(input: {
  organizationId: string;
  email: string;
  role: OrgRole;
  displayName?: string;
  jobTitle?: string;
  password?: string;
}): Promise<CreatedMemberAccount> {
  const result = (await supabase.functions.invoke('create-member', {
    body: input,
  })) as { data: (CreatedMemberAccount & { error?: string }) | null; error: Error | null };

  const { data, error } = result;

  if (error) {
    // Le motif précis vit dans le corps de la réponse, que `functions.invoke`
    // n'expose que par `context`. Sans cette lecture, « quota atteint » et
    // « adresse déjà utilisée » deviendraient le même message opaque.
    let reason = "La création du compte a échoué.";

    const response: unknown = (error as { context?: unknown }).context;
    if (response instanceof Response) {
      try {
        const body = (await response.clone().json()) as { error?: string };
        if (typeof body.error === 'string') reason = body.error;
      } catch {
        // Réponse non-JSON : le message générique reste le plus utile.
      }
    }

    throw new AppError('forbidden', reason, { cause: error });
  }

  if (!data?.password) {
    throw new AppError('unknown', "Le compte a été créé mais ses accès n'ont pas été renvoyés.");
  }

  return { email: data.email, password: data.password, userId: data.userId };
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

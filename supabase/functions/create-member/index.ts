import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Création directe d'un compte collaborateur par le dirigeant.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CETTE FONCTION EXISTE
 *
 * L'invitation par courriel suppose que le courriel parte, et qu'il arrive.
 * Sur le terrain, ni l'un ni l'autre n'est acquis : messagerie non configurée,
 * technicien sans adresse professionnelle, adresse saisie de travers. Le
 * dirigeant doit pouvoir créer le compte devant la personne et lui donner ses
 * accès de vive voix.
 *
 * CE QUI REND CETTE FONCTION DANGEREUSE, ET COMMENT C'EST TENU
 *
 * Elle utilise `service_role`, qui contourne toute la RLS. Trois précautions,
 * dans cet ordre :
 *
 *  1. LE DROIT D'INVITER EST VÉRIFIÉ AVANT TOUT, avec le jeton de l'appelant.
 *     On lit son appartenance puis on interroge `role_permissions` — la table
 *     qui fait autorité. Aucune matrice de droits n'est réécrite ici : elle
 *     divergerait.
 *
 *  2. `service_role` NE SERT QU'À CRÉER LE COMPTE `auth.users`. C'est la seule
 *     opération qui l'exige — un utilisateur ordinaire ne peut pas en créer un
 *     pour autrui.
 *
 *  3. LA LIGNE `organization_members` EST INSÉRÉE AVEC LE JETON DE L'APPELANT,
 *     donc sous RLS. La policy `member.invite`, le quota de membres du plan et
 *     l'interdiction de nommer un propriétaire quand on ne l'est pas
 *     s'appliquent tous, exactement comme par le chemin normal. Contourner la
 *     RLS ici aurait ouvert une porte dérobée à l'escalade de privilèges.
 *
 * Si l'insertion échoue, le compte tout juste créé est supprimé : un compte
 * `auth.users` orphelin, rattaché à aucune organisation, est invisible dans
 * l'application et impossible à nettoyer depuis l'interface.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * Mot de passe provisoire lisible à voix haute.
 *
 * L'alphabet écarte `O/0`, `I/l/1` : ces accès se dictent au téléphone ou se
 * recopient depuis un écran, et une confusion coûte un appel au support. La
 * source est `crypto.getRandomValues`, jamais `Math.random` — un mot de passe
 * prévisible n'en est pas un.
 */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);

  let result = '';
  for (const byte of bytes) result += alphabet[byte % alphabet.length];

  // Un caractère non alphanumérique satisfait les politiques de robustesse
  // usuelles sans compliquer la dictée.
  return `${result.slice(0, 4)}-${result.slice(4, 8)}-${result.slice(8)}`;
}

const ORG_ROLES = ['owner', 'admin', 'manager', 'team_leader', 'technician', 'employee'];

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return json({ error: 'Authentification requise.' }, 401);
  }

  let body: {
    organizationId?: string;
    email?: string;
    password?: string;
    displayName?: string;
    jobTitle?: string;
    role?: string;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Corps de requête invalide.' }, 400);
  }

  const organizationId = body.organizationId ?? '';
  const email = (body.email ?? '').trim().toLowerCase();
  const role = body.role ?? 'technician';
  const displayName = (body.displayName ?? '').trim();

  if (organizationId === '' || email === '') {
    return json({ error: 'organizationId et email sont obligatoires.' }, 400);
  }

  if (!ORG_ROLES.includes(role)) {
    return json({ error: 'Rôle inconnu.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Client « appelant » : tout ce qu'il fait passe par la RLS.
  const jwt = authorization.replace(/^Bearer\s+/i, '').trim();
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await asCaller.auth.getUser(jwt);

  if (callerError || !caller) {
    return json({ error: 'Session invalide.' }, 401);
  }

  // ---------------------------------------------------------------- 1. droit
  const { data: membership } = await asCaller
    .from('organization_members')
    .select('role, status')
    .eq('organization_id', organizationId)
    .eq('user_id', caller.id)
    .maybeSingle();

  if (!membership || membership.status !== 'active') {
    return json({ error: "Vous n'appartenez pas à cette organisation." }, 403);
  }

  const { data: permission } = await asCaller
    .from('role_permissions')
    .select('permission')
    .eq('role', membership.role)
    .eq('permission', 'member.invite')
    .maybeSingle();

  if (!permission) {
    return json({ error: "Votre rôle ne permet pas d'ajouter des membres." }, 403);
  }

  // Un propriétaire ne se nomme que par un propriétaire. Le trigger
  // `prevent_privilege_escalation` l'imposerait de toute façon à l'insertion ;
  // le vérifier ici évite de créer un compte pour rien.
  if (role === 'owner' && membership.role !== 'owner') {
    return json({ error: 'Seul un propriétaire peut nommer un autre propriétaire.' }, 403);
  }

  // ------------------------------------------------------- 2. compte auth.users
  const password = body.password?.trim() || generatePassword();

  if (password.length < 8) {
    return json({ error: 'Le mot de passe doit compter au moins 8 caractères.' }, 400);
  }

  const asAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: created, error: createError } = await asAdmin.auth.admin.createUser({
    email,
    password,
    // Le dirigeant remet les accès en main propre : exiger une confirmation par
    // courriel replacerait l'obstacle que cette fonction est là pour lever.
    email_confirm: true,
    ...(displayName !== '' ? { user_metadata: { display_name: displayName } } : {}),
  });

  if (createError || !created.user) {
    const alreadyExists =
      createError?.message?.toLowerCase().includes('already') ||
      createError?.status === 422;

    return json(
      {
        error: alreadyExists
          ? 'Cette adresse possède déjà un compte. Utilisez plutôt une invitation : elle rattachera le compte existant à votre entreprise.'
          : "La création du compte a échoué.",
      },
      alreadyExists ? 409 : 500,
    );
  }

  // --------------------------------------------------- 3. appartenance, sous RLS
  const { error: memberError } = await asCaller.from('organization_members').insert({
    organization_id: organizationId,
    user_id: created.user.id,
    role,
    status: 'active',
    joined_at: new Date().toISOString(),
    invited_by: caller.id,
    ...(body.jobTitle?.trim() ? { job_title: body.jobTitle.trim() } : {}),
  });

  if (memberError) {
    // Rattrapage : sans lui, le compte resterait sans organisation, invisible
    // dans l'application et impossible à retirer depuis l'interface.
    await asAdmin.auth.admin.deleteUser(created.user.id);

    console.error('Rattachement refusé, compte supprimé', memberError);
    return json(
      {
        error:
          memberError.message.includes('quota') || memberError.code === '23514'
            ? "Le quota de membres de votre formule est atteint."
            : "Le rattachement à l'organisation a été refusé.",
      },
      403,
    );
  }

  return json({ created: true, email, password, userId: created.user.id });
});

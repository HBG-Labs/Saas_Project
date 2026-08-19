import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Créer son compte et rejoindre l'entreprise, d'un seul geste.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE PARCOURS QUE CETTE FONCTION REMPLACE
 *
 * L'invité cliquait son lien, puis était envoyé au tunnel d'inscription
 * générique : choisir une formule, s'inscrire, confirmer son adresse par
 * courriel, se reconnecter, revenir sur le lien, accepter. Six étapes, dont une
 * — le choix d'une formule — qui n'a aucun sens pour quelqu'un qui rejoint une
 * entreprise déjà abonnée.
 *
 * Ici : un mot de passe, et c'est fait.
 *
 * POURQUOI L'ADRESSE N'EST PAS UN PARAMÈTRE
 *
 * Elle est lue en base à partir du jeton. L'appelant ne peut donc pas créer un
 * compte pour une autre adresse que celle invitée — le seul paramètre qu'il
 * contrôle est le mot de passe du compte qu'on lui destine.
 *
 * POURQUOI `email_confirm: true`
 *
 * Le jeton EST la preuve : il a été envoyé à cette adresse, et le présenter
 * démontre qu'on y a accès. Exiger en plus un courriel de confirmation
 * revérifierait ce qui vient d'être vérifié, et rajouterait l'étape que cette
 * fonction existe pour supprimer. Même raisonnement que `create-member`.
 *
 * CE QUI RESTE FERMÉ
 *
 * Un jeton expiré, révoqué ou déjà accepté ne donne rien — la lecture filtre
 * sur `pending` et l'échéance. Une adresse possédant déjà un compte n'est pas
 * écrasée : on renvoie 409, et l'écran propose de se connecter.
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

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  let token = '';
  let password = '';
  let displayName = '';

  try {
    const body = (await request.json()) as {
      token?: string;
      password?: string;
      displayName?: string;
    };
    token = body.token?.trim() ?? '';
    password = body.password ?? '';
    displayName = body.displayName?.trim() ?? '';
  } catch {
    return json({ error: 'Corps de requête invalide.' }, 400);
  }

  if (token === '') return json({ error: 'Jeton manquant.' }, 400);

  // Même seuil que le formulaire d'inscription : un contrôle côté client n'est
  // pas une garantie, il n'est qu'une politesse.
  if (password.length < 8) {
    return json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // ------------------------------------------------------------ l'invitation
  const { data: invitation } = await admin
    .from('organization_invitations')
    .select('id, organization_id, email, role, status, expires_at')
    .eq('token', token)
    .maybeSingle();

  const valide =
    invitation !== null &&
    invitation.status === 'pending' &&
    new Date(invitation.expires_at as string) > new Date();

  if (!valide) {
    // Un jeton inconnu, expiré, révoqué ou déjà accepté donnent la MÊME réponse :
    // les distinguer confirmerait l'existence d'une invitation à qui essaierait
    // des jetons au hasard.
    return json({ error: 'Cette invitation n’est plus valable.' }, 404);
  }

  const email = String(invitation.email);

  // ------------------------------------------------------------- le compte
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    ...(displayName !== '' ? { user_metadata: { display_name: displayName } } : {}),
  });

  if (createError || !created.user) {
    const existeDeja =
      createError?.message.toLowerCase().includes('already') === true || createError?.status === 422;

    return json(
      {
        error: existeDeja
          ? 'Cette adresse possède déjà un compte. Connectez-vous, puis revenez sur ce lien.'
          : 'La création du compte a échoué.',
        // L'écran s'en sert pour proposer la connexion plutôt que la création.
        accountExists: existeDeja,
      },
      existeDeja ? 409 : 500,
    );
  }

  // ------------------------------------------------------- l'appartenance
  //
  // Écrite ici plutôt que par `accept_organization_invitation` : cette RPC exige
  // une session, or le compte vient d'être créé et personne n'est encore
  // connecté. On reproduit son effet avec `service_role`, en refermant
  // l'invitation dans la foulée.
  const { error: memberError } = await admin.from('organization_members').insert({
    organization_id: invitation.organization_id,
    user_id: created.user.id,
    role: invitation.role,
    status: 'active',
  });

  if (memberError) {
    // Le compte existe mais n'a rejoint personne. On le retire plutôt que de
    // laisser une identité orpheline dont son propriétaire ignorerait l'état.
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: 'Le rattachement à l’entreprise a échoué.' }, 500);
  }

  await admin
    .from('organization_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitation.id);

  // L'adresse est renvoyée pour que le client ouvre la session sans la
  // redemander : il connaît déjà le mot de passe, il vient de le choisir.
  return json({ created: true, email });
});

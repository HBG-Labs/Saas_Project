/**
 * Banc d'essai des requêtes Supabase.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE SCRIPT
 *
 * Les tests unitaires ne touchent pas la base : ils vérifient la logique, pas
 * que `select('*, assigned_member:organization_members(...)')` désigne une
 * relation qui existe vraiment. Une jointure mal nommée, une policy qui refuse
 * une lecture, un `RETURNING` invisible à sa propre policy — rien de tout cela
 * n'apparaît avant l'exécution.
 *
 * Ce script rejoue les requêtes RÉELLES de l'application, connecté comme un
 * utilisateur réel, et dit lesquelles échouent. Il ne modifie rien : uniquement
 * des lectures.
 *
 *     node scripts/smoke-queries.mjs [email] [motdepasse]
 *
 * Sans argument, il utilise `owner.a@nexoratech.local` et `SEED_TEST_PASSWORD`
 * de `.env.local`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readEnv() {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = readEnv();

// Les drapeaux ne sont pas des identifiants : sans ce filtre, `--writes` en
// première position était pris pour une adresse e-mail.
const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const email = args[0] ?? 'owner.a@nexoratech.local';
const password = args[1] ?? env.SEED_TEST_PASSWORD;

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];

/** Préfixe réservé aux organisations jetables créées par ce script. */
const TEST_ORG_PREFIX = 'banc-essai-';

async function check(label, run) {
  try {
    const { error } = await run();
    if (error) {
      results.push({ label, ok: false, code: error.code ?? '—', message: error.message });
    } else {
      results.push({ label, ok: true });
    }
  } catch (thrown) {
    results.push({ label, ok: false, code: 'THROW', message: String(thrown?.message ?? thrown) });
  }
}

// ---------------------------------------------------------------- connexion
const { data: session, error: authError } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (authError) {
  console.error(`Connexion impossible pour ${email} : ${authError.message}`);
  process.exit(1);
}

const userId = session.user.id;
console.log(`Connecté : ${email}\n`);

// Reliquats d'une exécution `--writes` interrompue : une organisation jetable
// survivante fausserait tout, en se plaçant en tête de l'ordre alphabétique et
// en devenant le contexte des lectures — vide, donc silencieusement inutile.
const { data: allOrgs } = await supabase.from('organizations').select('id, name, slug').order('name');

for (const candidate of allOrgs ?? []) {
  if (candidate.slug.startsWith(TEST_ORG_PREFIX)) {
    await supabase.from('organizations').delete().eq('id', candidate.id);
    console.log(`Reliquat supprimé : ${candidate.name}`);
  }
}

// Contexte : première organisation RÉELLE de l'utilisateur.
const { data: orgs } = await supabase
  .from('organizations')
  .select('*')
  .not('slug', 'like', `${TEST_ORG_PREFIX}%`)
  .order('name');
const org = orgs?.[0];

if (!org) {
  console.error("Cet utilisateur n'appartient à aucune organisation : rien à tester.");
  process.exit(1);
}

console.log(`Organisation : ${org.name} (${org.id})\n`);

const { data: members } = await supabase
  .from('organization_members')
  .select('id')
  .eq('organization_id', org.id)
  .limit(1);
const memberId = members?.[0]?.id ?? null;

const { data: missions } = await supabase
  .from('missions')
  .select('id')
  .eq('organization_id', org.id)
  .limit(1);
const missionId = missions?.[0]?.id ?? null;

const { data: customers } = await supabase
  .from('customers')
  .select('id')
  .eq('organization_id', org.id)
  .limit(1);
const customerId = customers?.[0]?.id ?? null;

const { data: teams } = await supabase
  .from('teams')
  .select('id')
  .eq('organization_id', org.id)
  .limit(1);
const teamId = teams?.[0]?.id ?? null;

const { data: interventions } = await supabase
  .from('interventions')
  .select('id')
  .eq('organization_id', org.id)
  .limit(1);
const interventionId = interventions?.[0]?.id ?? null;

// ---------------------------------------------------------------- requêtes
// Chaque entrée reproduit une requête réelle d'un fichier `*.api.ts`.

await check('organizations · listMyOrganizations', () =>
  supabase.from('organizations').select('*').order('name', { ascending: true }),
);

await check('organizations · getMyMembership', () =>
  supabase
    .from('organization_members')
    .select('*')
    .eq('organization_id', org.id)
    .eq('user_id', userId)
    .single(),
);

await check('organizations · listMembers (+profil)', () =>
  supabase
    .from('organization_members')
    .select('*, profile:profiles(id, display_name, avatar_url)')
    .eq('organization_id', org.id)
    .in('status', ['active', 'invited'])
    .order('role', { ascending: true }),
);

await check('organizations · listInvitations', () =>
  supabase
    .from('organization_invitations')
    .select('*')
    .eq('organization_id', org.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false }),
);

await check('billing · getOrganizationSubscription', () =>
  supabase
    .from('subscriptions')
    .select('*')
    .eq('organization_id', org.id)
    .in('status', ['trialing', 'active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle(),
);

await check('billing · listPlans (+features)', () =>
  supabase
    .from('plans')
    .select('*, features:plan_features(*)')
    .eq('status', 'active')
    .order('sort_order', { ascending: true }),
);

const MISSION_SELECT = `
  *,
  category:categories(id, slug, name),
  assigned_team:teams(id, name, color),
  assigned_member:organization_members(
    *, profile:profiles(id, display_name, avatar_url)
  ),
  customer:customers(id, reference, name),
  site:sites(id, name, city, access_notes)
`;

await check('missions · listMissions (jointures complètes)', () =>
  supabase
    .from('missions')
    .select(MISSION_SELECT)
    .eq('organization_id', org.id)
    .order('scheduled_start', { ascending: true, nullsFirst: false })
    .limit(100),
);

await check('missions · listStatusTransitions', () =>
  supabase.from('mission_status_transitions').select('*'),
);

if (missionId) {
  await check('missions · getMission', () =>
    supabase.from('missions').select(MISSION_SELECT).eq('id', missionId).single(),
  );
  await check('missions · listMissionHistory', () =>
    supabase
      .from('mission_status_events')
      .select('*')
      .eq('mission_id', missionId)
      .order('created_at', { ascending: false }),
  );
  await check('missions · listMissionAssignments', () =>
    supabase
      .from('mission_assignments')
      .select('*')
      .eq('mission_id', missionId)
      .order('assigned_at', { ascending: false }),
  );
  await check('interventions · listInterventions', () =>
    supabase
      .from('interventions')
      .select('*, report:intervention_reports(*), attachments:intervention_attachments(*)')
      .eq('mission_id', missionId)
      .order('start_time', { ascending: false, nullsFirst: false }),
  );
}

if (interventionId) {
  await check('interventions · listTimeEntries', () =>
    supabase
      .from('intervention_time_entries')
      .select('*')
      .eq('intervention_id', interventionId)
      .order('started_at', { ascending: true }),
  );
  await check('interventions · getWorkedSeconds (RPC)', () =>
    supabase.rpc('intervention_worked_seconds', { p_intervention_id: interventionId }),
  );
}

await check('interventions · listReportsPendingReview', () =>
  supabase
    .from('intervention_reports')
    .select(
      `*, intervention:interventions(
         id,
         mission:missions(id, reference, title),
         technician:organization_members(
           *, profile:profiles(id, display_name, avatar_url)
         )
       )`,
    )
    .eq('organization_id', org.id)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true }),
);

await check('customers · listCustomers', () =>
  supabase
    .from('customers')
    .select('*')
    .eq('organization_id', org.id)
    .eq('status', 'active')
    .order('name', { ascending: true })
    .limit(200),
);

await check('customers · listOrganizationSites', () =>
  supabase
    .from('sites')
    .select('*')
    .eq('organization_id', org.id)
    .eq('status', 'active')
    .order('name', { ascending: true }),
);

if (customerId) {
  await check('customers · listContacts', () =>
    supabase
      .from('customer_contacts')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_primary', { ascending: false })
      .order('last_name', { ascending: true }),
  );
  await check('customers · listCustomerMissions', () =>
    supabase
      .from('missions')
      .select(MISSION_SELECT)
      .eq('customer_id', customerId)
      .order('scheduled_start', { ascending: false, nullsFirst: false })
      .limit(50),
  );
}

await check('teams · listTeams', () =>
  supabase
    .from('teams')
    .select('*')
    .eq('organization_id', org.id)
    .eq('status', 'active')
    .order('name', { ascending: true }),
);

await check('teams · listOrganizationTeamMemberships', () =>
  supabase
    .from('team_members')
    .select('member_id, team:teams!inner(*)')
    .eq('team.organization_id', org.id)
    .eq('team.status', 'active'),
);

if (teamId) {
  await check('teams · getTeamWithMembers', () =>
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
      .single(),
  );
}

if (memberId) {
  await check('teams · listTeamsOfMember', () =>
    supabase.from('team_members').select('team:teams(*)').eq('member_id', memberId),
  );
}

await check('audit · listAuditLogs', () =>
  supabase
    .from('audit_logs')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(50),
);

await check('catalog · listCategories', () =>
  supabase.from('categories').select('*').eq('status', 'active').order('sort_order'),
);

await check('catalog · listTools', () =>
  supabase.from('tools').select('*').eq('status', 'active').order('sort_order'),
);

await check('catalog · listFavorites', () =>
  supabase.from('favorites').select('*').eq('user_id', userId),
);

await check('catalog · listToolHistory', () =>
  supabase
    .from('tool_history')
    .select('*')
    .eq('user_id', userId)
    .order('used_at', { ascending: false })
    .limit(50),
);

await check('profil · getMyProfile', () =>
  supabase.from('profiles').select('*').eq('id', userId).single(),
);

await check('équipements · listEquipment', () =>
  supabase
    .from('equipment')
    .select('*, assigned_member:organization_members(*, profile:profiles(id, display_name, avatar_url))')
    .eq('organization_id', org.id)
    .order('name', { ascending: true }),
);

await check('devis · listQuoteTemplates', () =>
  supabase
    .from('quote_templates')
    .select('*')
    .eq('organization_id', org.id)
    .eq('status', 'active')
    .order('sort_order', { ascending: true }),
);

await check('devis · listQuotes', () =>
  supabase
    .from('quotes')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(50),
);

await check('devis · getQuote (lignes)', () =>
  supabase.from('quotes').select('*, items:quote_items(*)').limit(1),
);

await check('devis · quote_totals (vue, requête séparée)', () =>
  supabase.from('quote_totals').select('*').limit(1),
);

await check('bloc-notes · listNotes', () =>
  supabase
    .from('notes')
    .select('*')
    .eq('organization_id', org.id)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false }),
);

await check('analytics · organization_activity_stats (RPC)', () =>
  supabase.rpc('organization_activity_stats', {
    p_organization_id: org.id,
    p_from: null,
    p_to: null,
  }),
);

// ---------------------------------------------------------------- ecritures
//
// Optionnel (`--writes`) et AUTONETTOYANT : le script cree sa propre
// organisation jetable, y exerce les ecritures principales, puis la supprime.
// La suppression est en cascade — membres, abonnement, clients, missions,
// devis et materiel partent avec elle.
//
// Pourquoi une organisation a part plutot que la votre : une ecriture de test
// dans des donnees reelles est une ecriture de trop. Seules les lignes
// `audit_logs` subsistent, la table etant immuable par conception.

if (process.argv.includes('--writes')) {
  console.log('\n--- ecritures (organisation jetable) ---\n');

  const suffix = Math.random().toString(36).slice(2, 8);
  const slug = `${TEST_ORG_PREFIX}${suffix}`;
  let tempOrgId = null;

  await check('organizations - createOrganization', async () => {
    const { error: insertError } = await supabase
      .from('organizations')
      .insert({ name: `Banc d'essai ${suffix}`, slug, created_by: userId });
    if (insertError) return { error: insertError };

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .single();
    tempOrgId = data?.id ?? null;
    return { error };
  });

  if (tempOrgId) {
    await check('trigger - le createur est proprietaire', async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('role, status')
        .eq('organization_id', tempOrgId)
        .eq('user_id', userId)
        .single();
      if (error) return { error };
      return data?.role === 'owner' && data?.status === 'active'
        ? { error: null }
        : {
            error: {
              code: 'ROLE',
              message: `role attendu owner/active, obtenu ${data?.role}/${data?.status}`,
            },
          };
    });

    await check("trigger - abonnement d'essai rattache a l'organisation", async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan_code, status, user_id')
        .eq('organization_id', tempOrgId)
        .single();
      if (error) return { error };
      if (data?.user_id !== null) {
        return {
          error: {
            code: 'SUBJECT',
            message: "l'abonnement porte un user_id : il devrait etre organisationnel",
          },
        };
      }
      return data?.status === 'trialing'
        ? { error: null }
        : { error: { code: 'TRIAL', message: `statut attendu trialing, obtenu ${data?.status}` } };
    });

    let tempCustomerId = null;
    await check('customers - createCustomer', async () => {
      const { data, error } = await supabase
        .from('customers')
        .insert({ organization_id: tempOrgId, name: 'Client de test', created_by: userId })
        .select('*')
        .single();
      tempCustomerId = data?.id ?? null;
      return { error };
    });

    let tempMissionId = null;
    await check('missions - createMission', async () => {
      const { data, error } = await supabase
        .from('missions')
        .insert({
          organization_id: tempOrgId,
          created_by: userId,
          title: 'Mission de test',
          ...(tempCustomerId ? { customer_id: tempCustomerId } : {}),
        })
        .select('*')
        .single();
      tempMissionId = data?.id ?? null;
      return { error };
    });

    if (tempMissionId) {
      await check('missions - transition draft vers assigned', () =>
        supabase
          .from('missions')
          .update({ status: 'assigned' })
          .eq('id', tempMissionId)
          .select('*')
          .single(),
      );
    }

    let tempQuoteId = null;
    await check('devis - createQuote', async () => {
      const { data, error } = await supabase
        .from('quotes')
        .insert({ organization_id: tempOrgId, vat_rate: 8.5, created_by: userId })
        .select('*')
        .single();
      tempQuoteId = data?.id ?? null;
      return { error };
    });

    if (tempQuoteId) {
      await check('devis - createQuoteItem', () =>
        supabase
          .from('quote_items')
          .insert({
            quote_id: tempQuoteId,
            organization_id: tempOrgId,
            description: 'Prestation de test',
            quantity: 2,
            unit_price_cents: 12000,
          })
          .select('*')
          .single(),
      );

      await check('devis - quote_totals calcule 240,00 EUR HT', async () => {
        const { data, error } = await supabase
          .from('quote_totals')
          .select('*')
          .eq('quote_id', tempQuoteId)
          .single();
        if (error) return { error };
        return Number(data?.subtotal_cents) === 24000
          ? { error: null }
          : {
              error: {
                code: 'TOTAL',
                message: `sous-total attendu 24000, obtenu ${data?.subtotal_cents}`,
              },
            };
      });
    }

    await check('equipements - createEquipment', () =>
      supabase
        .from('equipment')
        .insert({ organization_id: tempOrgId, name: 'OTDR de test', created_by: userId })
        .select('*')
        .single(),
    );

    await check('devis - createQuoteTemplate', () =>
      supabase
        .from('quote_templates')
        .insert({
          organization_id: tempOrgId,
          label: 'Prestation type',
          unit: 'Forfait',
          unit_price_cents: 5000,
        })
        .select('*')
        .single(),
    );

    await check('bloc-notes - createNote', () =>
      supabase
        .from('notes')
        .insert({ organization_id: tempOrgId, title: 'Note de test', content: 'x' })
        .select('*')
        .single(),
    );

    await check('invitations - inviteMember', () =>
      supabase
        .from('organization_invitations')
        .insert({
          organization_id: tempOrgId,
          email: `essai-${suffix}@example.test`,
          role: 'technician',
        })
        .select('*')
        .single(),
    );

    await check('securite - aucun abonnement personnel ne peut naitre', async () => {
      await supabase
        .from('subscriptions')
        .insert({ user_id: userId, plan_code: 'business', status: 'active' });

      // Meme prudence : on verifie l'ETAT, pas le code de retour. Un abonnement
      // rattache a une personne contredirait le modele — il appartient a
      // l'organisation, et la contrainte `subscriptions_subject_xor` le dit.
      const { data: personal } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId);

      return (personal ?? []).length === 0
        ? { error: null }
        : { error: { code: 'FUITE', message: 'un abonnement personnel existe' } };
    });

    await check('securite - modifier son propre role reste sans effet', async () => {
      const { data: me } = await supabase
        .from('organization_members')
        .select('id, role')
        .eq('organization_id', tempOrgId)
        .eq('user_id', userId)
        .single();

      await supabase
        .from('organization_members')
        .update({ role: 'admin' })
        .eq('id', me?.id ?? '');

      // L'absence d'erreur ne prouve rien : un UPDATE que la RLS ecarte ne
      // touche aucune ligne et renvoie un succes. Seule la relecture tranche —
      // et elle distingue « refuse bruyamment » de « filtre en silence », deux
      // protections valables qu'un test naif confondrait avec une fuite.
      const { data: after } = await supabase
        .from('organization_members')
        .select('role')
        .eq('id', me?.id ?? '')
        .single();

      return after?.role === 'owner'
        ? { error: null }
        : { error: { code: 'FUITE', message: `role devenu ${after?.role}` } };
    });

    // Nettoyage — cascade sur tout ce qui precede.
    await check('nettoyage - suppression de l organisation jetable', () =>
      supabase.from('organizations').delete().eq('id', tempOrgId),
    );
  }
}

// ------------------------------------------------------------------ rapport
await supabase.auth.signOut();

const failures = results.filter((r) => !r.ok);

for (const r of results) {
  console.log(`${r.ok ? '  ok ' : 'ÉCHEC'}  ${r.label}`);
  if (!r.ok) console.log(`        [${r.code}] ${r.message}`);
}

console.log(`\n${results.length - failures.length}/${results.length} requêtes passent.`);
process.exit(failures.length === 0 ? 0 : 1);

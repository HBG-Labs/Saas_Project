-- =============================================================================
-- Comptes de démonstration — deux par formule, deux rôles par entreprise
-- =============================================================================
--
-- CE QUE CE FICHIER FABRIQUE
--
-- Dix comptes, quatre entreprises. Chaque formule payante reçoit UNE entreprise
-- peuplée de deux comptes : son propriétaire, et un second à rôle réduit. Les
-- deux axes du produit se testent alors sur le même écran — l'abonnement dit
-- *combien*, le rôle dit *par qui*.
--
--   Formule      Entreprise                 Métier           Comptes
--   free         — (aucune)                 —                2 comptes solo
--   starter      REZO360 Démo Starter       fiber_telecom    owner + technician
--   pro          REZO360 Démo Pro           hvac             owner + manager
--   business     REZO360 Démo Business      fiber_telecom    owner + admin
--   enterprise   REZO360 Démo Enterprise    landscaping      owner + team_leader
--
-- POURQUOI LES DEUX COMPTES GRATUITS N'ONT PAS D'ENTREPRISE
--
-- `plans.max_users = 1` plafonne Free à un siège : deux comptes ne peuvent pas
-- cohabiter dans une entreprise Gratuite. Et la formule Gratuite n'ouvre AUCUN
-- module professionnel — `plan_features` ne lui accorde que `catalog_access`,
-- `calculation_history` (10) et `favorites` (3). Une entreprise Gratuite est
-- donc une coquille vide : l'état réel d'un compte Gratuit, c'est un utilisateur
-- seul devant les calculateurs. C'est celui-là qu'on reproduit.
--
-- Corollaire à connaître avant de s'en étonner : créer une entreprise depuis
-- l'un de ces comptes déclenche `app.start_organization_trial`, donc un essai
-- Business de quatorze jours. On ne « reste » pas Gratuit en créant une
-- entreprise ; on y retombe quand l'essai expire.
--
-- POURQUOI ON ÉCRIT DANS `auth.users` PLUTÔT QUE DE S'INSCRIRE
--
-- Une inscription par l'API exige une adresse qui reçoit vraiment le courriel de
-- confirmation. Les adresses `@rezo360.test` n'en reçoivent aucun : on pose donc
-- `email_confirmed_at` nous-mêmes. La contrepartie est explicite — « mot de
-- passe oublié » ne fonctionnera jamais sur ces comptes.
--
-- La ligne jumelle dans `auth.identities` n'est pas décorative : GoTrue y lit
-- l'identité du fournisseur `email`, et un compte qui n'en a pas se comporte
-- comme un compte sans méthode de connexion. Les colonnes de jetons sont mises
-- à la chaîne vide plutôt que laissées à NULL : GoTrue les lit comme des
-- chaînes non nullables.
--
-- POURQUOI L'ABONNEMENT EST CORRIGÉ APRÈS COUP, ET NON POSÉ DIRECTEMENT
--
-- `organizations_start_trial` insère un essai Business à chaque création
-- d'entreprise, et son garde-fou refuse d'écrire si une ligne existe déjà. On ne
-- peut donc pas devancer le trigger : on le laisse écrire, puis on remplace la
-- formule et le statut. `subscriptions_sync_org_plan` recopie ensuite le code de
-- formule sur `organizations.plan_code`, sans qu'on ait à y toucher.
--
-- IDEMPOTENT, ET STRICTEMENT BORNÉ
--
-- Le script commence par effacer ce qu'il avait créé — les entreprises dont le
-- slug commence par `demo-`, puis les comptes du domaine `@rezo360.test`. Rien
-- d'autre n'est touché. L'ordre importe : supprimer l'entreprise d'abord fait
-- disparaître ses membres par cascade, ce que `app.protect_last_owner` autorise
-- uniquement quand l'entreprise elle-même n'existe plus.
--
--     npx supabase db query --linked --file supabase/seed/demo_accounts.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fabrique d'un compte connectable
-- -----------------------------------------------------------------------------
-- `pg_temp` plutôt que le schéma `app` : cette fonction n'est utile qu'au temps
-- du script et disparaît avec la session. Une fabrique de comptes laissée en
-- place serait une porte ouverte permanente sur `auth.users`.
create or replace function pg_temp.seed_demo_user(
  p_email    text,
  p_name     text,
  p_password text
)
returns uuid
language plpgsql
as $fn$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', p_name, 'email_verified', true),
    now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  values (
    v_id::text, v_id,
    jsonb_build_object(
      'sub', v_id::text, 'email', p_email,
      'email_verified', true, 'phone_verified', false
    ),
    'email', now(), now(), now()
  );

  return v_id;
end;
$fn$;

do $seed$
declare
  -- Un seul mot de passe pour les dix comptes : ce sont des comptes de
  -- démonstration, pas des comptes réels. `password_min_length` vaut 8.
  v_password constant text := 'Rezo360!2026';

  -- entreprise : slug, nom, métier, formule, rôle du second compte
  v_orgs constant text[][] := array[
    array['demo-starter',    'REZO360 Démo Starter',    'fiber_telecom', 'starter',    'technician'],
    array['demo-pro',        'REZO360 Démo Pro',        'hvac',          'pro',        'manager'],
    array['demo-business',   'REZO360 Démo Business',   'fiber_telecom', 'business',   'admin'],
    array['demo-enterprise', 'REZO360 Démo Enterprise', 'landscaping',   'enterprise', 'team_leader']
  ];

  -- comptes : préfixe d'adresse et nom affiché, propriétaire puis second
  v_people constant text[][] := array[
    array['starter.owner',    'Propriétaire Starter',    'starter.tech',    'Technicien Starter'],
    array['pro.owner',        'Propriétaire Pro',        'pro.manager',     'Manager Pro'],
    array['business.owner',   'Propriétaire Business',   'business.admin',  'Admin Business'],
    array['enterprise.owner', 'Propriétaire Enterprise', 'enterprise.lead', 'Chef equipe Enterprise']
  ];

  v_owner uuid;
  v_mate  uuid;
  v_org   uuid;
  i       integer;
begin
  -- ─────────────────────────────────────────────── remise à zéro, bornée
  delete from public.organizations where slug like 'demo-%';
  delete from auth.users where email like '%@rezo360.test';

  -- ─────────────────────────────────────────────── les deux comptes Gratuits
  perform pg_temp.seed_demo_user('free.a@rezo360.test', 'Compte Gratuit A', v_password);
  perform pg_temp.seed_demo_user('free.b@rezo360.test', 'Compte Gratuit B', v_password);

  -- ─────────────────────────────────────────── les quatre formules payantes
  for i in 1 .. array_length(v_orgs, 1) loop
    v_owner := pg_temp.seed_demo_user(v_people[i][1] || '@rezo360.test', v_people[i][2], v_password);
    v_mate  := pg_temp.seed_demo_user(v_people[i][3] || '@rezo360.test', v_people[i][4], v_password);

    -- `created_by` déclenche `handle_new_organization` (membre propriétaire)
    -- puis `start_organization_trial` (essai Business de quatorze jours).
    insert into public.organizations (slug, name, industry, created_by, email, country)
    values (
      v_orgs[i][1], v_orgs[i][2], v_orgs[i][3], v_owner,
      v_orgs[i][1] || '@rezo360.test', 'FR'
    )
    returning id into v_org;

    -- L'essai posé par le trigger devient l'abonnement voulu. Un an de période
    -- courante : `app.org_plan_code` écarte tout abonnement dont
    -- `current_period_end` est dépassé, et un essai de quatorze jours ferait
    -- retomber la démonstration en Gratuit sans prévenir.
    update public.subscriptions
    set plan_code            = v_orgs[i][4],
        status               = 'active',
        current_period_start = now(),
        current_period_end   = now() + interval '1 year',
        trial_ends_at        = null,
        cancel_at_period_end = false
    where organization_id = v_org;

    -- Le second compte. `app.prevent_privilege_escalation` ne s'applique pas
    -- ici : sans session, `auth.uid()` est NULL et la règle s'efface — c'est le
    -- cas « tâche serveur » qu'elle prévoit explicitement.
    insert into public.organization_members (organization_id, user_id, role, status, joined_at)
    values (v_org, v_mate, v_orgs[i][5]::public.org_role, 'active', now());
  end loop;
end
$seed$;

-- -----------------------------------------------------------------------------
-- Récapitulatif — lu depuis la base, pas depuis le script
-- -----------------------------------------------------------------------------
-- La colonne « formule » passe par `app.org_effective_plan`, celle-là même qui
-- décide des droits, et non par `subscriptions.plan_code` : ce qui est annoncé
-- ici est donc ce que l'application appliquera.
select
  u.email,
  p.display_name              as compte,
  coalesce(o.name, '—')       as entreprise,
  coalesce(m.role::text, '—') as role,
  coalesce(app.org_effective_plan(o.id), 'free') as formule,
  coalesce(o.industry, '—')   as metier
from auth.users u
join public.profiles p                  on p.id = u.id
left join public.organization_members m on m.user_id = u.id
left join public.organizations o        on o.id = m.organization_id
where u.email like '%@rezo360.test'
order by
  case coalesce(o.plan_code, 'free')
    when 'free' then 0 when 'starter' then 1 when 'pro' then 2
    when 'business' then 3 else 4 end,
  m.role;

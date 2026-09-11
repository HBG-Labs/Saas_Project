-- =============================================================================
-- Nettoyage pré-production : retrait des données de démonstration
-- =============================================================================
--
-- CE FICHIER N'EST PAS UNE MIGRATION. Il ne décrit aucun schéma et ne doit
-- jamais être joué automatiquement : c'est une opération ponctuelle, datée,
-- conservée pour la traçabilité de ce qui a été supprimé et sur quels critères.
--
-- Lancement :
--     npx supabase db query --linked -f supabase/maintenance/20260911_nettoyage_pre_production.sql
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CE QUI EST CONSERVÉ, ET POURQUOI C'EST ÉCRIT ICI
--
-- Les cibles sont désignées par des critères LISIBLES — noms d'organisation et
-- adresses — jamais par des UUID recopiés à la main : une coquille dans un UUID
-- ne se voit pas à la relecture, un nom d'entreprise si.
--
-- Sont explicitement hors périmètre, sur décision de l'exploitant :
--   • leduc972@live.fr et son organisation HBG Labs (247 lignes, 10 fichiers)
--   • harrybergoz@gmail.com et son organisation HBG Labs
--   • autopack.antilles@gmail.com / TRANSPACK SERVICES
--   • lionelcabrimol9@gmail.com / AB
--   • aurelie.belli@gmail.com
--   • REZOFREE Elec — organisation de démonstration MAIS porteuse d'un
--     abonnement Stripe réel (sub_1UBT9P…)
--   • free.a@rezo360.test — conservé UNIQUEMENT parce qu'il est l'unique
--     propriétaire de REZOFREE Elec. Le supprimer laisserait cette organisation
--     sans propriétaire, c'est-à-dire orpheline.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POURQUOI `audit_logs` ET `stripe_events` SONT SUPPRIMÉS AVANT LES ORGANISATIONS
--
-- Sur les 44 clés étrangères qui pointent vers `organizations`, 41 sont en
-- CASCADE — mais `audit_logs.organization_id`, `stripe_events.organization_id`
-- et `trial_card_fingerprints.organization_id` sont en SET NULL. Supprimer une
-- organisation ne supprimerait donc PAS ces lignes : elle les laisserait en
-- base, rattachées à plus rien. Elles sont traitées d'abord, nommément.
--
-- Même raison pour `support_requests.user_id`, en SET NULL vers `auth.users`.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Les cibles, nommées
-- -----------------------------------------------------------------------------

create temporary table cibles_orgs on commit drop as
select id, name from public.organizations
where name in (
  'REZO360 Démo Enterprise',
  'REZO360 Démo Pro',
  'REZO360 Démo Starter',
  'REZO360 Démo Business',
  'REZO360 Démo Ssdf'
);

create temporary table cibles_users on commit drop as
select id, email from auth.users
where email in (
  'starter.owner@rezo360.test',
  'starter.tech@rezo360.test',
  'pro.owner@rezo360.test',
  'pro.manager@rezo360.test',
  'business.owner@rezo360.test',
  'business.admin@rezo360.test',
  'enterprise.owner@rezo360.test',
  'enterprise.lead@rezo360.test',
  'free.b@rezo360.test',
  -- Deux comptes de test hors seed : adresse tapée au hasard, et compte jamais
  -- confirmé ni connecté. Aucun des deux n'est propriétaire d'une organisation.
  'fehfuef@dfjkod.gt',
  'test97232@live.de'
);

-- -----------------------------------------------------------------------------
-- 2. Gardes — toute anomalie annule l'intégralité de la transaction
-- -----------------------------------------------------------------------------

do $$
declare
  v_orgs integer;
  v_users integer;
begin
  select count(*) into v_orgs from cibles_orgs;
  select count(*) into v_users from cibles_users;

  -- Un compte renommé, un nom d'organisation corrigé, et le périmètre change
  -- en silence. On exige le compte exact attendu au moment de la rédaction.
  if v_orgs <> 5 then
    raise exception 'Périmètre inattendu : % organisation(s) au lieu de 5.', v_orgs;
  end if;
  if v_users <> 11 then
    raise exception 'Périmètre inattendu : % compte(s) au lieu de 11.', v_users;
  end if;

  -- Aucune organisation ne doit se retrouver sans propriétaire.
  if exists (
    select 1
    from public.organization_members m
    where m.user_id in (select id from cibles_users)
      and m.role = 'owner'
      and m.organization_id not in (select id from cibles_orgs)
  ) then
    raise exception 'Un compte ciblé est propriétaire d''une organisation conservée.';
  end if;

  -- Ceinture et bretelles : les entités explicitement conservées ne doivent en
  -- aucun cas figurer dans les cibles, quel qu'ait été le chemin pour y arriver.
  if exists (
    select 1 from cibles_orgs
    where name in ('REZOFREE Elec', 'HBG Labs', 'AB', 'TRANSPACK SERVICES')
  ) then
    raise exception 'Une organisation conservée figure dans les cibles.';
  end if;

  if exists (
    select 1 from cibles_users
    where email in (
      'leduc972@live.fr', 'harrybergoz@gmail.com', 'autopack.antilles@gmail.com',
      'lionelcabrimol9@gmail.com', 'aurelie.belli@gmail.com', 'free.a@rezo360.test'
    )
  ) then
    raise exception 'Un compte conservé figure dans les cibles.';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 3. Suppressions, dans l'ordre imposé par les clés étrangères
-- -----------------------------------------------------------------------------

-- `audit_logs` N'EST PAS SUPPRIMÉ, ET C'EST VOULU.
--
-- Un trigger `audit_logs_immutable` refuse toute suppression sur cette table —
-- essai mesuré : « Le journal d'audit est immuable : ni modification ni
-- suppression. » Une exception, taillée au plus juste par
-- `20260813100300_audit_detachment_exception.sql`, n'autorise QUE la mise à NULL
-- de `organization_id` lorsque l'organisation a réellement disparu.
--
-- Les 63 lignes des organisations de démonstration survivront donc, détachées.
-- C'est le comportement voulu : ce journal existe précisément pour qu'aucun
-- script — celui-ci compris — ne puisse réécrire l'histoire. Les vider
-- supposerait de désactiver le garde-fou, ce que ce fichier ne fera pas.

-- SET NULL vers organizations : à traiter avant, sinon les lignes survivent.
delete from public.stripe_events where organization_id in (select id from cibles_orgs);
delete from public.trial_card_fingerprints where organization_id in (select id from cibles_orgs);

-- SET NULL vers auth.users : même raison.
delete from public.support_requests where user_id in (select id from cibles_users);

-- RESTRICT vers organizations : bloquerait la suppression si des lignes
-- existaient. Aucune ne concerne les cibles ; l'ordre le garantit quand même.
delete from public.invoice_transmission_events    where organization_id in (select id from cibles_orgs);
delete from public.invoice_transmissions          where organization_id in (select id from cibles_orgs);
delete from public.invoice_electronic_documents   where organization_id in (select id from cibles_orgs);

-- Les 41 CASCADE font le reste : membres, missions, interventions, devis,
-- factures, conversations IA, documents, véhicules, abonnements…
delete from public.organizations where id in (select id from cibles_orgs);

-- Puis les comptes : profils, préférences, historique d'outils, formations
-- partent en cascade.
delete from auth.users where id in (select id from cibles_users);

-- -----------------------------------------------------------------------------
-- 4. Contrôles finaux — un échec ici annule tout ce qui précède
-- -----------------------------------------------------------------------------

do $$
declare
  v integer;
begin
  -- Aucune organisation sans propriétaire actif.
  select count(*) into v
  from public.organizations o
  where not exists (
    select 1 from public.organization_members m
    where m.organization_id = o.id and m.role = 'owner' and m.status = 'active'
  );
  if v > 0 then
    raise exception '% organisation(s) se retrouvent sans propriétaire actif.', v;
  end if;

  -- Aucune appartenance ne doit pointer vers un compte disparu.
  select count(*) into v
  from public.organization_members m
  where not exists (select 1 from auth.users u where u.id = m.user_id);
  if v > 0 then
    raise exception '% appartenance(s) pointent vers un compte supprimé.', v;
  end if;

  -- Les référentiels doivent être strictement intacts.
  select count(*) into v from public.plans;
  if v <> 5 then raise exception 'plans : % lignes au lieu de 5.', v; end if;
  select count(*) into v from public.plan_features;
  if v <> 87 then raise exception 'plan_features : % lignes au lieu de 87.', v; end if;
  select count(*) into v from public.role_permissions;
  if v <> 164 then raise exception 'role_permissions : % lignes au lieu de 164.', v; end if;
  select count(*) into v from public.mission_status_transitions;
  if v <> 17 then raise exception 'mission_status_transitions : % lignes au lieu de 17.', v; end if;

  -- Les organisations et comptes conservés doivent être là, tous.
  select count(*) into v from public.organizations
   where name in ('REZOFREE Elec', 'AB', 'TRANSPACK SERVICES');
  if v <> 3 then raise exception 'Organisations conservées : % au lieu de 3.', v; end if;

  select count(*) into v from auth.users
   where email in ('leduc972@live.fr', 'harrybergoz@gmail.com', 'autopack.antilles@gmail.com',
                   'lionelcabrimol9@gmail.com', 'aurelie.belli@gmail.com', 'free.a@rezo360.test');
  if v <> 6 then raise exception 'Comptes conservés : % au lieu de 6.', v; end if;
end
$$;

commit;

-- =============================================================================
-- APRÈS CE SCRIPT — les 4 fichiers Storage, qui ne sont PAS supprimés ici
-- =============================================================================
--
-- Effacer une ligne de `storage.objects` en SQL ne retire que son index : le
-- binaire reste dans le bucket. Le retrait passe donc par l'API :
--
--   npx supabase storage rm --linked --recursive \
--     "ss://intervention-attachments/7f8a5638-0b9d-4fde-b42b-6d18e8907b32"
--   npx supabase storage rm --linked --recursive \
--     "ss://intervention-attachments/875b6b44-4035-4d34-80fc-7ef90af28039"
--
-- Ces deux préfixes sont les identifiants de REZO360 Démo Pro et REZO360 Démo
-- Ssdf. 4 fichiers, tous des images générées (`Gemini_Generated_Image_*.jpg`).
-- =============================================================================

-- =============================================================================
-- SUITE DE TESTS — portail client : identité, messagerie, cloisonnement
-- =============================================================================
-- Couvre, côté base, les critères d'acceptation du portail :
--   AC01 activation selon la formule       AC20 création d'une conversation
--   AC02 isolation entre organisations     AC21 envoi depuis REZO360 (partie base)
--   AC03 isolation entre clients           AC23 réponse depuis le portail
--   AC04 aucune donnée sans session        AC24 conversation étrangère
--   AC05 révocation immédiate              AC25 messages non lus
--   AC35 traçabilité
--
-- Même dispositif que les suites précédentes : on endosse l'identité au niveau
-- de la session (`set local role` + `request.jwt.claims`), on constate ce que
-- la base accorde ET ce qu'elle refuse, et tout est annulé à la fin.
--
-- Le contact du portail s'identifie par l'ADRESSE de sa session : le helper
-- `pg_temp.login` pose `email = <clé>@test.local`, c'est donc cette adresse que
-- portent les contacts créés ici.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v) values
  ('a_owner',    '00000000-0000-4000-8000-0000000c0a01'),
  ('a_tech',     '00000000-0000-4000-8000-0000000c0a02'),
  ('a_employee', '00000000-0000-4000-8000-0000000c0a03'),
  ('b_owner',    '00000000-0000-4000-8000-0000000c0b01'),
  ('s_owner',    '00000000-0000-4000-8000-0000000c0501'),
  ('ca1',        '00000000-0000-4000-8000-0000000c0c01'),
  ('ca2',        '00000000-0000-4000-8000-0000000c0c02'),
  ('cb1',        '00000000-0000-4000-8000-0000000c0c03'),
  ('inconnu',    '00000000-0000-4000-8000-0000000c0c09');
grant select on t_ids to authenticated, service_role;

create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

create function pg_temp.login(p_key text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(p_key), 'email', p_key || '@test.local', 'role', 'authenticated')::text,
    true);
end;
$$;

-- Reproduit ce que PostgREST installe pour la clé de service : c'est ce rôle
-- que portent l'envoi et le webhook, et que les gardes croient sur parole.
create function pg_temp.as_service() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
end;
$$;

create function pg_temp.logout() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create function pg_temp.ok(p_condition boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'ECHEC : % (condition %)', p_label, coalesce(p_condition::text, 'NULL')
      using errcode = 'assert_failure';
  end if;
  raise notice '  OK  %', p_label;
end;
$$;

create function pg_temp.refuses(p_sql text, p_label text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ECHEC : % (l''instruction a ete ACCEPTEE)', p_label using errcode = 'assert_failure';
exception
  when assert_failure then raise;
  when others then raise notice '  OK  % (refuse : %)', p_label, left(sqlerrm, 70);
end;
$$;

-- -----------------------------------------------------------------------------
-- Comptes : membres ET contacts sont des utilisateurs Auth
-- -----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated',
  k || '@test.local', '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte',
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  json_build_object('display_name', k)::jsonb, now(), now()
from pg_temp.t_ids;

-- -----------------------------------------------------------------------------
-- Trois organisations : A (pro), B (pro), S (starter)
-- -----------------------------------------------------------------------------
do $$ begin raise notice '=== PARTIE 1 — Formules et activation (AC01) ==='; end $$;

select pg_temp.login('a_owner'); set local role authenticated;
insert into public.organizations (slug, name, created_by) values ('portail-a', 'Portail A', pg_temp.uid('a_owner'));
reset role;
select pg_temp.login('b_owner'); set local role authenticated;
insert into public.organizations (slug, name, created_by) values ('portail-b', 'Portail B', pg_temp.uid('b_owner'));
reset role;
select pg_temp.login('s_owner'); set local role authenticated;
insert into public.organizations (slug, name, created_by) values ('portail-s', 'Portail S', pg_temp.uid('s_owner'));
reset role;

delete from public.subscriptions where organization_id in (select id from public.organizations where slug like 'portail-%');
insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select id, case slug when 'portail-s' then 'starter' else 'pro' end, 'active', now() + interval '30 days'
from public.organizations where slug like 'portail-%';

insert into public.organization_members (organization_id, user_id, role, status, joined_at)
select o.id, pg_temp.uid(m.k), m.r::public.org_role, 'active', now()
from public.organizations o, (values ('a_tech', 'technician'), ('a_employee', 'employee')) as m(k, r)
where o.slug = 'portail-a';

do $$
declare v_a uuid; v_s uuid;
begin
  select id into v_a from public.organizations where slug = 'portail-a';
  select id into v_s from public.organizations where slug = 'portail-s';
  perform pg_temp.ok(app.org_has_feature(v_a, 'client_portal'), 'AC01 — la formule Pro accorde client_portal');
  perform pg_temp.ok(not app.org_has_feature(v_s, 'client_portal'), 'AC01 — la formule Starter ne l''accorde pas');
end $$;

-- Starter : impossible d'activer le portail, même en propriétaire.
select pg_temp.login('s_owner'); set local role authenticated;
select pg_temp.refuses(
  format($q$ insert into public.client_portal_settings (organization_id, enabled)
             select id, true from public.organizations where slug = 'portail-s' $q$),
  'AC01 — une organisation Starter ne peut pas créer les réglages du portail');
reset role;

-- Pro : le propriétaire active, l'employé ne peut pas.
select pg_temp.login('a_employee'); set local role authenticated;
select pg_temp.refuses(
  format($q$ insert into public.client_portal_settings (organization_id, enabled)
             select id, true from public.organizations where slug = 'portail-a' $q$),
  'Un employé ne règle pas le portail (client_portal.manage requis)');
reset role;

select pg_temp.login('a_owner'); set local role authenticated;
insert into public.client_portal_settings (organization_id, enabled, display_name)
select id, true, 'Portail A Services' from public.organizations where slug = 'portail-a';
reset role;
select pg_temp.login('b_owner'); set local role authenticated;
insert into public.client_portal_settings (organization_id, enabled)
select id, true from public.organizations where slug = 'portail-b';
reset role;

do $$
begin
  perform pg_temp.ok(
    (select count(*) from public.client_portal_settings s join public.organizations o on o.id = s.organization_id
      where o.slug in ('portail-a', 'portail-b') and s.enabled) = 2,
    'AC01 — les organisations Pro ont activé leur portail');
  perform pg_temp.ok(
    exists (select 1 from public.audit_logs where action = 'portal.settings_created'),
    'AC35 — l''activation du portail est journalisée');
end $$;

-- -----------------------------------------------------------------------------
-- Clients et contacts
-- -----------------------------------------------------------------------------
do $$ begin raise notice '=== PARTIE 2 — Contacts et accès (AC04, AC05) ==='; end $$;

select pg_temp.login('a_owner'); set local role authenticated;
do $$
declare v_org uuid; v_c1 uuid; v_c2 uuid;
begin
  select id into v_org from public.organizations where slug = 'portail-a';
  insert into public.customers (organization_id, name, created_by) values (v_org, 'Client A1', pg_temp.uid('a_owner')) returning id into v_c1;
  insert into public.customers (organization_id, name, created_by) values (v_org, 'Client A2', pg_temp.uid('a_owner')) returning id into v_c2;
  insert into public.customer_contacts (customer_id, organization_id, first_name, last_name, email, is_primary)
  values (v_c1, v_org, 'Contact', 'A1', 'ca1@test.local', true),
         (v_c2, v_org, 'Contact', 'A2', 'ca2@test.local', true);
end $$;
reset role;

select pg_temp.login('b_owner'); set local role authenticated;
do $$
declare v_org uuid; v_c uuid;
begin
  select id into v_org from public.organizations where slug = 'portail-b';
  insert into public.customers (organization_id, name, created_by) values (v_org, 'Client B1', pg_temp.uid('b_owner')) returning id into v_c;
  insert into public.customer_contacts (customer_id, organization_id, first_name, last_name, email, is_primary)
  values (v_c, v_org, 'Contact', 'B1', 'cb1@test.local', true);
end $$;
reset role;

-- Identifiants capturés HORS RLS. Un `insert … select` dont le select est
-- vidé par la RLS insère zéro ligne sans erreur : pour un acteur à droits
-- réduits, la policy n'est éprouvée que si les valeurs sont littérales.
do $$ begin
  perform set_config('t.org_a',   (select id::text from public.organizations where slug = 'portail-a'), true);
  perform set_config('t.cust_a1', (select customer_id::text from public.customer_contacts where email = 'ca1@test.local'), true);
  perform set_config('t.cust_a2', (select customer_id::text from public.customer_contacts where email = 'ca2@test.local'), true);
  perform set_config('t.ct_a1',   (select id::text from public.customer_contacts where email = 'ca1@test.local'), true);
  perform set_config('t.ct_a2',   (select id::text from public.customer_contacts where email = 'ca2@test.local'), true);
end $$;

-- Privé par défaut : un contact avec une adresse valide, sans accès accordé,
-- n'incarne rien.
select pg_temp.login('ca1'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from app.my_portal_contact_ids()) = 0,
    'AC05 — sans accès accordé, l''adresse ne suffit pas');
end $$;
reset role;

-- Le technicien ne peut pas accorder l'accès. Deux barrières, éprouvées
-- séparément : la RLS filtre la ligne (l'UPDATE touche zéro ligne, sans
-- erreur — d'où l'assertion sur l'ISSUE), puis la garde par trigger, testée en
-- accordant temporairement `customer.update` au technicien pour que la RLS le
-- laisse passer. Le cache des permissions est resynchronisé par trigger.
select pg_temp.login('a_tech'); set local role authenticated;
update public.customer_contacts set portal_enabled = true where email = 'ca1@test.local';
reset role;
-- L'assertion se fait hors RLS : en technicien, la lecture elle-même serait
-- filtrée et rendrait NULL — ce que `ok()` refuse à juste titre.
do $$ begin
  perform pg_temp.ok(
    not (select portal_enabled from public.customer_contacts where email = 'ca1@test.local'),
    'Un technicien n''accorde pas l''accès (la RLS filtre la ligne)');
end $$;

-- La garde, seule : le propriétaire passe toute la RLS, on lui retire
-- temporairement `client_portal.manage` (annulé avec la transaction, le cache
-- des permissions étant resynchronisé par trigger).
delete from public.role_permissions where role = 'owner' and permission = 'client_portal.manage';
select pg_temp.login('a_owner'); set local role authenticated;
select pg_temp.refuses(
  $q$ update public.customer_contacts set portal_enabled = true where email = 'ca1@test.local' $q$,
  'Même si la RLS laisse passer, la garde exige client_portal.manage');
update public.customer_contacts set notes = 'Modifiable sans client_portal.manage' where email = 'ca1@test.local';
reset role;
do $$ begin
  perform pg_temp.ok(
    (select notes from public.customer_contacts where email = 'ca1@test.local') like 'Modifiable%',
    'La garde ne bloque que le drapeau d''accès, pas le reste du contact');
end $$;
insert into public.role_permissions (role, permission) values ('owner', 'client_portal.manage');

select pg_temp.login('a_owner'); set local role authenticated;
update public.customer_contacts set portal_enabled = true where email in ('ca1@test.local', 'ca2@test.local');
reset role;
select pg_temp.login('b_owner'); set local role authenticated;
update public.customer_contacts set portal_enabled = true where email = 'cb1@test.local';
reset role;

do $$ begin
  perform pg_temp.ok((select count(*) from public.audit_logs where action = 'portal.access_granted') = 3,
    'AC35 — chaque accès accordé est journalisé');
end $$;

-- Sans session, rien.
select pg_temp.logout(); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from app.my_portal_contact_ids()) = 0, 'AC04 — sans session, aucun contact');
  perform pg_temp.ok((select count(*) from public.client_conversations) = 0, 'AC04 — sans session, aucune conversation');
end $$;
reset role;

-- Une adresse inconnue des contacts, même authentifiée, n'incarne rien.
select pg_temp.login('inconnu'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from app.my_portal_contact_ids()) = 0, 'AC04 — une session sans contact correspondant n''a rien');
end $$;
reset role;

select pg_temp.login('ca1'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from app.my_portal_contact_ids()) = 1, 'Le contact A1 est reconnu par son adresse vérifiée');
  perform pg_temp.ok(app.is_portal_contact(), 'is_portal_contact() est vrai pour lui');
end $$;
reset role;

select pg_temp.login('a_owner'); set local role authenticated;
do $$ begin
  perform pg_temp.ok(not app.is_portal_contact(), 'Un membre n''est pas un contact portail');
end $$;
reset role;

-- -----------------------------------------------------------------------------
-- Conversations et messages
-- -----------------------------------------------------------------------------
do $$ begin raise notice '=== PARTIE 3 — Messagerie (AC20, AC21, AC23, AC25) ==='; end $$;

-- L'employé n'écrit pas aux clients.
select pg_temp.login('a_employee'); set local role authenticated;
select pg_temp.refuses(
  $q$ insert into public.client_conversations (organization_id, customer_id, contact_id, subject, initiated_by)
      values (current_setting('t.org_a')::uuid, current_setting('t.cust_a1')::uuid, current_setting('t.ct_a1')::uuid, 'Intrusion', 'organization') $q$,
  'Un employé ne démarre pas de conversation (client_message.send requis)');
reset role;

-- Le propriétaire de A ouvre une conversation avec le contact A1.
select pg_temp.login('a_owner'); set local role authenticated;
insert into public.client_conversations (organization_id, customer_id, contact_id, subject, initiated_by)
select c.organization_id, c.customer_id, c.id, 'Votre intervention du 15', 'organization'
from public.customer_contacts c where c.email = 'ca1@test.local';

do $$
declare v_conv record;
begin
  select * into v_conv from public.client_conversations where subject = 'Votre intervention du 15';
  perform pg_temp.ok(v_conv.organization_id = (select id from public.organizations where slug = 'portail-a'),
    'AC20 — la conversation porte la bonne organisation');
  perform pg_temp.ok(v_conv.customer_id = (select customer_id from public.customer_contacts where email = 'ca1@test.local'),
    'AC20 — la conversation porte le bon client');
  perform pg_temp.ok(v_conv.created_by = pg_temp.uid('a_owner'), 'AC20 — created_by est posé par le trigger, pas par le navigateur');
end $$;

-- Un membre ne peut pas relier un contact au mauvais client.
select pg_temp.refuses(
  $q$ insert into public.client_conversations (organization_id, customer_id, contact_id, subject, initiated_by)
      select c.organization_id,
             (select id from public.customers where name = 'Client A2'),
             c.id, 'Melange', 'organization'
      from public.customer_contacts c where c.email = 'ca1@test.local' $q$,
  'Une conversation ne relie pas un contact au client d''un autre');

-- Envoi depuis REZO360 : direction et statut imposés, champs fournisseur vidés.
insert into public.client_messages (conversation_id, direction, body_text, status, resend_email_id)
select id, 'inbound', 'Bonjour, voici les détails de votre intervention.', 'delivered', 'forge'
from public.client_conversations where subject = 'Votre intervention du 15';

do $$
declare v_m record;
begin
  -- Par contenu, pas par date : dans une transaction, now() est constant.
  select * into v_m from public.client_messages where body_text like 'Bonjour, voici%';
  perform pg_temp.ok(v_m.direction = 'outbound', 'AC21 — la direction vient de qui écrit, pas du champ envoyé');
  perform pg_temp.ok(v_m.status = 'queued', 'AC21 — le statut initial est queued, pas celui déclaré');
  perform pg_temp.ok(v_m.resend_email_id is null, 'AC21 — l''identifiant fournisseur ne se déclare pas depuis le navigateur');
  perform pg_temp.ok(v_m.author_user_id = pg_temp.uid('a_owner'), 'AC21 — l''auteur est la session');
  perform pg_temp.ok(v_m.organization_id = (select organization_id from public.client_conversations where id = v_m.conversation_id),
    'AC21 — l''organisation vient de la conversation');
  perform pg_temp.ok((select last_message_at from public.client_conversations where id = v_m.conversation_id) is not null,
    'La conversation remonte à l''envoi');
end $$;
reset role;

-- Le service (webhook, envoi) marque le message comme envoyé.
select pg_temp.as_service();
update public.client_messages set status = 'sent', resend_email_id = 're_test_1', sent_at = now()
where body_text like 'Bonjour, voici%';
select pg_temp.logout();
do $$ begin
  perform pg_temp.ok(
    (select status from public.client_messages where body_text like 'Bonjour, voici%') = 'sent',
    'AC21 — le rôle de service peut poser le statut et l''identifiant fournisseur');
end $$;

-- Le contact A1 lit et répond.
select pg_temp.login('ca1'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from public.client_conversations) = 1, 'Le contact A1 voit sa conversation');
  perform pg_temp.ok((select count(*) from public.client_messages) = 1, 'Le contact A1 voit le message reçu');
  perform pg_temp.ok((select read_by_client_at from public.client_messages limit 1) is null, 'AC25 — le message est non lu côté client');
end $$;

update public.client_messages set read_by_client_at = now();
select pg_temp.refuses(
  $q$ update public.client_messages set read_by_staff_at = now() $q$,
  'AC25 — le contact ne marque pas la lecture de l''entreprise');
select pg_temp.refuses(
  $q$ update public.client_messages set body_text = 'modifie' $q$,
  'Le contact ne modifie pas le contenu d''un message');

insert into public.client_messages (conversation_id, direction, body_text, status)
select id, 'outbound', 'Merci, à quelle heure passez-vous ?', 'sent' from public.client_conversations;

do $$
declare v_m record;
begin
  select * into v_m from public.client_messages where body_text like 'Merci, à quelle heure%';
  perform pg_temp.ok(v_m.direction = 'inbound', 'AC23 — la réponse du contact est inbound quoi qu''il déclare');
  perform pg_temp.ok(v_m.status = 'received', 'AC23 — statut received');
  perform pg_temp.ok(v_m.read_by_staff_at is null, 'AC25 — non lu côté entreprise');
end $$;
reset role;

select pg_temp.login('a_owner'); set local role authenticated;
do $$ begin
  perform pg_temp.ok(
    (select count(*) from public.client_messages where direction = 'inbound' and read_by_staff_at is null) = 1,
    'AC25 — l''entreprise compte un message non lu');
end $$;
update public.client_messages set read_by_staff_at = now() where direction = 'inbound';
select pg_temp.refuses(
  $q$ update public.client_messages set read_by_client_at = null $q$,
  'AC25 — l''entreprise ne touche pas à la lecture du contact');
reset role;
-- Le journal se lit hors RLS : sa policy dépend de la formule, pas du sujet testé.
do $$ begin
  perform pg_temp.ok((select count(*) from public.audit_logs where action = 'portal.message_sent') = 1, 'AC35 — envoi journalisé');
  perform pg_temp.ok((select count(*) from public.audit_logs where action = 'portal.message_received') = 1, 'AC35 — réception journalisée');
  perform pg_temp.ok(
    not exists (select 1 from public.audit_logs where action like 'portal.message%' and metadata::text like '%Bonjour%'),
    'AC35 — le journal ne contient pas le contenu des messages');
end $$;

-- Le contact démarre une conversation si l'organisation l'autorise.
select pg_temp.login('ca1'); set local role authenticated;
insert into public.client_conversations (organization_id, customer_id, contact_id, subject, initiated_by)
      values (current_setting('t.org_a')::uuid, current_setting('t.cust_a1')::uuid, current_setting('t.ct_a1')::uuid, 'Question sur ma facture', 'client');
select pg_temp.refuses(
  $q$ insert into public.client_conversations (organization_id, customer_id, contact_id, subject, initiated_by)
      values (current_setting('t.org_a')::uuid, current_setting('t.cust_a1')::uuid, current_setting('t.ct_a1')::uuid, 'Usurpation', 'organization') $q$,
  'Un contact ne crée pas de conversation « initiée par l''organisation »');
reset role;
do $$ begin
  perform pg_temp.ok(
    exists (select 1 from public.client_conversations where subject = 'Question sur ma facture' and initiated_by = 'client'),
    'Le contact a pu démarrer une conversation (allow_client_initiated)');
end $$;

-- Le refus des nouvelles conversations client s'applique immédiatement.
update public.client_portal_settings set allow_client_initiated = false
where organization_id = (select id from public.organizations where slug = 'portail-a');
select pg_temp.login('ca1'); set local role authenticated;
select pg_temp.refuses(
  $q$ insert into public.client_conversations (organization_id, customer_id, contact_id, subject, initiated_by)
      values (current_setting('t.org_a')::uuid, current_setting('t.cust_a1')::uuid, current_setting('t.ct_a1')::uuid, 'Encore une', 'client') $q$,
  'allow_client_initiated = false interdit les nouvelles conversations du contact');
reset role;
update public.client_portal_settings set allow_client_initiated = true
where organization_id = (select id from public.organizations where slug = 'portail-a');

-- -----------------------------------------------------------------------------
-- Cloisonnement
-- -----------------------------------------------------------------------------
do $$ begin raise notice '=== PARTIE 4 — Isolation (AC02, AC03, AC24) ==='; end $$;

-- Entre clients de la même organisation : A2 ne voit rien de A1.
select pg_temp.login('ca2'); set local role authenticated;
do $$
declare v_conv uuid;
begin
  select id into v_conv from public.client_conversations where subject = 'Votre intervention du 15';
  perform pg_temp.ok(v_conv is null, 'AC03/AC24 — le contact A2 ne voit pas la conversation de A1');
  perform pg_temp.ok((select count(*) from public.client_messages) = 0, 'AC03 — ni ses messages');
end $$;
reset role;

-- Même en connaissant l'UUID : lecture vide, écriture refusée.
do $$
declare v_conv uuid; v_msg uuid;
begin
  select id into v_conv from public.client_conversations where subject = 'Votre intervention du 15';
  select id into v_msg from public.client_messages where conversation_id = v_conv limit 1;
  perform set_config('t.conv', v_conv::text, true);
  perform set_config('t.msg', v_msg::text, true);
end $$;
select pg_temp.login('ca2'); set local role authenticated;
do $$ begin
  perform pg_temp.ok(
    (select count(*) from public.client_conversations where id = current_setting('t.conv')::uuid) = 0,
    'AC24 — l''UUID connu de la conversation ne donne rien à A2');
  perform pg_temp.ok(
    (select count(*) from public.client_messages where id = current_setting('t.msg')::uuid) = 0,
    'AC24 — l''UUID connu du message ne donne rien à A2');
end $$;
select pg_temp.refuses(
  format($q$ insert into public.client_messages (conversation_id, direction, body_text) values (%L, 'inbound', 'Intrusion') $q$,
         current_setting('t.conv')),
  'AC24 — A2 n''écrit pas dans la conversation de A1');
-- Un UPDATE filtré par la RLS touche zéro ligne sans erreur : on constate
-- l'issue plutôt qu'une exception.
update public.client_messages set read_by_client_at = '2000-01-01' where id = current_setting('t.msg')::uuid;
reset role;
do $$ begin
  perform pg_temp.ok(
    (select read_by_client_at from public.client_messages where id = current_setting('t.msg')::uuid)
      is distinct from '2000-01-01'::timestamptz,
    'AC24 — A2 ne modifie pas un message de A1');
end $$;

-- Entre organisations : B ne voit rien de A, en membre comme en contact.
select pg_temp.login('b_owner'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from public.client_conversations) = 0, 'AC02 — le propriétaire de B ne voit aucune conversation de A');
  perform pg_temp.ok((select count(*) from public.client_messages) = 0, 'AC02 — ni aucun message');
  perform pg_temp.ok(
    (select count(*) from public.client_conversations where id = current_setting('t.conv')::uuid) = 0,
    'AC02 — même avec l''UUID');
end $$;
select pg_temp.refuses(
  format($q$ insert into public.client_messages (conversation_id, direction, body_text) values (%L, 'outbound', 'Intrusion B') $q$,
         current_setting('t.conv')),
  'AC02 — B n''écrit pas dans une conversation de A');
reset role;

select pg_temp.login('cb1'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from public.client_conversations) = 0, 'AC02 — le contact de B ne voit rien de A');
end $$;
reset role;

-- -----------------------------------------------------------------------------
-- Révocation
-- -----------------------------------------------------------------------------
do $$ begin raise notice '=== PARTIE 5 — Révocation (AC05) ==='; end $$;

select pg_temp.login('a_owner'); set local role authenticated;
update public.customer_contacts set portal_enabled = false where email = 'ca1@test.local';
reset role;

select pg_temp.login('ca1'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from app.my_portal_contact_ids()) = 0, 'AC05 — accès révoqué : plus aucun contact incarné');
  perform pg_temp.ok((select count(*) from public.client_conversations) = 0, 'AC05 — plus aucune conversation visible');
  perform pg_temp.ok((select count(*) from public.client_messages) = 0, 'AC05 — plus aucun message visible');
end $$;
select pg_temp.refuses(
  format($q$ insert into public.client_messages (conversation_id, direction, body_text) values (%L, 'inbound', 'Apres revocation') $q$,
         current_setting('t.conv')),
  'AC05 — plus aucune écriture possible');
reset role;

-- Désactiver le portail de l'organisation coupe tous ses contacts d'un coup.
select pg_temp.login('a_owner'); set local role authenticated;
update public.customer_contacts set portal_enabled = true where email = 'ca1@test.local';
update public.client_portal_settings set enabled = false
where organization_id = (select id from public.organizations where slug = 'portail-a');
reset role;
select pg_temp.login('ca1'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from app.my_portal_contact_ids()) = 0, 'AC05 — portail désactivé : le contact n''a plus rien');
end $$;
reset role;

do $$ begin
  perform pg_temp.ok((select count(*) from public.audit_logs where action = 'portal.access_revoked') = 1, 'AC35 — révocation journalisée');
end $$;

do $$ begin raise notice '=== TOUS LES TESTS PASSENT ==='; end $$;
select 'TOUS LES TESTS PASSENT' as resultat;

rollback;

-- =============================================================================
-- SUITE DE TESTS — portail client : ce que le client voit, et ne voit jamais
-- =============================================================================
-- Couvre, côté base, les critères d'acceptation de lecture :
--   AC06/AC07 interventions propres et étrangères    AC14 photo privée par défaut
--   AC08/AC09 compte rendu validé et brouillon        AC15 partage d'une photo
--   AC10/AC11 devis brouillon et envoyé               AC16 partage en lot
--   AC12/AC13 facture brouillon et émise              AC17 révocation d'un partage
--   AC18/AC19 document privé, téléchargement autorisé
--
-- La fixture est construite en `postgres` sans session : les gardes d'auteur
-- (`enforce_report_authorship`, `verify_*_object`) s'effacent quand
-- `auth.uid()` est nul, ce qui permet de poser directement des états
-- « validé » ou « émis » sans rejouer tout le parcours. Les lectures, elles,
-- se font sous l'identité du contact — c'est ce qui est testé.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v) values
  ('a_owner', '00000000-0000-4000-8000-0000000d0a01'),
  ('a_tech',  '00000000-0000-4000-8000-0000000d0a02'),
  ('ca1',     '00000000-0000-4000-8000-0000000d0c01'),
  ('ca2',     '00000000-0000-4000-8000-0000000d0c02');
grant select on t_ids to authenticated, service_role;

create temporary table t_ref (k text primary key, v text);
grant select on t_ref to authenticated, service_role;
create function pg_temp.ref(p_key text) returns text
language sql stable as $$ select v from pg_temp.t_ref where k = p_key $$;

create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

create function pg_temp.login(p_key text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(p_key), 'email', p_key || '@test.local', 'role', 'authenticated')::text, true);
end;
$$;

create function pg_temp.logout() returns void
language plpgsql as $$ begin perform set_config('request.jwt.claims', '', true); end; $$;

create function pg_temp.ok(p_condition boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'ECHEC : % (condition %)', p_label, coalesce(p_condition::text, 'NULL') using errcode = 'assert_failure';
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

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', k || '@test.local',
       '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte', now(),
       '{"provider":"email","providers":["email"]}'::jsonb, json_build_object('display_name', k)::jsonb, now(), now()
from pg_temp.t_ids;

-- -----------------------------------------------------------------------------
-- Fixture, sans session
-- -----------------------------------------------------------------------------
do $$ begin raise notice '=== FIXTURE ==='; end $$;

select pg_temp.login('a_owner'); set local role authenticated;
insert into public.organizations (slug, name, created_by) values ('lecture-a', 'Lecture A', pg_temp.uid('a_owner'));
reset role;
select pg_temp.logout();

update public.organizations set legal_name = 'Lecture A SARL', legal_form = 'SARL', share_capital_cents = 100000,
  registration_number = '12345678900012', vat_regime = 'reel_normal', vat_number = 'FR12345678901',
  address_line1 = '1 rue du Test', postal_code = '97200', city = 'Fort-de-France', country = 'FR'
where slug = 'lecture-a';

delete from public.subscriptions where organization_id = (select id from public.organizations where slug = 'lecture-a');
insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select id, 'business', 'active', now() + interval '30 days' from public.organizations where slug = 'lecture-a';

insert into public.organization_members (organization_id, user_id, role, status, joined_at)
select id, pg_temp.uid('a_tech'), 'technician', 'active', now() from public.organizations where slug = 'lecture-a';

insert into public.client_portal_settings (organization_id, enabled, visible_document_categories)
select id, true, array['cgv'] from public.organizations where slug = 'lecture-a';

do $$
declare
  v_org uuid; v_c1 uuid; v_c2 uuid; v_tech uuid;
  v_m1 uuid; v_m2 uuid; v_m3 uuid; v_m4 uuid; v_i1 uuid; v_i2 uuid;
  v_q1 uuid; v_q2 uuid; v_q3 uuid; v_f1 uuid; v_f2 uuid;
  v_p1 text; v_p2 text; v_d1 text; v_d2 text; v_d3 text;
begin
  select id into v_org from public.organizations where slug = 'lecture-a';
  select id into v_tech from public.organization_members where organization_id = v_org and user_id = pg_temp.uid('a_tech');

  insert into public.customers (organization_id, name, created_by) values (v_org, 'Client A1', pg_temp.uid('a_owner')) returning id into v_c1;
  insert into public.customers (organization_id, name, created_by) values (v_org, 'Client A2', pg_temp.uid('a_owner')) returning id into v_c2;
  insert into public.customer_contacts (customer_id, organization_id, first_name, last_name, email, is_primary, portal_enabled)
  values (v_c1, v_org, 'Contact', 'A1', 'ca1@test.local', true, true),
         (v_c2, v_org, 'Contact', 'A2', 'ca2@test.local', true, true);

  -- Missions : M1 visible (A1), M2 brouillon (A1), M3 visible (A2), M4 rejetée (A1)
  insert into public.missions (organization_id, customer_id, title, status, city) values (v_org, v_c1, 'Dépannage chaudière', 'assigned', 'Fort-de-France') returning id into v_m1;
  insert into public.missions (organization_id, customer_id, title, status) values (v_org, v_c1, 'Idée non décidée', 'draft') returning id into v_m2;
  insert into public.missions (organization_id, customer_id, title, status) values (v_org, v_c2, 'Mission du client A2', 'assigned') returning id into v_m3;
  insert into public.missions (organization_id, customer_id, title, status) values (v_org, v_c1, 'Compte rendu refuse', 'rejected') returning id into v_m4;

  insert into public.interventions (mission_id, organization_id, technician_id, status) values (v_m1, v_org, v_tech, 'completed') returning id into v_i1;
  insert into public.interventions (mission_id, organization_id, technician_id, status) values (v_m3, v_org, v_tech, 'completed') returning id into v_i2;

  -- R1 validé sur M1 ; R2 brouillon sur M3 (pour AC09, même en connaissant l'UUID)
  insert into public.intervention_reports (intervention_id, organization_id, technician_id, status, work_description, observations, submitted_at)
  values (v_i1, v_org, v_tech, 'approved', 'Remplacement de la vanne', 'NOTE INTERNE : client difficile', now());
  insert into public.intervention_reports (intervention_id, organization_id, technician_id, status, work_description)
  values (v_i2, v_org, v_tech, 'draft', 'Brouillon en cours');

  -- Photos : les objets Storage d'abord (le trigger de vérification l'exige).
  v_p1 := v_org || '/' || v_m1 || '/' || v_i1 || '/photo-avant.jpg';
  v_p2 := v_org || '/' || v_m1 || '/' || v_i1 || '/photo-apres.jpg';
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('intervention-attachments', v_p1, pg_temp.uid('a_tech')::text, '{"mimetype":"image/jpeg","size":"1000"}'::jsonb),
         ('intervention-attachments', v_p2, pg_temp.uid('a_tech')::text, '{"mimetype":"image/jpeg","size":"1200"}'::jsonb);
  insert into public.intervention_attachments (intervention_id, organization_id, kind, storage_path, file_name, mime_type, size_bytes)
  values (v_i1, v_org, 'before', v_p1, 'photo-avant.jpg', 'image/jpeg', 1000),
         (v_i1, v_org, 'after',  v_p2, 'photo-apres.jpg', 'image/jpeg', 1200);

  -- Devis : Q1 envoyé (A1), Q2 brouillon (A1), Q3 envoyé (A2)
  insert into public.quotes (organization_id, customer_id, title, status) values (v_org, v_c1, 'Devis chaudière', 'sent') returning id into v_q1;
  insert into public.quotes (organization_id, customer_id, title, status) values (v_org, v_c1, 'Devis en préparation', 'draft') returning id into v_q2;
  insert into public.quotes (organization_id, customer_id, title, status) values (v_org, v_c2, 'Devis du client A2', 'sent') returning id into v_q3;

  -- Factures : F1 émise (A1), F2 brouillon (A1)
  insert into public.invoices (organization_id, customer_id, title) values (v_org, v_c1, 'Facture chaudière') returning id into v_f1;
  update public.invoices set customer_name = 'Client A1', customer_type = 'individual',
    customer_address_line1 = '2 rue du Test', customer_postal_code = '97200', customer_city = 'Fort-de-France', customer_country = 'FR',
    service_date = current_date, operation_type = 'services', early_payment_terms = 'Escompte : néant.',
    late_payment_terms = 'Trois fois le taux légal.', vat_on_debits = false, due_date = current_date + 30,
    payment_terms = 'Paiement sous 30 jours.' where id = v_f1;
  insert into public.invoice_items (invoice_id, organization_id, description, quantity, unit_price_cents, vat_rate)
  values (v_f1, v_org, 'Prestation', 1, 10000, 20);
  update public.invoices set status = 'issued' where id = v_f1;
  insert into public.invoices (organization_id, customer_id, title) values (v_org, v_c1, 'Brouillon de facture') returning id into v_f2;

  -- Documents : D1 partagé, D2 privé, D3 de catégorie ouverte (cgv)
  v_d1 := v_org || '/d1-guide.pdf'; v_d2 := v_org || '/d2-interne.pdf'; v_d3 := v_org || '/d3-cgv.pdf';
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('organization-documents', v_d1, pg_temp.uid('a_owner')::text, '{"mimetype":"application/pdf","size":"500"}'::jsonb),
         ('organization-documents', v_d2, pg_temp.uid('a_owner')::text, '{"mimetype":"application/pdf","size":"500"}'::jsonb),
         ('organization-documents', v_d3, pg_temp.uid('a_owner')::text, '{"mimetype":"application/pdf","size":"500"}'::jsonb);
  insert into public.organization_documents (organization_id, name, original_filename, storage_path, mime_type, file_size, category, shared_with_client)
  values (v_org, 'Guide utilisateur', 'd1-guide.pdf', v_d1, 'application/pdf', 500, 'guide', true),
         (v_org, 'Procédure interne', 'd2-interne.pdf', v_d2, 'application/pdf', 500, 'interne', false),
         (v_org, 'Conditions générales', 'd3-cgv.pdf', v_d3, 'application/pdf', 500, 'cgv', false);

  insert into pg_temp.t_ref values ('org', v_org::text), ('m1', v_m1::text), ('m2', v_m2::text), ('m3', v_m3::text), ('m4', v_m4::text),
    ('q2', v_q2::text), ('q3', v_q3::text), ('f2', v_f2::text), ('p1', v_p1), ('p2', v_p2), ('d1', v_d1), ('d2', v_d2), ('d3', v_d3);
end $$;

-- Rien n'a été partagé par la fixture (les photos naissent privées).
do $$ begin
  perform pg_temp.ok(not exists (select 1 from public.intervention_attachments where shared_with_client), 'AC14 — les photos naissent privées');
end $$;

-- -----------------------------------------------------------------------------
-- Sans session : rien
-- -----------------------------------------------------------------------------
do $$ begin raise notice '=== PARTIE 1 — Sans session (AC04) ==='; end $$;
set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from public.portal_list_missions()) = 0, 'AC04 — aucune mission sans session');
  perform pg_temp.ok(public.portal_mission_detail(pg_temp.ref('m1')::uuid) is null, 'AC04 — aucun détail sans session');
  perform pg_temp.ok((select count(*) from public.portal_list_invoices()) = 0, 'AC04 — aucune facture sans session');
  perform pg_temp.ok(not public.portal_can_read_file('intervention-attachments', pg_temp.ref('p1')), 'AC04 — aucun fichier sans session');
end $$;
reset role;

-- -----------------------------------------------------------------------------
-- Le contact A1
-- -----------------------------------------------------------------------------
do $$ begin raise notice '=== PARTIE 2 — Le contact A1 (AC06, AC08, AC11, AC13, AC18) ==='; end $$;
select pg_temp.login('ca1'); set local role authenticated;
do $$
declare v_detail jsonb; v_ctx record;
begin
  select * into v_ctx from public.portal_my_context();
  perform pg_temp.ok(v_ctx.organization_name = 'Lecture A' and v_ctx.customer_name = 'Client A1', 'Le contexte nomme l''entreprise et le client');
  perform pg_temp.ok((v_ctx.features ->> 'invoicing')::boolean, 'Le contexte expose les modules réellement actifs');

  perform pg_temp.ok((select count(*) from public.portal_list_missions()) = 1, 'AC06 — une seule mission visible : la sienne, hors brouillon et rejet');
  perform pg_temp.ok((select title from public.portal_list_missions()) = 'Dépannage chaudière', 'AC06 — c''est M1');
  perform pg_temp.ok((select has_approved_report from public.portal_list_missions()), 'AC08 — la mission signale son compte rendu validé');

  v_detail := public.portal_mission_detail(pg_temp.ref('m1')::uuid);
  perform pg_temp.ok(v_detail ->> 'title' = 'Dépannage chaudière', 'AC06 — le détail de M1 est lisible');
  perform pg_temp.ok(v_detail -> 'report' ->> 'work_description' = 'Remplacement de la vanne', 'AC08 — le compte rendu validé est lisible');
  perform pg_temp.ok(v_detail -> 'report' ? 'observations' = false, 'AC08 — les observations internes ne sont pas exposées');
  perform pg_temp.ok(v_detail ? 'customer_phone' = false and v_detail ? 'notes' = false, 'AC06 — ni notes ni téléphone : colonnes choisies, pas select *');
  perform pg_temp.ok(jsonb_array_length(v_detail -> 'attachments') = 0, 'AC14 — aucune photo tant que rien n''est partagé');

  perform pg_temp.ok(public.portal_mission_detail(pg_temp.ref('m2')::uuid) is null, 'AC06 — une mission brouillon n''existe pas pour lui, même avec l''UUID');
  perform pg_temp.ok(public.portal_mission_detail(pg_temp.ref('m4')::uuid) is null, 'AC09 — une mission au compte rendu refusé non plus');
  perform pg_temp.ok(public.portal_mission_detail(pg_temp.ref('m3')::uuid) is null, 'AC07 — la mission du client A2 est invisible, même avec l''UUID');

  perform pg_temp.ok((select count(*) from public.portal_list_quotes()) = 1, 'AC10/AC11 — un seul devis : l''envoyé, pas le brouillon');
  perform pg_temp.ok((select title from public.portal_list_quotes()) = 'Devis chaudière', 'AC11 — c''est le devis envoyé');
  perform pg_temp.ok((select total_cents from public.portal_list_quotes()) is not null, 'AC11 — avec ses totaux');
  perform pg_temp.ok(not exists (select 1 from public.portal_list_quotes() where id = pg_temp.ref('q3')::uuid), 'AC03 — pas le devis du client A2');

  perform pg_temp.ok((select count(*) from public.portal_list_invoices()) = 1, 'AC12/AC13 — une seule facture : l''émise, pas le brouillon');
  perform pg_temp.ok((select status from public.portal_list_invoices()) = 'issued', 'AC13 — c''est la facture émise');
  perform pg_temp.ok(not exists (select 1 from public.portal_list_invoices() where id = pg_temp.ref('f2')::uuid), 'AC12 — le brouillon n''apparaît pas, même avec l''UUID');

  perform pg_temp.ok((select count(*) from public.portal_list_documents()) = 2, 'AC18 — deux documents : le partagé et celui de la catégorie ouverte');
  perform pg_temp.ok(not exists (select 1 from public.portal_list_documents() where storage_path = pg_temp.ref('d2')), 'AC18 — le document interne reste privé');

  perform pg_temp.ok(public.portal_can_read_file('organization-documents', pg_temp.ref('d1')), 'AC19 — téléchargement autorisé pour le document partagé');
  perform pg_temp.ok(public.portal_can_read_file('organization-documents', pg_temp.ref('d3')), 'AC19 — et pour la catégorie ouverte');
  perform pg_temp.ok(not public.portal_can_read_file('organization-documents', pg_temp.ref('d2')), 'AC19 — refusé pour le document interne');
  perform pg_temp.ok(not public.portal_can_read_file('intervention-attachments', pg_temp.ref('p1')), 'AC14 — refusé pour une photo non partagée');
  perform pg_temp.ok(not public.portal_can_read_file('bucket-inconnu', pg_temp.ref('d1')), 'AC19 — un bucket sans règle vaut refus');
end $$;
reset role;

-- -----------------------------------------------------------------------------
-- Partage des photos
-- -----------------------------------------------------------------------------
do $$ begin raise notice '=== PARTIE 3 — Partage (AC15, AC16, AC17, AC35) ==='; end $$;

-- Le technicien partage UNE photo.
select pg_temp.login('a_tech'); set local role authenticated;
update public.intervention_attachments set shared_with_client = true where storage_path = pg_temp.ref('p1');
select pg_temp.refuses(
  format($q$ update public.intervention_attachments set storage_path = %L where storage_path = %L $q$, 'autre/chemin', pg_temp.ref('p1')),
  'Le partage n''ouvre pas les autres colonnes de la pièce jointe');
reset role;

select pg_temp.login('ca1'); set local role authenticated;
do $$
declare v_detail jsonb;
begin
  v_detail := public.portal_mission_detail(pg_temp.ref('m1')::uuid);
  perform pg_temp.ok(jsonb_array_length(v_detail -> 'attachments') = 1, 'AC15 — la photo partagée apparaît');
  perform pg_temp.ok(v_detail -> 'attachments' -> 0 ->> 'file_name' = 'photo-avant.jpg', 'AC15 — c''est bien celle-là');
  perform pg_temp.ok(public.portal_can_read_file('intervention-attachments', pg_temp.ref('p1')), 'AC15 — et elle se télécharge');
  perform pg_temp.ok(not public.portal_can_read_file('intervention-attachments', pg_temp.ref('p2')), 'AC14 — l''autre reste privée');
end $$;
reset role;

-- Partage en lot : plusieurs photos en une instruction.
select pg_temp.login('a_tech'); set local role authenticated;
update public.intervention_attachments set shared_with_client = true
where storage_path in (pg_temp.ref('p1'), pg_temp.ref('p2'));
reset role;
select pg_temp.login('ca1'); set local role authenticated;
do $$ begin
  perform pg_temp.ok(jsonb_array_length(public.portal_mission_detail(pg_temp.ref('m1')::uuid) -> 'attachments') = 2, 'AC16 — les deux photos sont visibles après le partage en lot');
  perform pg_temp.ok((select shared_attachments_count from public.portal_list_missions()) = 2, 'AC16 — la liste compte deux photos partagées');
end $$;
reset role;

-- Le client A2 ne voit rien de tout cela.
select pg_temp.login('ca2'); set local role authenticated;
do $$ begin
  perform pg_temp.ok(not public.portal_can_read_file('intervention-attachments', pg_temp.ref('p1')), 'AC07 — la photo partagée de A1 reste inaccessible à A2');
  perform pg_temp.ok((select count(*) from public.portal_list_missions()) = 1, 'AC07 — A2 ne voit que sa mission');
  -- `null` JSON, pas NULL SQL : jsonb_build_object garde la clé avec une valeur nulle.
  perform pg_temp.ok(jsonb_typeof(public.portal_mission_detail(pg_temp.ref('m3')::uuid) -> 'report') = 'null', 'AC09 — le compte rendu brouillon de sa propre mission n''est pas exposé');
end $$;
reset role;

-- Révocation d'un partage.
select pg_temp.login('a_tech'); set local role authenticated;
update public.intervention_attachments set shared_with_client = false where storage_path = pg_temp.ref('p1');
reset role;
select pg_temp.login('ca1'); set local role authenticated;
do $$ begin
  perform pg_temp.ok(not public.portal_can_read_file('intervention-attachments', pg_temp.ref('p1')), 'AC17 — le partage retiré coupe le téléchargement');
  perform pg_temp.ok(jsonb_array_length(public.portal_mission_detail(pg_temp.ref('m1')::uuid) -> 'attachments') = 1, 'AC17 — et la photo disparaît du détail');
end $$;
reset role;

-- Journal : partages et retraits, sans contenu.
do $$ begin
  perform pg_temp.ok((select count(*) from public.audit_logs where action = 'portal.attachment_shared') = 2, 'AC35 — deux partages journalisés (le lot ne recompte pas la photo déjà partagée)');
  perform pg_temp.ok((select count(*) from public.audit_logs where action = 'portal.attachment_unshared') = 1, 'AC35 — un retrait journalisé');
end $$;

-- L'employé (sans client_content.share) ne partage rien. Un UPDATE filtré par
-- la RLS touche zéro ligne : on constate l'issue.
insert into public.organization_members (organization_id, user_id, role, status, joined_at)
select id, pg_temp.uid('ca2'), 'employee', 'active', now() from public.organizations where slug = 'lecture-a';
select pg_temp.login('ca2'); set local role authenticated;
update public.intervention_attachments set shared_with_client = true where storage_path = pg_temp.ref('p1');
reset role;
do $$ begin
  perform pg_temp.ok(not (select shared_with_client from public.intervention_attachments where storage_path = pg_temp.ref('p1')),
    'Un employé ne partage pas (client_content.share requis)');
end $$;

-- Marquage du passage.
select pg_temp.login('ca1'); set local role authenticated;
select public.portal_touch_last_seen();
reset role;
do $$ begin
  perform pg_temp.ok((select portal_last_seen_at from public.customer_contacts where email = 'ca1@test.local') is not null, 'Le passage est daté');
  perform pg_temp.ok(exists (select 1 from public.audit_logs where action = 'portal.access'), 'AC35 — l''accès au portail est journalisé');
end $$;

do $$ begin raise notice '=== TOUS LES TESTS PASSENT ==='; end $$;
select 'TOUS LES TESTS PASSENT' as resultat;

rollback;

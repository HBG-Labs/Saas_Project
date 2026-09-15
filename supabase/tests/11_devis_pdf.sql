-- =============================================================================
-- SUITE DE TESTS — PDF du devis, consultable et téléchargeable depuis le portail
-- =============================================================================
-- Rejoue les garanties posées par `20260916110000_devis_pdf.sql` :
--
--   un document n'est conservable que pour un devis non brouillon de la même
--   organisation ; jamais modifiable ni supprimable (immuable comme les
--   factures) ; le chemin apparaît dans portal_list_quotes/portal_quote_detail
--   UNIQUEMENT une fois le document conservé ; portal_can_read_file l'autorise
--   alors, et seulement pour LE bon contact.
--
-- Le rendu du PDF lui-même (contenu, mise en page) est couvert par
-- `supabase/functions/_shared/quote-pdf-render.test.ts` et
-- `supabase/functions/generate-quote-pdf/handler.test.ts` (hors CI, pdfkit).
--
--   npm run test:sql
-- =============================================================================

begin;
set local search_path = pg_temp, public;

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v) values
  ('owner',  '00000000-0000-4000-8000-0000000f0001'),
  ('autre',  '00000000-0000-4000-8000-0000000f0002'),
  ('ca1',    '00000000-0000-4000-8000-0000000f0003'),
  ('ca2',    '00000000-0000-4000-8000-0000000f0004');
grant select on t_ids to authenticated;

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
-- Fixture : une entreprise Pro, deux clients, un devis envoyé, un en brouillon
-- -----------------------------------------------------------------------------
select pg_temp.login('owner'); set local role authenticated;
insert into public.organizations (slug, name, created_by) values ('devis-pdf-test', 'Devis PDF Test', pg_temp.uid('owner'));
reset role;

delete from public.subscriptions where organization_id = (select id from public.organizations where slug = 'devis-pdf-test');
insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select id, 'pro', 'active', now() + interval '30 days' from public.organizations where slug = 'devis-pdf-test';

create temporary table t_ctx (org_id uuid, c1 uuid, c2 uuid, q_sent uuid, q_draft uuid, pdf_path text);
grant select on t_ctx to authenticated;
insert into t_ctx (org_id) select id from public.organizations where slug = 'devis-pdf-test';

with c1 as (
  insert into public.customers (organization_id, name, created_by)
  select org_id, 'Client A', pg_temp.uid('owner') from t_ctx returning id
), c2 as (
  insert into public.customers (organization_id, name, created_by)
  select org_id, 'Client B', pg_temp.uid('owner') from t_ctx returning id
)
update t_ctx set c1 = (select id from c1), c2 = (select id from c2);

insert into public.client_portal_settings (organization_id, enabled)
select org_id, true from t_ctx;

insert into public.customer_contacts (customer_id, organization_id, first_name, last_name, email, is_primary, portal_enabled)
select c1, org_id, 'Contact', 'A', 'ca1@test.local', true, true from t_ctx
union all
select c2, org_id, 'Contact', 'B', 'ca2@test.local', true, true from t_ctx;

with qs as (
  insert into public.quotes (organization_id, reference, title, customer_id, status, created_by)
  select org_id, 'DEV-PDF-1', 'Devis envoyé', c1, 'sent', pg_temp.uid('owner') from t_ctx returning id
), qd as (
  insert into public.quotes (organization_id, reference, title, customer_id, status, created_by)
  select org_id, 'DEV-PDF-2', 'Devis brouillon', c1, 'draft', pg_temp.uid('owner') from t_ctx returning id
)
update t_ctx set q_sent = (select id from qs), q_draft = (select id from qd);

insert into public.quote_items (quote_id, organization_id, description, unit, quantity, unit_price_cents, position)
select q_sent, org_id, 'Prestation', 'Forfait', 1, 10000, 0 from t_ctx;

do $$ begin raise notice '=== PARTIE 1 — Contraintes sur quote_documents ==='; end $$;

do $$ begin
perform pg_temp.refuses(
  format($sql$ insert into public.quote_documents (quote_id, organization_id, generator_version, object_path, pdf_sha256, byte_size)
    select q_draft, org_id, 'test-1', org_id::text || '/' || q_draft::text || '/devis.pdf', repeat('a', 64), 100 from pg_temp.t_ctx $sql$),
  'un brouillon ne peut pas recevoir de document conservé');
end $$;

insert into public.quote_documents (quote_id, organization_id, generator_version, object_path, pdf_sha256, byte_size)
select q_sent, org_id, 'test-1', org_id::text || '/' || q_sent::text || '/devis.pdf', repeat('a', 64), 100 from t_ctx;

update t_ctx set pdf_path = org_id::text || '/' || q_sent::text || '/devis.pdf';

do $$ begin
perform pg_temp.ok(
  (select count(*) from public.quote_documents where quote_id = (select q_sent from t_ctx)) = 1,
  'un devis envoyé peut recevoir son document');
end $$;

do $$ begin
perform pg_temp.refuses(
  'update public.quote_documents set byte_size = 999 where quote_id = (select q_sent from pg_temp.t_ctx)',
  'un document conservé ne se modifie jamais');
end $$;

do $$ begin
perform pg_temp.refuses(
  'delete from public.quote_documents where quote_id = (select q_sent from pg_temp.t_ctx)',
  'un document conservé ne se supprime jamais');
end $$;

do $$ begin
perform pg_temp.refuses(
  format($sql$ insert into public.quote_documents (quote_id, organization_id, generator_version, object_path, pdf_sha256, byte_size)
    select q_sent, org_id, 'test-1', org_id::text || '/' || q_sent::text || '/devis-bis.pdf', repeat('a', 64), 100 from pg_temp.t_ctx $sql$),
  'un devis n''a jamais deux documents (clé primaire)');
end $$;

do $$ begin raise notice '=== PARTIE 2 — Ce que le client voit ==='; end $$;

select pg_temp.login('ca1'); set local role authenticated;

do $$ begin
perform pg_temp.ok(
  exists (select 1 from public.portal_list_quotes() where id = (select q_sent from pg_temp.t_ctx)),
  'le contact du bon client voit le devis envoyé');
end $$;

-- La table `quote_documents` elle-même reste hors d'atteinte d'un contact —
-- il n'a aucun accès RLS à `quotes`, dont dépend la policy de lecture. Seule
-- la fonction dédiée (`portal_list_quotes`, SECURITY DEFINER) expose le
-- chemin ; c'est ce que le reste de cette partie vérifie.
do $$ begin
perform pg_temp.ok(
  (select pdf_path from public.portal_list_quotes() where id = (select q_sent from pg_temp.t_ctx)) is not null,
  'portal_list_quotes expose le chemin une fois le document conservé');
end $$;

do $$ begin
perform pg_temp.ok(
  (public.portal_quote_detail((select q_sent from pg_temp.t_ctx)) ->> 'pdf_path') is not null,
  'portal_quote_detail expose aussi le chemin');
end $$;

do $$ begin
perform pg_temp.ok(
  public.portal_can_read_file('quote-documents', (select pdf_path from pg_temp.t_ctx)),
  'le contact du bon client peut lire son PDF');
end $$;

reset role;
select pg_temp.login('ca2'); set local role authenticated;

do $$ begin
perform pg_temp.ok(
  not public.portal_can_read_file('quote-documents', (select pdf_path from pg_temp.t_ctx)),
  'le contact d''un AUTRE client ne peut pas lire ce PDF');
end $$;

do $$ begin
perform pg_temp.ok(
  not exists (select 1 from public.portal_list_quotes() where id = (select q_sent from pg_temp.t_ctx)),
  'et ne voit pas ce devis du tout');
end $$;

do $$ begin
perform pg_temp.ok(
  not public.portal_can_read_file('quote-documents', 'nimporte/quoi/devis.pdf'),
  'un chemin qui ne correspond à aucun document conservé est toujours refusé');
end $$;

reset role;
select pg_temp.logout(); set local role authenticated;

do $$ begin
perform pg_temp.ok(
  not public.portal_can_read_file('quote-documents', (select pdf_path from pg_temp.t_ctx)),
  'hors session, aucun accès');
end $$;

-- =============================================================================
do $$
begin
  raise notice '';
  raise notice '=============================================';
  raise notice ' TOUS LES TESTS PASSENT';
  raise notice '=============================================';
end
$$;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;

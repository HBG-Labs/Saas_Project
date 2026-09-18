-- =============================================================================
-- SUITE DE TESTS — Réception de factures électroniques
-- =============================================================================
-- Rejoue les garanties posées par `20260926090000_einvoicing_reception.sql` :
--
--   lecture réservée à `invoice.view` + module Pro « invoicing » ; SEUL
--   `internal_status` est modifiable côté client, sous `invoice.manage` ;
--   aucune écriture d'un autre champ, aucune suppression, jamais possible ;
--   isolation totale entre organisations ; une facture reçue est unique par
--   (provider_code, provider_invoice_id) — jamais un doublon silencieux.
--
--   npm run test:sql
--
-- Se termine par `rollback` : aucune donnée ne survit.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v) values
  ('owner',        '00000000-0000-4000-8000-000000110001'),
  ('technicien',   '00000000-0000-4000-8000-000000110002'),
  ('autre_owner',  '00000000-0000-4000-8000-000000110003');
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
  when others then raise notice '  OK  % (refuse : %)', p_label, left(sqlerrm, 90);
end;
$$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', k || '@test.local',
       '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte', now(),
       '{"provider":"email","providers":["email"]}'::jsonb, json_build_object('display_name', k)::jsonb, now(), now()
from t_ids;

-- -----------------------------------------------------------------------------
-- Fixture : une organisation Pro, un propriétaire, un technicien (sans
-- invoice.manage/view), une seconde organisation pour l'isolation.
-- -----------------------------------------------------------------------------
select pg_temp.login('owner'); set local role authenticated;
insert into public.organizations (slug, name, created_by) values ('einvoicing-reception-test', 'Reception Test', pg_temp.uid('owner'));
reset role;

select pg_temp.login('autre_owner'); set local role authenticated;
insert into public.organizations (slug, name, created_by) values ('einvoicing-reception-autre', 'Autre Org', pg_temp.uid('autre_owner'));
reset role;

create temporary table t_ctx (org_id uuid, autre_org_id uuid, invoice_id uuid);
grant select on t_ctx to authenticated;
insert into t_ctx (org_id, autre_org_id)
values (
  (select id from public.organizations where slug = 'einvoicing-reception-test'),
  (select id from public.organizations where slug = 'einvoicing-reception-autre')
);

delete from public.subscriptions where organization_id in (select org_id from t_ctx union select autre_org_id from t_ctx);
insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select org_id, 'pro', 'active'::public.subscription_status, now() + interval '30 days' from t_ctx
union all
select autre_org_id, 'pro', 'active'::public.subscription_status, now() + interval '30 days' from t_ctx;

-- Les propriétaires (`created_by`) sont déjà rattachés automatiquement par
-- `organizations_create_owner` — seul le technicien reste à ajouter.
insert into public.organization_members (organization_id, user_id, role, status)
select org_id, pg_temp.uid('technicien'), 'technician'::public.org_role, 'active'::public.member_status from t_ctx;

-- La facture reçue elle-même : écriture serveur uniquement, donc posée
-- directement ici (rôle propriétaire de la migration, hors RLS) — jamais via
-- authenticated, exactement comme le ferait le worker de synchronisation.
insert into public.received_invoices (
  organization_id, provider_code, provider_invoice_id,
  supplier_name, supplier_siren, currency_code,
  amount_without_vat, amount_vat, amount_with_vat, issue_date, payment_due_date
)
select org_id, 'superpdp', '424242',
  'Fournisseur Test', '123456789', 'EUR', 100.00, 20.00, 120.00, current_date, current_date + 30
from t_ctx;
update t_ctx set invoice_id = (select id from public.received_invoices where provider_invoice_id = '424242');

do $$ begin raise notice '=== PARTIE 1 — lecture reservee a invoice.view + module Pro ==='; end $$;

select pg_temp.login('owner'); set local role authenticated;
do $$ begin
perform pg_temp.ok(
  exists (select 1 from public.received_invoices where provider_invoice_id = '424242'),
  'le proprietaire (invoice.view) voit la facture recue de sa propre organisation');
end $$;
reset role;

select pg_temp.login('autre_owner'); set local role authenticated;
do $$ begin
perform pg_temp.ok(
  not exists (select 1 from public.received_invoices where provider_invoice_id = '424242'),
  'un proprietaire d''une AUTRE organisation ne voit rien (isolation totale)');
end $$;
reset role;

do $$ begin raise notice '=== PARTIE 2 — seul internal_status est modifiable, sous invoice.manage ==='; end $$;

select pg_temp.login('owner'); set local role authenticated;
do $$
declare
  v_invoice_id uuid;
begin
  select invoice_id into v_invoice_id from t_ctx;
  update public.received_invoices set internal_status = 'viewed' where id = v_invoice_id;
  perform pg_temp.ok(
    (select internal_status = 'viewed' from public.received_invoices where id = v_invoice_id),
    'le proprietaire (invoice.manage) peut marquer une facture recue comme vue');
end $$;
reset role;

-- Une UPDATE bloquée par le `USING` de la RLS n'affecte AUCUNE ligne et NE
-- LÈVE PAS D'EXCEPTION (comportement normal de Postgres) — vérifier l'absence
-- d'effet, pas une exception. Même piège que documenté en Phase 13 de
-- Prospect Radar : `pg_temp.refuses` ne convient qu'aux échecs qui lèvent
-- réellement (contrainte, trigger, colonne non accordée).
select pg_temp.login('technicien'); set local role authenticated;
do $$
declare
  v_rows_affected int;
begin
  update public.received_invoices set internal_status = 'archived'
  where id = (select invoice_id from t_ctx);
  get diagnostics v_rows_affected = row_count;
  perform pg_temp.ok(
    v_rows_affected = 0,
    'un technicien (sans invoice.manage) : 0 ligne affectee (RLS silencieuse)');
end $$;
reset role;

do $$ begin
perform pg_temp.ok(
  (select internal_status = 'viewed' from public.received_invoices where id = (select invoice_id from t_ctx)),
  'la valeur reelle en base n''a pas change malgre la tentative du technicien');
end $$;

select pg_temp.login('owner'); set local role authenticated;
do $$ begin
perform pg_temp.refuses(
  format($sql$ update public.received_invoices set provider_invoice_id = 'usurpe' where id = %L $sql$,
    (select invoice_id from t_ctx)),
  'meme le proprietaire ne peut pas modifier provider_invoice_id (seule internal_status a une grant UPDATE)');
end $$;
reset role;

do $$ begin raise notice '=== PARTIE 3 — immuabilite (garantie par le trigger, pas seulement les grants) ==='; end $$;

do $$ begin
perform pg_temp.refuses(
  format($sql$ delete from public.received_invoices where id = %L $sql$, (select invoice_id from t_ctx)),
  'une facture recue ne peut jamais etre supprimee, meme hors RLS (trigger)');
end $$;

do $$ begin
perform pg_temp.refuses(
  $sql$ insert into public.received_invoices (organization_id, provider_code, provider_invoice_id)
        values ((select org_id from t_ctx), 'superpdp', '424242') $sql$,
  'un doublon (meme provider_code + provider_invoice_id) est refuse par la contrainte unique');
end $$;

do $$ begin raise notice '=== PARTIE 4 — evenements et documents, memes garanties ==='; end $$;

insert into public.received_invoice_events (received_invoice_id, source, event_type, normalized_status, occurred_at)
select invoice_id, 'provider', 'provider_status', 'delivered', now() from t_ctx;

do $$ begin
perform pg_temp.refuses(
  format($sql$ update public.received_invoice_events set message = 'modifie' where received_invoice_id = %L $sql$,
    (select invoice_id from t_ctx)),
  'un evenement de reception est immuable, aucune UPDATE possible');
end $$;

insert into public.received_invoice_documents (received_invoice_id, organization_id, original_format, object_path, sha256, byte_size)
select invoice_id, org_id, 'ubl',
  org_id::text || '/' || invoice_id::text || '/original',
  repeat('a', 64), 1024
from t_ctx;

select pg_temp.login('owner'); set local role authenticated;
do $$ begin
perform pg_temp.ok(
  exists (select 1 from public.received_invoice_events where received_invoice_id = (select invoice_id from t_ctx)),
  'le proprietaire voit le journal d''evenements de sa facture recue');
perform pg_temp.ok(
  exists (select 1 from public.received_invoice_documents where received_invoice_id = (select invoice_id from t_ctx)),
  'le proprietaire voit le document conserve de sa facture recue');
end $$;
reset role;

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

-- =============================================================================
-- SUITE DE TESTS — relances automatiques des devis
-- =============================================================================
-- Rejoue les garanties posées par `20260916090000_relances_devis.sql` :
--
--   envoyé → relances planifiées (J+7, J+14, jamais après la validité) ;
--   accepté / refusé / brouillon → relances passées, avec le motif ;
--   validité dépassée → expiré, par `app.expire_overdue_quotes()` ;
--   tirage atomique : dû, verrou, pas deux fois.
--
-- L'ENVOI lui-même (message, courriel, fil) est couvert par les tests Deno de
-- `quote-reminder-worker` et `_shared/quote-reminders.ts`, sans base.
--
--   npm run test:sql
--
-- Se termine par `rollback` : aucune donnée ne survit.
-- =============================================================================

begin;

set local search_path = pg_temp, public;

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

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v) values ('owner', '00000000-0000-4000-8000-0000000e0001');

create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated',
  k || '@test.local', '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte',
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
from pg_temp.t_ids;

-- -----------------------------------------------------------------------------
-- Une entreprise Pro, un client, un devis
-- -----------------------------------------------------------------------------
insert into public.organizations (slug, name, created_by)
values ('relances-test', 'Relances Test', pg_temp.uid('owner'));

create temporary table t_ctx (org_id uuid, customer_id uuid);
insert into t_ctx (org_id) select id from public.organizations where slug = 'relances-test';

with c as (
  insert into public.customers (organization_id, name, created_by)
  select org_id, 'Client Relances', pg_temp.uid('owner') from t_ctx
  returning id
)
update t_ctx set customer_id = (select id from c);

delete from public.subscriptions where organization_id = (select org_id from t_ctx);
insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select org_id, 'pro', 'active', now() + interval '30 days' from t_ctx;

insert into public.quotes (organization_id, reference, title, customer_id, status, valid_until, created_by)
select org_id, 'DEV-TEST-1', 'Devis de test', customer_id, 'draft', current_date + 30, pg_temp.uid('owner')
from t_ctx;

create function pg_temp.q() returns uuid
language sql stable as $$ select id from public.quotes where reference = 'DEV-TEST-1' $$;

do $$ begin raise notice '=== PARTIE 1 — planification ==='; end $$;

do $$ begin
perform pg_temp.ok(
  (select count(*) from public.quote_reminders where quote_id = pg_temp.q()) = 0,
  'un brouillon n''a aucune relance planifiee');
end $$;

do $$
begin
  begin
    update public.quotes
    set status = 'sent', title = 'Contenu modifie pendant envoi'
    where id = pg_temp.q();
    raise exception 'ECHEC : contenu et statut ont change dans la meme requete'
      using errcode = 'assert_failure';
  exception
    when restrict_violation then
      raise notice '  OK  le contenu ne change pas pendant la transition vers envoye';
  end;
end
$$;

update public.quotes set status = 'sent' where id = pg_temp.q();

do $$ begin
perform pg_temp.ok(
  (select sent_at is not null from public.quotes where id = pg_temp.q()),
  'passer a « envoye » pose sent_at');
end $$;

do $$ begin
perform pg_temp.ok(
  (select array_agg(sequence order by sequence) from public.quote_reminders where quote_id = pg_temp.q() and status = 'pending') = '{1,2}',
  'deux relances planifiees (J+7, J+14 par defaut)');
end $$;

do $$ begin
perform pg_temp.ok(
  (select (r.due_at::date - q.sent_at::date) from public.quote_reminders r join public.quotes q on q.id = r.quote_id
    where r.quote_id = pg_temp.q() and r.sequence = 1) = 7,
  'la premiere relance est due 7 jours apres l''envoi');
end $$;

-- Cadence par entreprise.
update public.organizations set quote_reminder_days = '{3,10,20}' where id = (select org_id from t_ctx);
update public.quotes set reminders_enabled = false where id = pg_temp.q();
update public.quotes set reminders_enabled = true  where id = pg_temp.q();

do $$ begin
perform pg_temp.ok(
  (select array_agg(sequence order by sequence) from public.quote_reminders where quote_id = pg_temp.q() and status = 'pending') = '{1,2,3}',
  'la cadence de l''entreprise est respectee (3 relances) apres replanification');
end $$;

do $$ begin
perform pg_temp.ok(
  (select count(*) from public.quote_reminders where quote_id = pg_temp.q() and status = 'pending' and due_at::date < current_date + 30) = 3,
  'toutes les relances tombent avant la validite');
end $$;

update public.quotes set reminders_enabled = false where id = pg_temp.q();

do $$ begin
perform pg_temp.ok(
  (select count(*) from public.quote_reminders where quote_id = pg_temp.q() and status = 'pending') = 0,
  'desactiver les relances sur le devis retire ce qui restait a envoyer');
end $$;

update public.quotes set reminders_enabled = true where id = pg_temp.q();

do $$
begin
  begin
    update public.organizations set quote_reminder_days = '{1,2,3,4,5,6}' where id = (select org_id from pg_temp.t_ctx);
    raise exception 'ECHEC : six relances ont ete ACCEPTEES' using errcode = 'assert_failure';
  exception
    when check_violation then raise notice '  OK  six relances sont refusees';
  end;
  begin
    update public.organizations set quote_reminder_days = '{0}' where id = (select org_id from pg_temp.t_ctx);
    raise exception 'ECHEC : J+0 a ete ACCEPTE' using errcode = 'assert_failure';
  exception
    when check_violation then raise notice '  OK  J+0 est refuse';
  end;
end
$$;

do $$ begin raise notice '=== PARTIE 2 — ce qui arrete les relances ==='; end $$;

update public.quotes set status = 'accepted', client_responded_at = now() where id = pg_temp.q();

do $$ begin
perform pg_temp.ok(
  (select count(*) from public.quote_reminders where quote_id = pg_temp.q() and status = 'pending') = 0
  and (select count(*) from public.quote_reminders where quote_id = pg_temp.q() and status = 'skipped' and reason = 'Devis accepté') = 3,
  'devis accepte : les relances restantes sont passees, motif « Devis accepté »');
end $$;

do $$
begin
  begin
    update public.quotes set status = 'draft' where id = pg_temp.q();
    raise exception 'ECHEC : un devis accepte a ete rouvert' using errcode = 'assert_failure';
  exception
    when check_violation or restrict_violation then
      raise notice '  OK  un devis accepte ne peut pas redevenir brouillon';
  end;
end
$$;

do $$ begin raise notice '=== PARTIE 3 — expiration ==='; end $$;

insert into public.quotes (
  organization_id, reference, title, customer_id, status, valid_until, created_by
)
select org_id, 'DEV-EXP', 'Devis expire', customer_id, 'draft', current_date - 1, pg_temp.uid('owner')
from t_ctx;

create function pg_temp.q_exp() returns uuid
language sql stable as $$ select id from public.quotes where reference = 'DEV-EXP' $$;

update public.quotes set status = 'sent' where id = pg_temp.q_exp();

do $$ begin
perform pg_temp.ok(
  (select count(*) from public.quote_reminders where quote_id = pg_temp.q_exp() and status = 'pending') = 0,
  'une validite deja depassee ne planifie plus rien');
end $$;

do $$ begin
perform pg_temp.ok(app.expire_overdue_quotes() >= 1, 'expire_overdue_quotes expire le devis');
end $$;

do $$ begin
perform pg_temp.ok(
  (select status = 'expired' from public.quotes where id = pg_temp.q_exp()),
  'le devis est passe en « expire »');
end $$;

do $$ begin raise notice '=== PARTIE 4 — tirage atomique ==='; end $$;

insert into public.quotes (
  organization_id, reference, title, customer_id, status, valid_until, created_by
)
select org_id, 'DEV-CLAIM', 'Devis a relancer', customer_id, 'draft', current_date + 30, pg_temp.uid('owner')
from t_ctx;

create function pg_temp.q_claim() returns uuid
language sql stable as $$ select id from public.quotes where reference = 'DEV-CLAIM' $$;

update public.quotes set status = 'sent' where id = pg_temp.q_claim();
-- Rendre la premiere relance due maintenant.
update public.quote_reminders set due_at = now() - interval '1 minute' where quote_id = pg_temp.q_claim() and sequence = 1;

do $$ begin
perform pg_temp.ok(
  (select count(*) from public.claim_quote_reminders(10) c where c.quote_id = pg_temp.q_claim()) = 1,
  'seule la relance due est tiree, pas celles a venir');
end $$;

do $$ begin
perform pg_temp.ok(
  (select count(*) from public.claim_quote_reminders(10) c where c.quote_id = pg_temp.q_claim()) = 0,
  'une relance fraichement verrouillee n''est pas retiree');
end $$;

update public.quote_reminders set locked_at = now() - interval '20 minutes' where quote_id = pg_temp.q_claim() and sequence = 1;

do $$ begin
perform pg_temp.ok(
  (select count(*) from public.claim_quote_reminders(10) c where c.quote_id = pg_temp.q_claim()) = 1,
  'un verrou de plus de 15 minutes (worker mort) est recupere');
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

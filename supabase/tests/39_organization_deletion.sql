-- =============================================================================
-- Suppression d'organisation : droits, abonnement externe et audit
-- =============================================================================

begin;
set local search_path = pg_temp, public;

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v) values
  ('owner',    '00000000-0000-4000-8000-00000000d001'),
  ('admin',    '00000000-0000-4000-8000-00000000d002'),
  ('outsider', '00000000-0000-4000-8000-00000000d003');

grant select on t_ids to authenticated, service_role;

create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

create function pg_temp.login(p_key text) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', pg_temp.uid(p_key),
      'email', p_key || '@test.local',
      'role', 'authenticated'
    )::text,
    true
  );
end;
$$;

create function pg_temp.ok(p_condition boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'ECHEC : %', p_label using errcode = 'assert_failure';
  end if;
  raise notice '  OK  %', p_label;
end;
$$;

create function pg_temp.refuses(p_sql text, p_label text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ECHEC : % (instruction acceptee)', p_label
    using errcode = 'assert_failure';
exception
  when assert_failure then raise;
  when others then raise notice '  OK  % (refuse : %)', p_label, left(sqlerrm, 90);
end;
$$;

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

select pg_temp.login('owner');
set local role authenticated;

insert into public.organizations (slug, name, created_by) values
  ('delete-empty', 'Entreprise vide', pg_temp.uid('owner')),
  ('delete-paid', 'Entreprise payante', pg_temp.uid('owner')),
  ('delete-denied', 'Entreprise protegee', pg_temp.uid('owner'));

reset role;

insert into public.organization_members (organization_id, user_id, role, status, joined_at)
select id, pg_temp.uid('admin'), 'admin', 'active', now()
from public.organizations
where slug = 'delete-denied';

update public.subscriptions
set provider = 'stripe',
    provider_subscription_id = 'sub_organization_deletion_test',
    status = 'active'
where organization_id = (select id from public.organizations where slug = 'delete-paid');

-- Un administrateur et un utilisateur extérieur ne peuvent jamais supprimer.
select pg_temp.login('admin');
set local role authenticated;
delete from public.organizations where slug = 'delete-denied';
reset role;

select pg_temp.ok(
  exists (select 1 from public.organizations where slug = 'delete-denied'),
  'un administrateur ne peut pas supprimer l''organisation'
);

select pg_temp.login('outsider');
set local role authenticated;
delete from public.organizations where slug = 'delete-denied';
reset role;

select pg_temp.ok(
  exists (select 1 from public.organizations where slug = 'delete-denied'),
  'un utilisateur exterieur ne peut pas supprimer l''organisation'
);

-- Le propriétaire peut supprimer une organisation sans facturation externe.
create temporary table t_deleted_org (id uuid primary key);
insert into t_deleted_org
select id from public.organizations where slug = 'delete-empty';

select pg_temp.login('owner');
set local role authenticated;
delete from public.organizations where slug = 'delete-empty';
reset role;

select pg_temp.ok(
  not exists (select 1 from public.organizations where slug = 'delete-empty'),
  'le proprietaire supprime une organisation sans abonnement externe'
);

select pg_temp.ok(
  exists (
    select 1
    from public.audit_logs a
    join t_deleted_org d on d.id = a.entity_id
    where a.action = 'organization.deleted'
      and a.entity_type = 'organization'
      and a.organization_id is null
  ),
  'la suppression reste tracee dans le journal detache'
);

-- Un abonnement externe vivant bloque la suppression, même pour le propriétaire.
select pg_temp.login('owner');
set local role authenticated;
select pg_temp.refuses(
  $$delete from public.organizations where slug = 'delete-paid'$$,
  'un abonnement externe actif bloque la suppression'
);
reset role;

select pg_temp.ok(
  exists (select 1 from public.organizations where slug = 'delete-paid'),
  'l''organisation payante est conservee apres le refus'
);

-- Une fois le provider réellement clôturé, la suppression redevient possible.
update public.subscriptions
set status = 'canceled', canceled_at = now()
where organization_id = (select id from public.organizations where slug = 'delete-paid');

select pg_temp.login('owner');
set local role authenticated;
delete from public.organizations where slug = 'delete-paid';
reset role;

select pg_temp.ok(
  not exists (select 1 from public.organizations where slug = 'delete-paid'),
  'une organisation dont l''abonnement externe est cloture peut etre supprimee'
);

do $$ begin raise notice '=== TOUS LES TESTS DE SUPPRESSION D''ORGANISATION PASSENT ==='; end $$;

rollback;

-- =============================================================================
-- Suppression d'organisation : droits, abonnement externe et audit
-- =============================================================================

begin;
set local search_path = pg_temp, public;

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v) values
  ('owner',    '00000000-0000-4000-8000-00000000d001'),
  ('admin',    '00000000-0000-4000-8000-00000000d002'),
  ('manager',  '00000000-0000-4000-8000-00000000d003'),
  ('lead',     '00000000-0000-4000-8000-00000000d004'),
  ('tech',     '00000000-0000-4000-8000-00000000d005'),
  ('employee', '00000000-0000-4000-8000-00000000d006'),
  ('outsider', '00000000-0000-4000-8000-00000000d007');

grant select on t_ids to authenticated, service_role;

create temporary table t_results (passed integer not null default 1);
grant insert, select on t_results to authenticated, service_role;

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
  insert into pg_temp.t_results default values;
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
  when others then
    insert into pg_temp.t_results default values;
    raise notice '  OK  % (refuse : %)', p_label, left(sqlerrm, 90);
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
  ('delete-denied', 'Entreprise protegee', pg_temp.uid('owner')),
  ('delete-legal', 'Entreprise avec archives', pg_temp.uid('owner')),
  ('delete-neighbor', 'Entreprise voisine', pg_temp.uid('owner'));

reset role;

insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select id, 'free', 'active', now() + interval '30 days'
from public.organizations
where slug in ('delete-empty', 'delete-paid', 'delete-legal', 'delete-neighbor');

-- Le plan Pro évite que la fixture RBAC ne soit bloquée par le quota Free.
delete from public.subscriptions
where organization_id = (select id from public.organizations where slug = 'delete-denied');
insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select id, 'pro', 'active', now() + interval '30 days'
from public.organizations where slug = 'delete-denied';

insert into public.organization_members (organization_id, user_id, role, status, joined_at)
select o.id, pg_temp.uid(r.k), r.role::public.org_role, 'active', now()
from public.organizations o
cross join (values
  ('admin', 'admin'),
  ('manager', 'manager'),
  ('lead', 'team_leader'),
  ('tech', 'technician'),
  ('employee', 'employee')
) as r(k, role)
where o.slug = 'delete-denied';

-- Un document final soumis à conservation rend la suppression impossible.
with q as (
  insert into public.quotes (organization_id, reference, title, status, created_by)
  select id, 'DEV-LEGAL-1', 'Devis à conserver', 'sent', pg_temp.uid('owner')
  from public.organizations where slug = 'delete-legal'
  returning id, organization_id
)
insert into public.quote_documents
  (quote_id, organization_id, generator_version, object_path, pdf_sha256, byte_size)
select id, organization_id, 'organization-deletion-test',
       organization_id::text || '/' || id::text || '/devis.pdf', repeat('a', 64), 100
from q;

update public.subscriptions
set provider = 'stripe',
    provider_subscription_id = 'sub_organization_deletion_test',
    status = 'active'
where organization_id = (select id from public.organizations where slug = 'delete-paid');

select pg_temp.ok(
  (select count(*) from public.role_permissions where permission = 'organization.delete') = 1
  and exists (
    select 1 from public.role_permissions
    where role = 'owner' and permission = 'organization.delete'
  ),
  'organization.delete est accordee uniquement au proprietaire cote serveur'
);

-- Tous les rôles non propriétaires et un utilisateur extérieur sont refusés.
select pg_temp.login('admin');
set local role authenticated;
delete from public.organizations where slug = 'delete-denied';
reset role;

select pg_temp.ok(
  exists (select 1 from public.organizations where slug = 'delete-denied'),
  'un administrateur ne peut pas supprimer l''organisation'
);

select pg_temp.login('manager');
set local role authenticated;
delete from public.organizations where slug = 'delete-denied';
reset role;

select pg_temp.ok(
  exists (select 1 from public.organizations where slug = 'delete-denied'),
  'un manager ne peut pas supprimer l''organisation'
);

select pg_temp.login('lead');
set local role authenticated;
delete from public.organizations where slug = 'delete-denied';
reset role;

select pg_temp.ok(
  exists (select 1 from public.organizations where slug = 'delete-denied'),
  'un chef d''equipe ne peut pas supprimer l''organisation'
);

select pg_temp.login('tech');
set local role authenticated;
delete from public.organizations where slug = 'delete-denied';
reset role;

select pg_temp.ok(
  exists (select 1 from public.organizations where slug = 'delete-denied'),
  'un technicien ne peut pas supprimer l''organisation'
);

select pg_temp.login('employee');
set local role authenticated;
delete from public.organizations where slug = 'delete-denied';
reset role;

select pg_temp.ok(
  exists (select 1 from public.organizations where slug = 'delete-denied'),
  'un employe ne peut pas supprimer l''organisation'
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

create temporary table t_neighbor_org (id uuid primary key);
insert into t_neighbor_org
select id from public.organizations where slug = 'delete-neighbor';

select pg_temp.login('owner');
set local role authenticated;
delete from public.organizations where slug = 'delete-empty';
reset role;

select pg_temp.ok(
  not exists (select 1 from public.organizations where slug = 'delete-empty'),
  'le proprietaire supprime une organisation sans abonnement externe'
);

select pg_temp.ok(
  not exists (
    select 1 from public.organization_members m
    join t_deleted_org d on d.id = m.organization_id
  )
  and not exists (
    select 1 from public.subscriptions s
    join t_deleted_org d on d.id = s.organization_id
  ),
  'les donnees enfants en cascade ne deviennent pas orphelines'
);

select pg_temp.ok(
  exists (
    select 1 from public.organizations o
    join t_neighbor_org n on n.id = o.id
  )
  and exists (
    select 1 from public.organization_members m
    join t_neighbor_org n on n.id = m.organization_id
  )
  and exists (
    select 1 from public.subscriptions s
    join t_neighbor_org n on n.id = s.organization_id
  ),
  'la suppression ne touche aucune donnee de l''organisation voisine'
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
do $$
begin
  begin
    update public.subscriptions
    set status = 'canceled', canceled_at = now()
    where organization_id = (select id from public.organizations where slug = 'delete-paid');
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

select pg_temp.ok(
  exists (
    select 1 from public.subscriptions s
    join public.organizations o on o.id = s.organization_id
    where o.slug = 'delete-paid' and s.status = 'active'
  ),
  'le client ne peut pas annuler lui-meme l''abonnement pour contourner le garde'
);

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

-- Une archive légale bloque toute la transaction, y compris l'audit préalable.
create temporary table t_legal_org (id uuid primary key);
insert into t_legal_org
select id from public.organizations where slug = 'delete-legal';

select pg_temp.login('owner');
set local role authenticated;
select pg_temp.refuses(
  $$delete from public.organizations where slug = 'delete-legal'$$,
  'un document soumis a conservation legale bloque la suppression'
);
reset role;

select pg_temp.ok(
  exists (
    select 1 from public.organizations o
    join t_legal_org l on l.id = o.id
  ),
  'l''organisation avec archive reste intacte apres le refus'
);

select pg_temp.ok(
  exists (
    select 1 from public.quotes q
    join t_legal_org l on l.id = q.organization_id
  )
  and exists (
    select 1 from public.quote_documents d
    join t_legal_org l on l.id = d.organization_id
  ),
  'le devis et son document conserve restent intacts'
);

select pg_temp.ok(
  not exists (
    select 1 from public.audit_logs a
    join t_legal_org l on l.id = a.entity_id
    where a.action = 'organization.deleted'
      and a.entity_type = 'organization'
  ),
  'le refus est transactionnel et ne laisse aucun faux audit de suppression'
);

select count(*)::integer as tests_passed from pg_temp.t_results;
do $$ begin raise notice '=== TOUS LES TESTS DE SUPPRESSION D''ORGANISATION PASSENT ==='; end $$;

rollback;

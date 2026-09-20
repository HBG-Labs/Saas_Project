-- =============================================================================
-- 18 — notification_states : chacun ses lignes, et seulement chez soi
-- =============================================================================
--
-- La table ne porte que l'état lu / écarté d'une notification dérivée. Ce que
-- cette suite prouve, c'est que la RLS tient ses deux promesses :
--
--   1. une personne ne lit, n'écrit, ne modifie et ne supprime QUE ses lignes ;
--   2. et seulement dans une organisation dont elle est membre — quitter une
--      organisation ferme aussi l'accès à ce qu'on y avait lu.
--
-- Et que les contraintes refusent ce qui n'a pas de sens : une ligne sans
-- état, une clé vide ou démesurée.
--
-- Comme les autres suites : tout se passe dans une transaction annulée à la
-- fin. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v) values
  ('owner',       '00000000-0000-4000-8000-000000180001'),
  ('technicien',  '00000000-0000-4000-8000-000000180002'),
  ('autre_owner', '00000000-0000-4000-8000-000000180003');
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
-- Fixture : une organisation avec un propriétaire et un technicien ; une
-- seconde organisation, étrangère, pour l'isolation.
-- -----------------------------------------------------------------------------
select pg_temp.login('owner'); set local role authenticated;
insert into public.organizations (slug, name, created_by) values ('notif-states-test', 'Notif Test', pg_temp.uid('owner'));
reset role;

select pg_temp.login('autre_owner'); set local role authenticated;
insert into public.organizations (slug, name, created_by) values ('notif-states-autre', 'Autre Org', pg_temp.uid('autre_owner'));
reset role;

create temporary table t_ctx (org_id uuid, autre_org_id uuid);
grant select on t_ctx to authenticated;
insert into t_ctx (org_id, autre_org_id)
values (
  (select id from public.organizations where slug = 'notif-states-test'),
  (select id from public.organizations where slug = 'notif-states-autre')
);

-- Sans abonnement, `app.enforce_member_quota` limite une organisation Gratuite
-- à un seul membre : le technicien ne pourrait pas être ajouté. C'est
-- l'omission qui a fait échouer la première exécution de cette suite.
delete from public.subscriptions where organization_id in (select org_id from t_ctx union select autre_org_id from t_ctx);
insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select org_id, 'pro', 'active'::public.subscription_status, now() + interval '30 days' from t_ctx
union all
select autre_org_id, 'pro', 'active'::public.subscription_status, now() + interval '30 days' from t_ctx;

-- Les propriétaires sont rattachés par `organizations_create_owner` ; le
-- technicien s'ajoute.
insert into public.organization_members (organization_id, user_id, role, status)
select org_id, pg_temp.uid('technicien'), 'technician'::public.org_role, 'active'::public.member_status from t_ctx;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — écrire son propre état ==='; end $$;
-- =============================================================================

select pg_temp.login('technicien'); set local role authenticated;
do $$ begin
  insert into public.notification_states (user_id, organization_id, notification_key, read_at)
  select pg_temp.uid('technicien'), org_id, 'mission_assigned_abc', now() from t_ctx;

  perform pg_temp.ok(
    (select count(*) from public.notification_states where notification_key = 'mission_assigned_abc') = 1,
    'le technicien marque une notification comme lue dans son organisation');

  perform pg_temp.refuses(
    format($q$insert into public.notification_states (user_id, organization_id, notification_key, dismissed_at)
              values (%L, %L, 'stock_low_xyz', now())$q$, pg_temp.uid('owner'), (select org_id from t_ctx)),
    'le technicien ne peut pas écrire une ligne au nom du propriétaire');

  perform pg_temp.refuses(
    format($q$insert into public.notification_states (user_id, organization_id, notification_key, read_at)
              values (%L, %L, 'mission_assigned_def', now())$q$, pg_temp.uid('technicien'), (select autre_org_id from t_ctx)),
    'le technicien ne peut pas écrire dans une organisation dont il n''est pas membre');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — ne lire que ses lignes ==='; end $$;
-- =============================================================================

select pg_temp.login('owner'); set local role authenticated;
do $$ begin
  perform pg_temp.ok(
    not exists (select 1 from public.notification_states where notification_key = 'mission_assigned_abc'),
    'le propriétaire ne voit pas l''état de lecture du technicien, même dans la même organisation');

  insert into public.notification_states (user_id, organization_id, notification_key, read_at, dismissed_at)
  select pg_temp.uid('owner'), org_id, 'leave_pending_123', now(), now() from t_ctx;

  perform pg_temp.ok(
    (select count(*) from public.notification_states) = 1,
    'le propriétaire ne voit que sa propre ligne');
end $$;
reset role;

select pg_temp.login('autre_owner'); set local role authenticated;
do $$ begin
  perform pg_temp.ok(
    (select count(*) from public.notification_states) = 0,
    'une personne étrangère à l''organisation ne voit aucune ligne');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — modifier et supprimer, chez soi seulement ==='; end $$;
-- =============================================================================

select pg_temp.login('technicien'); set local role authenticated;
do $$ begin
  update public.notification_states set dismissed_at = now()
  where notification_key = 'mission_assigned_abc';

  perform pg_temp.ok(
    (select dismissed_at is not null from public.notification_states where notification_key = 'mission_assigned_abc'),
    'le technicien écarte sa propre notification');

  -- L'update d'une ligne invisible n'échoue pas : elle ne touche simplement
  -- rien. C'est ce qu'on vérifie — zéro ligne modifiée, pas une erreur.
  update public.notification_states set read_at = now()
  where notification_key = 'leave_pending_123';

  perform pg_temp.ok(
    not exists (select 1 from public.notification_states where notification_key = 'leave_pending_123'),
    'le technicien ne peut ni voir ni modifier la ligne du propriétaire');

  perform pg_temp.refuses(
    format($q$update public.notification_states set user_id = %L where notification_key = 'mission_assigned_abc'$q$, pg_temp.uid('owner')),
    'le technicien ne peut pas transférer sa ligne à quelqu''un d''autre (with check)');

  delete from public.notification_states where notification_key = 'mission_assigned_abc';
  perform pg_temp.ok(
    not exists (select 1 from public.notification_states where notification_key = 'mission_assigned_abc'),
    'le technicien supprime sa propre ligne (retour à « non lue »)');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — quitter l''organisation ferme l''accès ==='; end $$;
-- =============================================================================

-- Le propriétaire a une ligne dans son organisation. On le rattache aussi à
-- l'autre organisation, il y écrit une ligne, puis on l'en retire : la ligne
-- doit lui devenir invisible, sans être supprimée (elle appartient à
-- l'organisation autant qu'à lui).
insert into public.organization_members (organization_id, user_id, role, status)
select autre_org_id, pg_temp.uid('owner'), 'technician'::public.org_role, 'active'::public.member_status from t_ctx;

select pg_temp.login('owner'); set local role authenticated;
do $$ begin
  insert into public.notification_states (user_id, organization_id, notification_key, read_at)
  select pg_temp.uid('owner'), autre_org_id, 'report_review_777', now() from t_ctx;

  perform pg_temp.ok(
    (select count(*) from public.notification_states) = 2,
    'membre des deux organisations, le propriétaire voit ses deux lignes');
end $$;
reset role;

delete from public.organization_members
where user_id = pg_temp.uid('owner') and organization_id = (select autre_org_id from t_ctx);

select pg_temp.login('owner'); set local role authenticated;
do $$ begin
  perform pg_temp.ok(
    (select count(*) from public.notification_states) = 1,
    'retiré de l''autre organisation, il n''y voit plus sa ligne');

  perform pg_temp.refuses(
    format($q$insert into public.notification_states (user_id, organization_id, notification_key, read_at)
              values (%L, %L, 'report_review_778', now())$q$, pg_temp.uid('owner'), (select autre_org_id from t_ctx)),
    'et ne peut plus y écrire');
end $$;
reset role;

do $$ begin
  perform pg_temp.ok(
    exists (select 1 from public.notification_states where notification_key = 'report_review_777'),
    'la ligne existe toujours en base : l''accès est fermé, la donnée n''est pas perdue');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 5 — les contraintes ==='; end $$;
-- =============================================================================

select pg_temp.login('owner'); set local role authenticated;
do $$ begin
  perform pg_temp.refuses(
    format($q$insert into public.notification_states (user_id, organization_id, notification_key)
              values (%L, %L, 'sans_etat')$q$, pg_temp.uid('owner'), (select org_id from t_ctx)),
    'une ligne sans état (ni lue ni écartée) est refusée');

  perform pg_temp.refuses(
    format($q$insert into public.notification_states (user_id, organization_id, notification_key, read_at)
              values (%L, %L, '', now())$q$, pg_temp.uid('owner'), (select org_id from t_ctx)),
    'une clé vide est refusée');

  perform pg_temp.refuses(
    format($q$insert into public.notification_states (user_id, organization_id, notification_key, read_at)
              values (%L, %L, %L, now())$q$, pg_temp.uid('owner'), (select org_id from t_ctx), repeat('x', 201)),
    'une clé de plus de 200 caractères est refusée');

  perform pg_temp.refuses(
    format($q$insert into public.notification_states (user_id, organization_id, notification_key, read_at)
              values (%L, %L, 'leave_pending_123', now())$q$, pg_temp.uid('owner'), (select org_id from t_ctx)),
    'la même clé ne peut pas exister deux fois pour la même personne et la même organisation');

  -- L'upsert est la forme que le client utilisera : il doit passer.
  insert into public.notification_states (user_id, organization_id, notification_key, read_at)
  select pg_temp.uid('owner'), org_id, 'leave_pending_123', now() from t_ctx
  on conflict (user_id, organization_id, notification_key) do update set read_at = excluded.read_at;

  perform pg_temp.ok(
    (select count(*) from public.notification_states where notification_key = 'leave_pending_123') = 1,
    'l''upsert sur la clé composite passe et ne duplique pas');

  -- `updated_at` n'est pas vérifié ici : `now()` est figé pour toute la durée
  -- d'une transaction, donc dans cette suite `updated_at` vaut toujours
  -- `created_at`. Le trigger est le `public.set_updated_at()` commun, déjà
  -- couvert ailleurs.
end $$;
reset role;

do $$ begin
  raise notice '';
  raise notice ' TOUS LES TESTS PASSENT';
end $$;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;

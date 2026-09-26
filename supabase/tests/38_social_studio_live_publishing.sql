-- =============================================================================
-- 38 — Social Studio : publication Instagram live verrouillée
-- =============================================================================
--
-- Transaction annulée. Rien ne reste en base.
-- Cette suite complète la Phase F dry-run avec les primitives live :
--   1. validation hebdomadaire live uniquement par social.publish ;
--   2. compte Instagram connecté obligatoire ;
--   3. claim atomique séparé dry-run/live ;
--   4. container Meta et succès live idempotents par tentative.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',   '00000000-0000-4000-8000-000000380001'),
  ('admin',    '00000000-0000-4000-8000-000000380002'),
  ('manager',  '00000000-0000-4000-8000-000000380003'),
  ('patron_b', '00000000-0000-4000-8000-000000380004');
select pg_temp.creer_comptes();

create temporary table t_ctx (
  org_id uuid,
  autre_org_id uuid,
  account_id uuid,
  week_id uuid,
  no_account_week_id uuid,
  worker_id uuid
);
grant select, update on t_ctx to authenticated;

insert into t_ctx (org_id, autre_org_id, worker_id)
values (
  pg_temp.organisation_abonnee('social-live-a', 'Social Live A', 'patron', 'pro'),
  pg_temp.organisation_abonnee('social-live-b', 'Social Live B', 'patron_b', 'pro'),
  '00000000-0000-4000-8000-00000038dddd'
);

select pg_temp.ajouter_membre(org_id, 'admin', 'admin') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'manager', 'manager') from t_ctx;

select pg_temp.login('admin'); set local role authenticated;
do $$
declare
  v_week uuid;
  v_no_account_week uuid;
  v_account uuid;
begin
  insert into public.social_accounts (
    organization_id,
    provider,
    provider_account_id,
    username,
    account_type,
    status,
    connected_at,
    created_by
  )
  select
    org_id,
    'instagram',
    '17841400000038001',
    'rezo.360',
    'BUSINESS',
    'connected',
    now(),
    pg_temp.uid('admin')
  from t_ctx
  returning id into v_account;

  insert into public.social_weeks (organization_id, starts_on, status, created_by)
  select org_id, date '2026-09-28', 'ready', pg_temp.uid('manager')
  from t_ctx
  returning id into v_week;

  insert into public.social_weeks (organization_id, starts_on, status, created_by)
  select org_id, date '2026-10-05', 'ready', pg_temp.uid('manager')
  from t_ctx
  returning id into v_no_account_week;

  insert into public.social_posts (
    organization_id, week_id, slot_index, status, format,
    hook, caption, cta, content, created_by
  )
  select
    ctx.org_id,
    weeks.week_id,
    g,
    'ready',
    'image',
    'Hook live ' || g,
    'Legende live complete ' || g,
    'Voir REZO360',
    jsonb_build_object(
      'planned_for',
      (timestamp with time zone '2026-09-28 18:30:00+00' + (g || ' days')::interval)::text,
      'objective',
      'Visites du profil',
      'audience',
      'Artisans'
    ),
    pg_temp.uid('manager')
  from t_ctx ctx
  cross join (values (v_week), (v_no_account_week)) as weeks(week_id)
  cross join generate_series(1, 7) g;

  insert into storage.objects (bucket_id, name, owner_id, metadata)
  select
    'social-media-assets',
    post.organization_id::text || '/' || post.id::text || '/final.png',
    pg_temp.uid('manager')::text,
    '{"mimetype":"image/png","size":"456789"}'::jsonb
  from public.social_posts post
  where post.week_id in (v_week, v_no_account_week);

  insert into public.social_post_assets (
    organization_id, post_id, kind, position, storage_path,
    original_filename, mime_type, width, height, alt_text
  )
  select
    post.organization_id,
    post.id,
    'selected',
    1,
    post.organization_id::text || '/' || post.id::text || '/final.png',
    'final.png',
    'image/png',
    1080,
    1350,
    'Asset final REZO360'
  from public.social_posts post
  where post.week_id in (v_week, v_no_account_week);

  update t_ctx
     set account_id = v_account,
         week_id = v_week,
         no_account_week_id = v_no_account_week;
end $$;
reset role;

select pg_temp.login('manager'); set local role authenticated;
do $$ begin
  perform pg_temp.refuses(
    format($q$select * from public.validate_and_schedule_social_week_live(%L, %L, 'Europe/Paris')$q$,
           (select org_id from t_ctx), (select week_id from t_ctx)),
    'social.manage seul ne peut pas programmer une semaine live');
end $$;
reset role;

select pg_temp.login('admin'); set local role authenticated;
do $$
declare
  v_count integer;
begin
  update public.social_accounts
     set status = 'disconnected'
   where id = (select account_id from t_ctx);

  perform pg_temp.refuses(
    format($q$select * from public.validate_and_schedule_social_week_live(%L, %L, 'Europe/Paris')$q$,
           (select org_id from t_ctx), (select no_account_week_id from t_ctx)),
    'une semaine live exige un compte Instagram connecte');

  update public.social_accounts
     set status = 'connected'
   where id = (select account_id from t_ctx);

  select scheduled_count into v_count
  from public.validate_and_schedule_social_week_live(
    (select org_id from t_ctx),
    (select week_id from t_ctx),
    'Europe/Paris'
  );

  perform pg_temp.ok(v_count = 7, '7 READY avec compte connecte passent en SCHEDULED live');
  perform pg_temp.ok(
    (select count(*) from public.social_posts
     where week_id = (select week_id from t_ctx)
       and status = 'scheduled'
       and publish_state = 'scheduled'
       and publish_mode = 'live'
       and account_id = (select account_id from t_ctx)
       and approved_snapshot ->> 'mode' = 'live'
       and approved_snapshot #>> '{instagram_account,provider_account_id}' = '17841400000038001') = 7,
    'les 7 posts live portent le snapshot approuve et le compte cible');
end $$;
reset role;

select pg_temp.login('patron_b'); set local role authenticated;
do $$ begin
  perform pg_temp.refuses(
    format($q$select * from public.validate_and_schedule_social_week_live(%L, %L, 'Europe/Paris')$q$,
           (select autre_org_id from t_ctx), (select week_id from t_ctx)),
    'la validation live cross-organization est refusee');
end $$;
reset role;

do $$ begin
  perform pg_temp.ok(
    (select count(*) from public.claim_due_social_posts_for_publisher(
      10,
      (select worker_id from t_ctx),
      timestamp with time zone '2026-10-10 18:31:00+00',
      'dry_run',
      'mock'
    )) = 0,
    'le worker dry-run ne claim pas les posts live');

  create temporary table t_live_claims as
  select *
  from public.claim_due_social_posts_for_publisher(
    10,
    (select worker_id from t_ctx),
    timestamp with time zone '2026-10-10 18:31:00+00',
    'live',
    'meta'
  );

  perform pg_temp.ok((select count(*) from t_live_claims) = 7, 'le worker live claim les 7 posts dus');
  perform pg_temp.ok(
    (select count(*) from public.claim_due_social_posts_for_publisher(
      10,
      (select worker_id from t_ctx),
      timestamp with time zone '2026-10-10 18:31:00+00',
      'live',
      'meta'
    )) = 0,
    'un deuxieme worker live ne claim pas les memes posts');
end $$;

do $$ begin
  perform public.mark_social_post_instagram_container(
    (select post_id from t_live_claims order by scheduled_at limit 1),
    (select attempt_id from t_live_claims order by scheduled_at limit 1),
    '17889400000038001',
    'FINISHED',
    timestamp with time zone '2026-10-10 18:32:00+00'
  );

  perform public.mark_social_post_publish_live_success(
    (select post_id from t_live_claims order by scheduled_at limit 1),
    (select attempt_id from t_live_claims order by scheduled_at limit 1),
    '17900000000038001',
    'https://www.instagram.com/p/test-live/',
    '{"graph_api_version":"v24.0"}'::jsonb,
    timestamp with time zone '2026-10-10 18:33:00+00'
  );

  perform pg_temp.ok(
    exists (
      select 1
      from public.social_posts
      where id = (select post_id from t_live_claims order by scheduled_at limit 1)
        and status = 'published'
        and publish_state = 'published_live'
        and instagram_container_id = '17889400000038001'
        and instagram_media_id = '17900000000038001'
        and instagram_permalink = 'https://www.instagram.com/p/test-live/'
    ),
    'le succes live stocke container, media id, permalink et etat published_live');

  perform pg_temp.refuses(
    format(
      $q$select public.mark_social_post_publish_live_success(%L, %L, '17900000000038002')$q$,
      (select post_id from t_live_claims order by scheduled_at limit 1),
      (select attempt_id from t_live_claims order by scheduled_at limit 1)
    ),
    'une tentative live deja traitee ne peut pas republier le meme post');
end $$;

do $$ begin
  perform pg_temp.ok(
    exists (
      select 1
      from public.audit_logs
      where action in ('social.week_scheduled_live', 'social.post_published_live')
        and organization_id = (select org_id from t_ctx)
    ),
    'les actions live sont auditees sans secret');
end $$;

do $$ begin
  raise notice '';
  raise notice ' TOUS LES TESTS PASSENT';
end $$;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;

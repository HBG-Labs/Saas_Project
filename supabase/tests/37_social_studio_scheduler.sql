-- =============================================================================
-- 37 — Social Studio Phase F : validation hebdomadaire et worker dry-run
-- =============================================================================
--
-- Transaction annulée. Rien ne reste en base.
-- Ces tests sont destinés à `supabase test db` dans un environnement
-- non-production sûr.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',       '00000000-0000-4000-8000-000000370001'),
  ('admin',        '00000000-0000-4000-8000-000000370002'),
  ('manager',      '00000000-0000-4000-8000-000000370003'),
  ('patron_b',     '00000000-0000-4000-8000-000000370004');
select pg_temp.creer_comptes();

create temporary table t_ctx (
  org_id uuid,
  autre_org_id uuid,
  week_id uuid,
  incomplete_week_id uuid,
  worker_id uuid,
  first_post_id uuid,
  first_attempt_id uuid,
  foreign_asset_id uuid
);
grant select, update on t_ctx to authenticated;

insert into t_ctx (org_id, autre_org_id, worker_id)
values (
  pg_temp.organisation_abonnee('social-scheduler-a', 'Social Scheduler A', 'patron', 'pro'),
  pg_temp.organisation_abonnee('social-scheduler-b', 'Social Scheduler B', 'patron_b', 'pro'),
  '00000000-0000-4000-8000-00000037dddd'
);

select pg_temp.ajouter_membre(org_id, 'admin', 'admin') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'manager', 'manager') from t_ctx;

do $$
declare
  v_week_b uuid;
  v_post_b uuid;
  v_asset_b uuid;
begin
  insert into public.social_weeks (organization_id, starts_on, status, created_by)
  select autre_org_id, date '2026-09-28', 'ready', pg_temp.uid('patron_b')
  from t_ctx
  returning id into v_week_b;

  insert into public.social_posts (
    organization_id, week_id, slot_index, status, format,
    hook, caption, cta, content, created_by
  )
  select
    autre_org_id,
    v_week_b,
    1,
    'ready',
    'image',
    'Hook autre org',
    'Legende autre org',
    'Voir REZO360',
    jsonb_build_object('planned_for', '2026-09-28T18:30:00Z'),
    pg_temp.uid('patron_b')
  from t_ctx
  returning id into v_post_b;

  insert into storage.objects (bucket_id, name, owner_id, metadata)
  select
    'social-media-assets',
    autre_org_id::text || '/' || v_post_b::text || '/final.png',
    pg_temp.uid('patron_b')::text,
    '{"mimetype":"image/png","size":"456789"}'::jsonb
  from t_ctx;

  insert into public.social_post_assets (
    organization_id, post_id, kind, position, storage_path,
    original_filename, mime_type, width, height, alt_text
  )
  select
    autre_org_id,
    v_post_b,
    'selected',
    1,
    autre_org_id::text || '/' || v_post_b::text || '/final.png',
    'final.png',
    'image/png',
    1080,
    1350,
    'Asset autre organisation'
  from t_ctx
  returning id into v_asset_b;

  update t_ctx set foreign_asset_id = v_asset_b;
end $$;

select pg_temp.login('manager'); set local role authenticated;
do $$
declare
  v_week uuid;
  v_incomplete uuid;
begin
  insert into public.social_weeks (organization_id, starts_on, status, created_by)
  select org_id, date '2026-09-28', 'ready', pg_temp.uid('manager')
  from t_ctx
  returning id into v_week;

  insert into public.social_posts (
    organization_id, week_id, slot_index, status, format,
    hook, caption, cta, content, created_by
  )
  select
    org_id,
    v_week,
    g,
    'ready',
    'image',
    'Hook terrain ' || g,
    'Legende Instagram complete ' || g,
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
  from t_ctx, generate_series(1, 7) g;

  insert into storage.objects (bucket_id, name, owner_id, metadata)
  select
    'social-media-assets',
    post.organization_id::text || '/' || post.id::text || '/final.png',
    pg_temp.uid('manager')::text,
    '{"mimetype":"image/png","size":"456789"}'::jsonb
  from public.social_posts post
  where post.week_id = v_week;

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
  where post.week_id = v_week;

  insert into public.social_weeks (organization_id, starts_on, status, created_by)
  select org_id, date '2026-10-05', 'ready', pg_temp.uid('manager')
  from t_ctx
  returning id into v_incomplete;

  insert into public.social_posts (
    organization_id, week_id, slot_index, status, format,
    hook, caption, cta, content, created_by
  )
  select
    org_id,
    v_incomplete,
    g,
    case when g = 7 then 'draft' else 'ready' end,
    'image',
    'Hook incomplet ' || g,
    'Legende Instagram complete ' || g,
    'Voir REZO360',
    jsonb_build_object(
      'planned_for',
      (timestamp with time zone '2026-10-05 18:30:00+00' + (g || ' days')::interval)::text
    ),
    pg_temp.uid('manager')
  from t_ctx, generate_series(1, 7) g;

  update t_ctx
     set week_id = v_week,
         incomplete_week_id = v_incomplete,
         first_post_id = (
           select id from public.social_posts
           where week_id = v_week and slot_index = 1
         );

  perform pg_temp.refuses(
    format($q$select * from public.validate_and_schedule_social_week(%L, %L, 'Europe/Paris')$q$,
           (select org_id from t_ctx), v_week),
    'social.manage seul ne peut pas valider/programmer la semaine');
end $$;
reset role;

select pg_temp.login('admin'); set local role authenticated;
do $$
declare
  v_count integer;
begin
  perform pg_temp.refuses(
    format($q$select * from public.validate_and_schedule_social_week(%L, %L, 'Europe/Paris')$q$,
           (select org_id from t_ctx), (select incomplete_week_id from t_ctx)),
    '6/7 READY refuse la validation hebdomadaire');

  select scheduled_count into v_count
  from public.validate_and_schedule_social_week(
    (select org_id from t_ctx),
    (select week_id from t_ctx),
    'Europe/Paris'
  );

  perform pg_temp.ok(v_count = 7, '7 READY avec assets finaux passent en SCHEDULED');
  perform pg_temp.ok(
    (select count(*) from public.social_posts
     where week_id = (select week_id from t_ctx)
       and status = 'scheduled'
       and publish_state = 'scheduled'
       and scheduled_at is not null
       and selected_asset_id is not null
       and approved_snapshot ->> 'mode' = 'dry_run') = 7,
    'les 7 posts ont scheduled_at, snapshot, asset selectionne et dry-run');

  perform pg_temp.refuses(
    format($q$update public.social_posts set selected_asset_id = %L where id = %L$q$,
           (select foreign_asset_id from t_ctx), (select first_post_id from t_ctx)),
    'selected_asset_id ne peut pas viser un asset d''une autre organisation');

  select scheduled_count into v_count
  from public.validate_and_schedule_social_week(
    (select org_id from t_ctx),
    (select week_id from t_ctx),
    'Europe/Paris'
  );
  perform pg_temp.ok(v_count = 7, 'double clic validation reste idempotent');
end $$;
reset role;

select pg_temp.login('patron_b'); set local role authenticated;
do $$ begin
  perform pg_temp.refuses(
    format($q$select * from public.validate_and_schedule_social_week(%L, %L, 'Europe/Paris')$q$,
           (select autre_org_id from t_ctx), (select week_id from t_ctx)),
    'validation cross-organization refusee');
end $$;
reset role;

do $$ begin
  create temporary table t_claims as
  select *
  from public.claim_due_social_posts(
    10,
    (select worker_id from t_ctx),
    timestamp with time zone '2026-10-10 18:31:00+00'
  );

  perform pg_temp.ok((select count(*) from t_claims) = 7, 'worker claim les 7 posts dus');
  perform pg_temp.ok(
    (select count(*) from public.claim_due_social_posts(
      10,
      (select worker_id from t_ctx),
      timestamp with time zone '2026-10-10 18:31:00+00'
    )) = 0,
    'deux workers ne claim pas deux fois les memes posts');

end $$;

do $$ begin
  perform public.mark_social_post_publish_result(
    (select post_id from t_claims order by scheduled_at limit 1),
    (select attempt_id from t_claims order by scheduled_at limit 1),
    'simulated_success',
    null,
    null,
    null,
    timestamp with time zone '2026-10-10 18:32:00+00',
    5
  );

  perform pg_temp.ok(
    exists (
      select 1
      from public.social_posts
      where id = (select post_id from t_claims order by scheduled_at limit 1)
        and status = 'published'
        and publish_state = 'published_simulated'
        and instagram_media_id like 'dry_run:%'
    ),
    'le dry-run devient published_simulated avec un identifiant non Meta');

  perform public.mark_social_post_publish_result(
    (select post_id from t_claims order by scheduled_at offset 1 limit 1),
    (select attempt_id from t_claims order by scheduled_at offset 1 limit 1),
    'ambiguous_timeout',
    'ambiguous_timeout',
    'timeout_after_submit',
    'Timeout ambigu apres envoi',
    timestamp with time zone '2026-10-10 18:32:00+00',
    5
  );

  perform pg_temp.ok(
    exists (
      select 1
      from public.social_posts
      where id = (select post_id from t_claims order by scheduled_at offset 1 limit 1)
        and status = 'failed'
        and publish_state = 'reconciliation_required'
    ),
    'un timeout ambigu exige reconciliation et ne repart pas automatiquement');
end $$;

select pg_temp.login('admin'); set local role authenticated;
do $$
declare
  v_skipped integer;
begin
  perform public.set_social_week_publishing_suspended(
    (select org_id from t_ctx),
    (select week_id from t_ctx),
    true
  );

  perform pg_temp.ok(
    (select publishing_suspended_at is not null from public.social_weeks where id = (select week_id from t_ctx)),
    'la semaine suspend les publications');

  update public.social_posts
     set status = 'scheduled',
         publish_state = 'scheduled',
         scheduled_at = now() - interval '1 hour'
   where id = (select post_id from t_claims order by scheduled_at offset 2 limit 1);

  select skipped_count into v_skipped
  from public.set_social_week_publishing_suspended(
    (select org_id from t_ctx),
    (select week_id from t_ctx),
    false
  );

  perform pg_temp.ok(v_skipped >= 1, 'la reprise ne publie pas brutalement les posts depasses');
  perform pg_temp.ok(
    exists (
      select 1
      from public.social_posts
      where week_id = (select week_id from t_ctx)
        and publish_state = 'skipped'
    ),
    'les posts depasses pendant suspension sont a reprogrammer');

  update public.social_posts
     set status = 'scheduled',
         publish_state = 'scheduled',
         scheduled_at = now() + interval '1 hour',
         publish_locked_at = null,
         publish_lock_token = null
   where id = (select post_id from t_claims order by scheduled_at offset 3 limit 1);

  perform public.cancel_social_post(
    (select org_id from t_ctx),
    (select post_id from t_claims order by scheduled_at offset 3 limit 1)
  );

  perform pg_temp.ok(
    exists (
      select 1
      from public.social_posts
      where id = (select post_id from t_claims order by scheduled_at offset 3 limit 1)
        and status = 'cancelled'
        and publish_state = 'cancelled'
    ),
    'un post programme peut etre annule avant processing');
end $$;
reset role;

do $$ begin
  perform pg_temp.ok(
    exists (
      select 1
      from public.audit_logs
      where action in (
        'social.week_approved',
        'social.week_scheduled',
        'social.week_suspended',
        'social.week_resumed',
        'social.post_cancelled',
        'social.post_publish_simulated',
        'social.post_failed'
      )
    ),
    'les actions Social Studio Phase F sont auditees sans secret');
end $$;

do $$ begin
  raise notice '';
  raise notice ' TOUS LES TESTS PASSENT';
end $$;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;

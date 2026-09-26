-- =============================================================================
-- 36 — Social Studio : fondations multi-tenant, RBAC, RLS et médias privés
-- =============================================================================
--
-- Cette suite couvre uniquement la Phase A :
--   1. `social_studio` est une fonctionnalité Pro+ ;
--   2. owner/admin publient, manager prépare, terrain ne voit rien ;
--   3. une validation/programming hebdomadaire exige `social.publish` ;
--   4. comptes, semaines, posts et assets restent dans leur organisation ;
--   5. le bucket social-media-assets reste privé et référencé par table métier.
--
-- Transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',       '00000000-0000-4000-8000-000000360001'),
  ('admin',        '00000000-0000-4000-8000-000000360002'),
  ('manager',      '00000000-0000-4000-8000-000000360003'),
  ('technicien',   '00000000-0000-4000-8000-000000360004'),
  ('chef',         '00000000-0000-4000-8000-000000360005'),
  ('employe',      '00000000-0000-4000-8000-000000360006'),
  ('patron_b',     '00000000-0000-4000-8000-000000360007'),
  ('starter_owner','00000000-0000-4000-8000-000000360008');
select pg_temp.creer_comptes();

create temporary table t_ctx (
  org_id uuid,
  autre_org_id uuid,
  starter_org_id uuid,
  account_id uuid,
  autre_account_id uuid,
  week_id uuid,
  post_id uuid
);
grant select, update on t_ctx to authenticated;

insert into t_ctx (org_id, autre_org_id, starter_org_id)
values (
  pg_temp.organisation_abonnee('social-studio-a', 'Social Studio A', 'patron', 'pro'),
  pg_temp.organisation_abonnee('social-studio-b', 'Social Studio B', 'patron_b', 'pro'),
  pg_temp.organisation_abonnee('social-studio-starter', 'Social Studio Starter', 'starter_owner', 'starter')
);

select pg_temp.ajouter_membre(org_id, 'admin', 'admin') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'manager', 'manager') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'technicien', 'technician') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'chef', 'team_leader') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'employe', 'employee') from t_ctx;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — feature gate et RBAC ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ declare v uuid; begin
  insert into public.social_accounts (
    organization_id, provider_account_id, username, display_name, status, created_by
  )
  select org_id, '17841400000036001', 'rezo.360', 'REZO360', 'connected', pg_temp.uid('patron')
  from t_ctx
  returning id into v;

  update t_ctx set account_id = v;

  perform pg_temp.ok(v is not null, 'le propriétaire crée le compte social Instagram de son organisation');
end $$;
reset role;

select pg_temp.login('manager'); set local role authenticated;
do $$ begin
  perform pg_temp.ok(
    (select count(*) from public.social_accounts) = 1,
    'le manager voit le compte social et peut préparer la semaine');

  insert into public.social_weeks (
    organization_id, account_id, starts_on, status, objective, audience, zone, created_by
  )
  select org_id, account_id, date '2026-09-28', 'ready',
         'Gagner des prospects artisans', 'Artisans', 'France + DOM', pg_temp.uid('manager')
  from t_ctx;

  update t_ctx set week_id = (select id from public.social_weeks where starts_on = date '2026-09-28');

  insert into public.social_posts (
    organization_id, week_id, slot_index, status, format, hook, caption, cta, created_by
  )
  select org_id, week_id, g, 'ready', 'image',
         'Vous gérez encore vos interventions comme ça ?',
         'Un contenu REZO360 prêt à relire.',
         'Découvrir REZO360',
         pg_temp.uid('manager')
  from t_ctx, generate_series(1, 7) g;

  perform pg_temp.ok(
    (select count(*) from public.social_posts where status = 'ready') = 7,
    'le manager prépare les 7 contenus READY');

  perform pg_temp.refuses(
    format($q$insert into public.social_accounts (
                organization_id, provider_account_id, username, status
              )
              values (%L, '17841400000036199', 'manager.rezo', 'connected')$q$,
           (select org_id from t_ctx)),
    'le manager ne peut pas créer ni connecter un compte Instagram');

  perform pg_temp.refuses(
    format($q$update public.social_accounts
              set status = 'disconnected'
              where id = %L$q$, (select account_id from t_ctx)),
    'le manager ne peut pas modifier la connexion Instagram');

  perform pg_temp.refuses(
    format($q$update public.social_weeks
              set status = 'scheduled', approved_by = %L, approved_at = now()
              where id = %L$q$, pg_temp.uid('manager'), (select week_id from t_ctx)),
    'le manager ne peut pas valider/programmer la semaine : social.publish manque');

  perform pg_temp.refuses(
    format($q$update public.social_posts
              set scheduled_at = timestamp with time zone '2026-09-28 20:00:00+00'
              where week_id = %L and slot_index = 1$q$, (select week_id from t_ctx)),
    'le manager ne peut pas contourner la publication via scheduled_at direct');
end $$;
reset role;

select pg_temp.login('technicien'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from public.social_accounts) = 0, 'un technicien ne voit pas Social Studio');
  perform pg_temp.ok((select count(*) from public.social_weeks) = 0, 'ni les semaines éditoriales');
  perform pg_temp.ok((select count(*) from public.social_posts) = 0, 'ni les posts');
end $$;
reset role;

select pg_temp.login('chef'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from public.social_accounts) = 0, 'un chef d’équipe ne voit pas Social Studio');
end $$;
reset role;

select pg_temp.login('employe'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from public.social_accounts) = 0, 'un employé ne voit pas Social Studio');
end $$;
reset role;

select pg_temp.login('starter_owner'); set local role authenticated;
do $$ begin
  perform pg_temp.refuses(
    format($q$insert into public.social_accounts (organization_id, provider_account_id, username, status)
              values (%L, '17841400000036999', 'starter.rezo', 'connected')$q$,
           (select starter_org_id from t_ctx)),
    'une organisation Starter ne franchit pas le feature gate social_studio');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — validation hebdomadaire par admin ==='; end $$;
-- =============================================================================

select pg_temp.login('admin'); set local role authenticated;
do $$ begin
  update public.social_weeks
  set status = 'scheduled',
      approved_by = pg_temp.uid('admin'),
      approved_at = now()
  where id = (select week_id from t_ctx);

  update public.social_posts
  set status = 'scheduled',
      scheduled_at = timestamp with time zone '2026-09-28 18:30:00+00',
      approved_by = pg_temp.uid('admin'),
      approved_at = now()
  where week_id = (select week_id from t_ctx);

  perform pg_temp.ok(
    (select status = 'scheduled' and approved_by = pg_temp.uid('admin')
       from public.social_weeks where id = (select week_id from t_ctx)),
    'un admin valide et programme la semaine entière');

  perform pg_temp.ok(
    (select count(*) from public.social_posts where status = 'scheduled') = 7,
    'les 7 posts deviennent SCHEDULED après validation hebdomadaire');

  update public.social_accounts
  set last_synced_at = now()
  where id = (select account_id from t_ctx);

  perform pg_temp.ok(
    (select last_synced_at is not null from public.social_accounts where id = (select account_id from t_ctx)),
    'un admin peut synchroniser la connexion Instagram');
end $$;
reset role;

select pg_temp.login('manager'); set local role authenticated;
do $$ begin
  perform pg_temp.refuses(
    format($q$update public.social_posts
              set caption = caption || ' Mise à jour tardive.'
              where week_id = %L and slot_index = 1$q$, (select week_id from t_ctx)),
    'le manager ne modifie pas un post déjà programmé');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — isolation et cohérence organisationnelle ==='; end $$;
-- =============================================================================

insert into public.social_accounts (organization_id, provider_account_id, username, status)
select autre_org_id, '17841400000036002', 'autre.rezo', 'connected' from t_ctx;
update t_ctx set autre_account_id = (
  select id from public.social_accounts where provider_account_id = '17841400000036002'
);

select pg_temp.login('patron_b'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from public.social_accounts) = 1, 'l’autre organisation ne voit que son compte');
  perform pg_temp.ok((select count(*) from public.social_weeks) = 0, 'et aucune semaine de l’organisation A');
end $$;
reset role;

select pg_temp.login('patron'); set local role authenticated;
do $$ begin
  perform pg_temp.refuses(
    format($q$insert into public.social_weeks (organization_id, account_id, starts_on)
              values (%L, %L, date '2026-10-05')$q$,
           (select org_id from t_ctx), (select autre_account_id from t_ctx)),
    'une semaine ne peut pas pointer vers un compte Instagram d’un autre tenant');

  update public.social_accounts
  set status = 'disconnected'
  where id = (select autre_account_id from t_ctx);

  delete from public.social_accounts
  where id = (select autre_account_id from t_ctx);

  perform pg_temp.refuses(
    format($q$update public.social_posts set organization_id = %L
              where week_id = %L and slot_index = 1$q$,
           (select autre_org_id from t_ctx), (select week_id from t_ctx)),
    'un post ne peut pas changer d’organisation');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — médias privés et référencés ==='; end $$;
-- =============================================================================

update t_ctx set post_id = (
  select id from public.social_posts where week_id = (select week_id from t_ctx) and slot_index = 1
);

insert into storage.objects (bucket_id, name, owner_id, metadata)
select
  'social-media-assets',
  org_id::text || '/' || post_id::text || '/visuel-1.webp',
  pg_temp.uid('manager')::text,
  '{"mimetype":"image/webp","size":"123456"}'::jsonb
from t_ctx;

select pg_temp.login('manager'); set local role authenticated;
do $$ declare v_asset uuid; begin
  insert into public.social_post_assets (
    organization_id, post_id, kind, position, storage_path, original_filename, alt_text
  )
  select org_id, post_id, 'selected', 1,
         org_id::text || '/' || post_id::text || '/visuel-1.webp',
         'visuel-1.webp',
         'Aperçu REZO360'
  from t_ctx
  returning id into v_asset;

  perform pg_temp.ok(v_asset is not null, 'le manager référence une image déposée dans le bucket privé');
  perform pg_temp.ok(
    (select mime_type = 'image/webp' and size_bytes = 123456
       from public.social_post_assets where id = v_asset),
    'les métadonnées techniques viennent de Storage');
  perform pg_temp.ok(
    exists (select 1 from storage.objects where bucket_id = 'social-media-assets'),
    'l’objet Storage est lisible après référencement métier');
end $$;
reset role;

select pg_temp.login('patron_b'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) from public.social_post_assets) = 0, 'l’autre tenant ne voit aucun asset');
  perform pg_temp.ok(
    not exists (select 1 from storage.objects where bucket_id = 'social-media-assets'),
    'et ne peut pas lire l’objet Storage référencé');
  perform pg_temp.ok(
    (select status = 'connected' from public.social_accounts where id = (select autre_account_id from t_ctx)),
    'un UPDATE/DELETE cross-tenant direct n’a pas affecté le compte Instagram de l’autre organisation');
end $$;
reset role;

select pg_temp.login('manager'); set local role authenticated;
do $$ begin
  perform pg_temp.refuses(
    format($q$insert into public.social_post_assets (organization_id, post_id, kind, position, storage_path)
              values (%L, %L, 'source', 2, 'mauvais-chemin.webp')$q$,
           (select org_id from t_ctx), (select post_id from t_ctx)),
    'un chemin de média sans préfixe organization/post est refusé');

  perform pg_temp.refuses(
    format($q$update public.social_post_assets
              set storage_path = storage_path || '.remplace'
              where post_id = %L$q$, (select post_id from t_ctx)),
    'un asset social ne se remplace pas en place');
end $$;
reset role;

do $$ begin
  perform pg_temp.ok(
    exists (
      select 1
      from storage.buckets
      where id = 'social-media-assets'
        and public = false
        and file_size_limit = 10485760
    ),
    'le bucket social-media-assets existe et reste privé');
end $$;

do $$ begin
  raise notice '';
  raise notice ' TOUS LES TESTS PASSENT';
end $$;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;

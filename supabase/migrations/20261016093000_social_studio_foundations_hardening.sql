-- =============================================================================
-- Social Studio / Instagram Growth Engine — durcissement des fondations
-- =============================================================================
--
-- Migration additive uniquement.
-- La migration initiale reste immuable ; ces règles resserrent l'accès à la
-- connexion Instagram avant l'ajout du flux OAuth.
-- =============================================================================

-- La connexion Instagram devient une opération de publication/compte :
-- owner/admin seulement dans la matrice actuelle. Les managers gardent la
-- préparation des contenus, mais ne peuvent ni créer ni couper l'intégration.
drop policy if exists "social_accounts_insert" on public.social_accounts;
create policy "social_accounts_insert"
  on public.social_accounts for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.publish'))
  );

drop policy if exists "social_accounts_update" on public.social_accounts;
create policy "social_accounts_update"
  on public.social_accounts for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.publish'))
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.publish'))
  );

drop policy if exists "social_accounts_delete" on public.social_accounts;
create policy "social_accounts_delete"
  on public.social_accounts for delete
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.publish'))
  );

create or replace function app.enforce_social_publish_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_requires_publish boolean := false;
begin
  -- Les workers et Edge Functions internes utilisent service_role : ils n'ont
  -- pas d'utilisateur courant et franchiront les états techniques plus tard.
  if v_actor is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_requires_publish :=
      new.status in ('scheduled', 'processing', 'published')
      or new.approved_by is not null
      or new.approved_at is not null
      or new.scheduled_at is not null
      or new.published_at is not null
      or new.instagram_media_id is not null;
  elsif tg_op = 'UPDATE' then
    v_requires_publish :=
      old.status in ('scheduled', 'processing', 'published')
      or new.status in ('scheduled', 'processing', 'published')
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at
      or new.scheduled_at is distinct from old.scheduled_at
      or new.published_at is distinct from old.published_at
      or new.instagram_media_id is distinct from old.instagram_media_id;
  end if;

  if v_requires_publish
     and not (select app.has_org_permission(new.organization_id, 'social.publish')) then
    raise exception 'La validation ou programmation Social Studio exige social.publish.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke all on function app.enforce_social_publish_permission()
  from public, anon, authenticated;

do $$
begin
  if has_table_privilege('authenticated', 'public.social_accounts', 'INSERT')
     and not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'social_accounts'
         and policyname = 'social_accounts_insert'
         and with_check like '%social.publish%'
         and with_check not like '%social.manage%'
     ) then
    raise exception 'social_accounts_insert doit exiger social.publish.';
  end if;
end
$$;

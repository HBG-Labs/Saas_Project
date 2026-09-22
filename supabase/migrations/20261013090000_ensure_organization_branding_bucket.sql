-- Répare les environnements où la migration de l'éditeur de documents a été
-- enregistrée sans que le bucket de logos soit encore présent.
--
-- Migration additive : ne modifie pas 20261007090000, déjà publiée. Le logo
-- est volontairement public (identité visuelle sur les devis et factures),
-- mais seul un membre autorisé à modifier l'organisation peut en déposer un.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-branding',
  'organization-branding',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists organization_branding_upload on storage.objects;
create policy organization_branding_upload
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'organization-branding'
    and app.has_org_permission(((storage.foldername(name))[1])::uuid, 'organization.update')
  );

drop policy if exists organization_branding_delete on storage.objects;
create policy organization_branding_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'organization-branding'
    and app.has_org_permission(((storage.foldername(name))[1])::uuid, 'organization.update')
  );

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'organization-branding'
      and public
      and file_size_limit = 2097152
  ) then
    raise exception 'Le bucket organization-branding n''a pas été initialisé correctement.';
  end if;
end
$$;

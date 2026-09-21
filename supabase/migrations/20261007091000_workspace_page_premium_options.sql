-- Options de présentation persistantes pour l'éditeur de pages.
alter table public.workspace_pages
  add column font_family text not null default 'sans'
    check (font_family in ('sans', 'serif', 'mono')),
  add column small_text boolean not null default false,
  add column full_width boolean not null default false,
  add column locked boolean not null default false;

-- Une page verrouillée reste lisible et configurable (pour pouvoir la
-- déverrouiller), mais son titre et son contenu ne peuvent plus être écrasés.
create or replace function public.save_workspace_page(
  p_page_id             uuid,
  p_expected_updated_at timestamptz,
  p_title               text,
  p_content             jsonb
)
returns public.workspace_pages
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_page public.workspace_pages;
begin
  select * into v_page from public.workspace_pages where id = p_page_id for update;
  if not found then
    raise exception 'Page introuvable.' using errcode = 'no_data_found';
  end if;
  if v_page.locked then
    raise exception 'Cette page est verrouillée. Déverrouillez-la avant de la modifier.'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if v_page.updated_at is distinct from p_expected_updated_at then
    raise exception 'Cette page a été modifiée par quelqu''un d''autre depuis votre ouverture. Rechargez-la avant d''enregistrer.'
      using errcode = 'serialization_failure';
  end if;

  update public.workspace_pages
  set title = coalesce(nullif(btrim(p_title), ''), 'Sans titre'), content = p_content
  where id = p_page_id
  returning * into v_page;
  return v_page;
end;
$$;

revoke all on function public.save_workspace_page(uuid, timestamptz, text, jsonb)
  from public, anon;
grant execute on function public.save_workspace_page(uuid, timestamptz, text, jsonb)
  to authenticated, service_role;

notify pgrst, 'reload schema';

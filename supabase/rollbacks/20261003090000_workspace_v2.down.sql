-- Retour arrière de 20261003090000_workspace_v2.sql — À LA MAIN, JAMAIS PAR db push.
-- PERTE DE DONNÉES : espaces personnels (et leurs pages), récentes, favoris,
-- modèles d'entreprise, icônes, couvertures, conversations IA de portée
-- Workspace (leur page_id et scope). Les politiques Workspace reviennent à leur
-- définition de 20260929090000 — à réappliquer depuis ce fichier (§10).
begin;
drop policy if exists workspace_covers_storage_read on storage.objects;
drop policy if exists workspace_covers_storage_upload on storage.objects;
drop policy if exists workspace_covers_storage_delete on storage.objects;
delete from storage.objects where bucket_id = 'workspace-covers';
delete from storage.buckets where id = 'workspace-covers';

drop policy if exists "ai_conversations_insert" on public.ai_conversations;
delete from public.ai_conversations where scope = 'workspace';
alter table public.ai_conversations drop column if exists page_id, drop column if exists scope;
-- Puis : recréer "ai_conversations_insert" telle que définie dans 20260902150100.

drop function if exists public.reserve_ai_usage(uuid, uuid, text);
-- Puis : recréer public.reserve_ai_usage(uuid, uuid) depuis 20260910012439.

drop function if exists public.search_workspace_pages(uuid, text, integer);
drop index if exists public.workspace_pages_search_idx;
alter table public.workspace_pages drop column if exists search_vector, drop column if exists search_text;
drop function if exists app.tiptap_text(jsonb);

drop function if exists public.create_page_from_template(uuid, uuid, uuid, text);
drop table if exists public.workspace_templates;
drop function if exists public.touch_workspace_page(uuid);
drop trigger if exists workspace_favorites_guard on public.workspace_favorites;
drop function if exists app.guard_workspace_favorite();
drop table if exists public.workspace_favorites;
drop table if exists public.workspace_page_visits;

alter table public.workspace_pages drop column if exists cover_path, drop column if exists icon;

drop trigger if exists organization_members_archive_personal_workspace on public.organization_members;
drop function if exists app.archive_personal_workspace_on_departure();
drop function if exists public.ensure_personal_workspace_space(uuid);
delete from public.workspace_spaces where owner_member_id is not null;

-- Les politiques Workspace référencent les fonctions de visibilité : les
-- recréer d'abord depuis 20260929090000 (§10), puis :
drop function if exists app.workspace_page_visible(uuid);
drop function if exists app.workspace_space_visible(uuid);
alter table public.workspace_spaces drop column if exists owner_member_id;

delete from public.role_permissions where permission = 'ai.workspace';
commit;

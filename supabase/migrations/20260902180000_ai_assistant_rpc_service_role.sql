-- =============================================================================
-- Assistant IA — corrige les RPC pour l'appel en rôle de service
-- =============================================================================
--
-- CE QUI A ÉTÉ MESURÉ EN TESTANT RÉELLEMENT LA EDGE FUNCTION ENRICHIE
--
-- `public.ai_quota_status`, appelée depuis `ai-assistant/index.ts` via le
-- client `service_role`, renvoyait systématiquement AUCUNE LIGNE — traduit
-- côté fonction en « Quota IA illisible », une erreur 500 sur toute question
-- posée à l'assistant. `public.match_ai_document_chunks` a exactement le même
-- défaut, resté invisible jusqu'ici faute d'avoir été appelée en conditions
-- réelles : elle aurait silencieusement renvoyé zéro fragment à chaque fois,
-- sans erreur visible.
--
-- LA CAUSE
--
-- Les deux fonctions gardent leur lecture derrière
-- `app.is_org_member(p_organization_id)`, qui délègue à
-- `app.current_org_role` — laquelle compare `organization_members.user_id` à
-- `auth.uid()` (`20260808100200_organizations.sql`). Or `auth.uid()` n'existe
-- que dans une session PORTÉE PAR UN JWT UTILISATEUR. Le client
-- `service_role` de la Edge Function n'en a aucun : `auth.uid()` y vaut
-- toujours NULL, donc « membre » y vaut toujours faux — quelle que soit
-- l'organisation, quel que soit l'utilisateur réellement concerné.
--
-- LA CORRECTION
--
-- La garde ne s'applique plus que lorsqu'une session utilisateur existe
-- (`auth.uid() is not null`). Ce n'est PAS un relâchement : le rôle de
-- service contourne de toute façon la RLS de chaque table qu'il touche, et
-- `ai-assistant/index.ts` vérifie DÉJÀ explicitement l'appartenance et la
-- permission (`requireAiAccess`, avant tout appel à ces RPC) — la garde
-- devient redondante, pas absente, dans ce contexte précis. Elle reste
-- pleinement active si l'une de ces fonctions était un jour appelée
-- directement depuis le navigateur avec la session d'un utilisateur : c'est
-- le cas qu'elle protège réellement.
-- =============================================================================

drop function if exists public.match_ai_document_chunks(uuid, extensions.vector, float, integer);

create or replace function public.match_ai_document_chunks(
  p_organization_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_threshold float default 0.70,
  p_match_count integer default 8
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    1 - (c.embedding OPERATOR(extensions.<=>) p_query_embedding) as similarity
  from public.ai_document_chunks c
  where (auth.uid() is null or app.is_org_member(p_organization_id))
    and c.organization_id = p_organization_id
    and c.embedding is not null
    and 1 - (c.embedding OPERATOR(extensions.<=>) p_query_embedding) >= p_match_threshold
  order by c.embedding OPERATOR(extensions.<=>) p_query_embedding
  limit least(p_match_count, 20);
$$;

revoke all on function public.match_ai_document_chunks(uuid, extensions.vector, float, integer)
  from public, anon;
grant execute on function public.match_ai_document_chunks(uuid, extensions.vector, float, integer)
  to authenticated;

comment on function public.match_ai_document_chunks(uuid, extensions.vector, float, integer) is
  'Recherche vectorielle des fragments documentaires, filtree par organisation. La garde de membership ne s''applique qu''en presence d''une session utilisateur (auth.uid()) : le role de service, seul appelant reel via la Edge Function ai-assistant, a deja verifie l''appartenance en amont.';

drop function if exists public.ai_quota_status(uuid);

create or replace function public.ai_quota_status(p_organization_id uuid)
returns table (
  used integer,
  quota_limit integer,
  remaining integer,
  unlimited boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_used  integer;
begin
  if auth.uid() is not null and not app.is_org_member(p_organization_id) then
    return;
  end if;

  v_limit := app.org_feature_limit(p_organization_id, 'ai_assistant');

  select count(*) into v_used
  from public.ai_usage
  where organization_id = p_organization_id
    and created_at >= date_trunc('month', now());

  return query select
    v_used,
    v_limit,
    case when v_limit is null then null else greatest(v_limit - v_used, 0) end,
    v_limit is null;
end;
$$;

revoke all on function public.ai_quota_status(uuid) from public, anon;
grant execute on function public.ai_quota_status(uuid) to authenticated;

comment on function public.ai_quota_status(uuid) is
  'Consommation IA du mois civil en cours pour une organisation, comparee au plafond du plan. La garde de membership ne s''applique qu''en presence d''une session utilisateur : le role de service, seul appelant reel via la Edge Function ai-assistant, a deja verifie l''appartenance en amont.';

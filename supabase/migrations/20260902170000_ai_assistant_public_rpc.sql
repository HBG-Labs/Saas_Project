-- =============================================================================
-- Assistant IA — déplace les RPC vers le schéma public (correction)
-- =============================================================================
--
-- CE QUI A ÉTÉ MESURÉ AVANT D'ÉCRIRE LA EDGE FUNCTION
--
-- `app.match_ai_document_chunks` et `app.ai_quota_status`
-- (20260902150000/150100) ont été posées dans le schéma `app`, par analogie
-- avec `app.has_org_permission` et consorts. Mais `app` n'est PAS exposé par
-- PostgREST (`supabase/config.toml` : `schemas = ["public", "graphql_public"]`,
-- posé dès `20260808100100_rbac.sql` précisément pour qu'aucune fonction
-- d'autorisation n'y soit atteignable depuis le navigateur). `supabase-js`,
-- utilisé par la Edge Function comme par le client, appelle `.rpc()` via
-- PostgREST — jamais en connexion Postgres directe. Ces deux fonctions
-- auraient donc renvoyé une erreur 404 (PGRST202) au premier appel réel,
-- jamais détectée par les migrations elles-mêmes (elles s'appliquent sans
-- erreur : le problème n'est pas SQL, il est dans l'exposition HTTP).
--
-- `public.organization_activity_stats` (20260812100700) est la preuve que ce
-- projet a déjà résolu cette distinction : les RPC APPELÉES PAR LE CLIENT
-- vivent en `public`, protégées par leur propre `security definer` et des
-- vérifications explicites en première ligne — jamais par l'invisibilité du
-- schéma `app`, qui protège les fonctions internes aux policies RLS, pas les
-- points d'entrée RPC.
--
-- Une migration appliquée ne se corrige pas en l'éditant : celle-ci DÉPLACE
-- les deux fonctions plutôt que de reprendre les fichiers d'origine.
-- =============================================================================

drop function if exists app.match_ai_document_chunks(uuid, extensions.vector, float, integer);
drop function if exists app.ai_quota_status(uuid);

-- -----------------------------------------------------------------------------
-- public.match_ai_document_chunks
-- -----------------------------------------------------------------------------
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
  where app.is_org_member(p_organization_id)
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
  'Recherche vectorielle des fragments documentaires, filtree par organisation. Seul point d''entree en lecture de ai_document_chunks. Expose en public pour etre appelable via supabase-js .rpc().';

-- -----------------------------------------------------------------------------
-- public.ai_quota_status
-- -----------------------------------------------------------------------------
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
  if not app.is_org_member(p_organization_id) then
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
  'Consommation IA du mois civil en cours pour une organisation, comparee au plafond du plan. Appelee par la Edge Function ai-assistant avant tout appel au modele. Expose en public pour etre appelable via supabase-js .rpc().';

-- =============================================================================
-- Prospect Radar — Phase 6 : agrégats du tableau de bord
-- =============================================================================
--
-- L'interface (§13-14 du cahier des charges) ne doit JAMAIS charger l'
-- intégralité de `prospects` dans le navigateur pour en tirer des compteurs
-- (§29 Performance). Cette RPC fait les agrégations en base, en un seul
-- aller-retour, et ne renvoie que des nombres — jamais une ligne de prospect.
--
-- Callable par `authenticated` (n'importe quel client REZO360 pourrait
-- l'appeler techniquement), mais le corps refuse explicitement quiconque n'a
-- pas `prospecting.view` — comme toutes les RPC déjà exposées côté
-- organisation (`organization_billing_summary`, etc.). Ce n'est PAS une
-- rustine : c'est la garantie que même un appel direct à `/rest/v1/rpc/...`
-- depuis un compte client ordinaire échoue, exactement comme l'exige §30.
--
-- Seuils des paliers 🔥/🟠/🔵 : arbitraires mais documentés ici, pas dans le
-- frontend — à ajuster librement en modifiant cette fonction (une nouvelle
-- migration, jamais celle-ci une fois appliquée).
-- =============================================================================

create or replace function public.prospecting_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not app.has_platform_permission('prospecting.view') then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'total', (select count(*) from public.prospects),
    'detected_today', (select count(*) from public.prospects where first_detected_at::date = current_date),
    'score_tiers', jsonb_build_object(
      -- 🔥 forte / 🟠 moyenne / 🔵 détecté.
      'forte',   (select count(*) from public.prospects where opportunity_score >= 70),
      'moyenne', (select count(*) from public.prospects where opportunity_score >= 40 and opportunity_score < 70),
      'basse',   (select count(*) from public.prospects where opportunity_score < 40)
    ),
    'by_status', (
      select coalesce(jsonb_object_agg(s.status, s.cnt), '{}'::jsonb)
      from (select status::text as status, count(*) as cnt from public.prospects group by status) s
    ),
    'by_zone', (
      select coalesce(jsonb_object_agg(s.zone_label, s.cnt), '{}'::jsonb)
      from (
        select coalesce(z.label, 'Non zoné') as zone_label, count(*) as cnt
        from public.prospects p
        left join public.prospecting_zones z on z.id = p.zone_id
        group by z.label
      ) s
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.prospecting_dashboard_stats() from public, anon;
grant execute on function public.prospecting_dashboard_stats() to authenticated;

comment on function public.prospecting_dashboard_stats() is
  'Compteurs agrégés pour le tableau de bord Prospect Radar (Phase 6). Refuse explicitement quiconque n''a pas '
  'prospecting.view, y compris un client REZO360 authentifié — ne renvoie jamais une ligne de prospect.';

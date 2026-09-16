-- =============================================================================
-- Prospect Radar — Phase 12 : analytics (§31 du cahier des charges)
-- =============================================================================
--
-- CE QUE CETTE RPC MESURE, ET CE QU'ELLE N'INVENTE PAS
--
-- Le funnel demandé est « détectés → qualifiés → contactés → réponses →
-- intéressés → essais → clients ». Ce système ne suit AUCUN événement
-- distinct « a répondu » — seule la timeline `prospect_activities`
-- (Phase 2) existe, avec les transitions RÉELLEMENT enregistrées
-- (a_qualifier, contacte, interesse, essai, converti). « Réponses » est
-- donc VOLONTAIREMENT absent d'ici : l'inventer à partir d'une donnée qui
-- n'existe pas irait contre le principe tenu depuis la Phase 1 (jamais un
-- signal fabriqué). « Intéressé » reste le meilleur proxy réel d'une
-- réaction positive du prospect.
--
-- COHORTE, PAS INSTANTANÉ : un prospect « qualifié » compte même s'il a
-- ensuite été refusé — la question posée par §32 (« quels secteurs
-- répondent le plus, au fil des mois ») porte sur ce qui a été ATTEINT un
-- jour, pas sur le statut actuel. `prospect_activities` étant insert-only
-- (Phase 2), cette lecture ne peut jamais être faussée par une réécriture.
--
-- `p_from`/`p_to` filtrent la cohorte par DATE DE DÉTECTION (l'événement
-- `detecte`) — pas par date des étapes suivantes, qui peuvent survenir bien
-- après. C'est la même convention qu'une analyse de cohorte marketing
-- classique.
-- =============================================================================

create or replace function public.prospecting_analytics(p_from date default null, p_to date default null)
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

  with detected as (
    select pa.siren, pa.created_at as detected_at, pa.score_snapshot as initial_score
    from public.prospect_activities pa
    where pa.event = 'detecte'
      and (p_from is null or pa.created_at::date >= p_from)
      and (p_to is null or pa.created_at::date <= p_to)
  ),
  reached as (
    select
      d.siren,
      bool_or(pa.event = 'a_qualifier') as reached_qualified,
      bool_or(pa.event = 'contacte')    as reached_contacted,
      bool_or(pa.event = 'interesse')   as reached_interested,
      bool_or(pa.event = 'essai')       as reached_trial,
      bool_or(pa.event = 'converti')    as reached_converted
    from detected d
    join public.prospect_activities pa on pa.siren = d.siren
    group by d.siren
  ),
  joined as (
    select
      d.siren, d.initial_score, r.reached_qualified, r.reached_contacted,
      r.reached_interested, r.reached_trial, r.reached_converted,
      coalesce(z.label, 'Non zoné')      as zone_label,
      coalesce(s.label, 'Non catégorisé') as sector_label,
      p.source,
      case
        when d.initial_score >= 70 then 'forte'
        when d.initial_score >= 40 then 'moyenne'
        else 'basse'
      end as score_tier,
      case
        when p.created_on is null then 'inconnue'
        when p.created_on >= (d.detected_at::date - interval '6 months')  then 'moins_6_mois'
        when p.created_on >= (d.detected_at::date - interval '12 months') then 'moins_12_mois'
        when p.created_on >= (d.detected_at::date - interval '24 months') then 'moins_24_mois'
        else 'plus_24_mois'
      end as company_age_bucket
    from detected d
    join reached r on r.siren = d.siren
    left join public.prospects p on p.siren = d.siren
    left join public.prospecting_zones z on z.id = p.zone_id
    left join public.prospecting_sectors s on s.id = p.sector_id
  ),
  by_zone as (
    select jsonb_agg(jsonb_build_object(
             'label', zone_label, 'detected', cnt, 'converted', conv,
             'conversion_rate', case when cnt > 0 then round(conv::numeric / cnt, 4) else 0 end
           ) order by cnt desc) as data
    from (
      select zone_label, count(*) as cnt, count(*) filter (where reached_converted) as conv
      from joined group by zone_label
    ) s
  ),
  by_sector as (
    select jsonb_agg(jsonb_build_object(
             'label', sector_label, 'detected', cnt, 'converted', conv,
             'conversion_rate', case when cnt > 0 then round(conv::numeric / cnt, 4) else 0 end
           ) order by cnt desc) as data
    from (
      select sector_label, count(*) as cnt, count(*) filter (where reached_converted) as conv
      from joined group by sector_label
    ) s
  ),
  by_score_tier as (
    select jsonb_agg(jsonb_build_object(
             'tier', score_tier, 'detected', cnt, 'converted', conv,
             'conversion_rate', case when cnt > 0 then round(conv::numeric / cnt, 4) else 0 end
           ) order by array_position(array['forte','moyenne','basse'], score_tier)) as data
    from (
      select score_tier, count(*) as cnt, count(*) filter (where reached_converted) as conv
      from joined group by score_tier
    ) s
  ),
  by_company_age as (
    select jsonb_agg(jsonb_build_object(
             'bucket', company_age_bucket, 'detected', cnt, 'converted', conv,
             'conversion_rate', case when cnt > 0 then round(conv::numeric / cnt, 4) else 0 end
           ) order by array_position(
             array['moins_6_mois','moins_12_mois','moins_24_mois','plus_24_mois','inconnue'], company_age_bucket
           )) as data
    from (
      select company_age_bucket, count(*) as cnt, count(*) filter (where reached_converted) as conv
      from joined group by company_age_bucket
    ) s
  ),
  by_source as (
    select jsonb_agg(jsonb_build_object(
             'source', source, 'detected', cnt, 'converted', conv,
             'conversion_rate', case when cnt > 0 then round(conv::numeric / cnt, 4) else 0 end
           ) order by cnt desc) as data
    from (
      select coalesce(source, 'inconnue') as source, count(*) as cnt, count(*) filter (where reached_converted) as conv
      from joined group by source
    ) s
  ),
  totals as (
    select
      count(*) as detected,
      count(*) filter (where reached_qualified) as qualified,
      count(*) filter (where reached_contacted) as contacted,
      count(*) filter (where reached_interested) as interested,
      count(*) filter (where reached_trial) as trial,
      count(*) filter (where reached_converted) as converted
    from joined
  )
  select jsonb_build_object(
    'funnel', jsonb_build_object(
      'detected', t.detected, 'qualified', t.qualified, 'contacted', t.contacted,
      'interested', t.interested, 'trial', t.trial, 'converted', t.converted
    ),
    'rates', jsonb_build_object(
      'qualification', case when t.detected > 0 then round(t.qualified::numeric / t.detected, 4) else 0 end,
      'contact',       case when t.detected > 0 then round(t.contacted::numeric / t.detected, 4) else 0 end,
      'interest',      case when t.detected > 0 then round(t.interested::numeric / t.detected, 4) else 0 end,
      'trial',         case when t.detected > 0 then round(t.trial::numeric / t.detected, 4) else 0 end,
      'conversion',    case when t.detected > 0 then round(t.converted::numeric / t.detected, 4) else 0 end
    ),
    'by_zone', coalesce((select data from by_zone), '[]'::jsonb),
    'by_sector', coalesce((select data from by_sector), '[]'::jsonb),
    'by_score_tier', coalesce((select data from by_score_tier), '[]'::jsonb),
    'by_company_age', coalesce((select data from by_company_age), '[]'::jsonb),
    'by_source', coalesce((select data from by_source), '[]'::jsonb)
  ) into v_result
  from totals t;

  return v_result;
end;
$$;

revoke all on function public.prospecting_analytics(date, date) from public, anon;
grant execute on function public.prospecting_analytics(date, date) to authenticated;

comment on function public.prospecting_analytics is
  'Analytics du funnel de prospection (Phase 12, §31) : détecté → qualifié → contacté → intéressé → essai → '
  'converti (« réponses » du cahier des charges omis, aucun événement distinct ne l''enregistre — jamais '
  'inventé). Cohorte par date de DÉTECTION. Refuse quiconque n''a pas prospecting.view.';

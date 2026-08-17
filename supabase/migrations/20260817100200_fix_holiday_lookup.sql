-- =============================================================================
-- Correctif : les jours fériés n'étaient pas reconnus
-- =============================================================================
--
-- CE QUI N'ALLAIT PAS
--
-- `app.leave_day_breakdown` construisait un index des fériés dont les clés sont
-- des dates (`'2026-05-01'`), puis parcourait la période avec :
--
--     generate_series(p_start, p_end, interval '1 day')
--
-- Cette forme renvoie des TIMESTAMPS, pas des dates. `d::text` valait donc
-- `'2026-05-01 00:00:00'`, qui ne correspond à aucune clé. Le test
-- `v_holidays ? d::text` était toujours faux.
--
-- Mesuré juste après l'application de `20260817100100` :
--
--     semaine du 1er mai 2026 (lun 27/04 → ven 01/05) → 5 jours     au lieu de 4
--     22 mai en Martinique (abolition)                → 1 jour      au lieu de 0
--
-- Les week-ends, eux, étaient correctement exclus : `extract(isodow …)` accepte
-- un timestamp. C'est ce qui rendait le défaut discret — le décompte paraissait
-- juste sur la plupart des périodes, et ne se trompait que sur celles qui
-- contiennent un férié. Précisément celles qu'on vérifie le moins.
--
-- LA CORRECTION
--
-- Le parcours produit désormais des DATES, converties une seule fois. Ni la
-- signature ni le comportement documenté ne changent.
-- =============================================================================

create or replace function app.leave_day_breakdown(
  p_start          date,
  p_end            date,
  p_territory      text default 'metropole',
  p_half_day_start boolean default false,
  p_half_day_end   boolean default false
)
returns table (day date, counted boolean, value numeric, reason text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_holidays jsonb;
begin
  if p_end < p_start then
    raise exception 'La date de fin précède la date de début.' using errcode = 'check_violation';
  end if;

  select jsonb_object_agg(h.holiday_date::text, h.holiday_name)
  into v_holidays
  from generate_series(
         extract(year from p_start)::integer,
         extract(year from p_end)::integer
       ) as y(year)
  cross join lateral app.public_holidays(y.year, p_territory) h;

  return query
  with jours as (
    -- La conversion en `date` se fait ICI, une fois. C'est l'omission de ce
    -- `::date` qui rendait tout férié invisible.
    select d::date as jour
    from generate_series(p_start, p_end, interval '1 day') as d
  )
  select
    j.jour,
    case
      when extract(isodow from j.jour) >= 6      then false
      when v_holidays ? j.jour::text             then false
      else true
    end,
    case
      when extract(isodow from j.jour) >= 6      then 0::numeric
      when v_holidays ? j.jour::text             then 0::numeric
      -- Une demi-journée ne s'applique qu'aux bornes, et seulement si la borne
      -- est elle-même un jour décompté.
      when (j.jour = p_start and p_half_day_start)
        or (j.jour = p_end and p_half_day_end)   then 0.5::numeric
      else 1::numeric
    end,
    case
      when extract(isodow from j.jour) = 6       then 'Samedi'
      when extract(isodow from j.jour) = 7       then 'Dimanche'
      when v_holidays ? j.jour::text             then coalesce(v_holidays ->> j.jour::text, 'Jour férié')
      when (j.jour = p_start and p_half_day_start)
        or (j.jour = p_end and p_half_day_end)   then 'Demi-journée'
      else 'Jour ouvré'
    end
  from jours j;
end;
$$;

grant execute on function app.leave_day_breakdown(date, date, text, boolean, boolean) to authenticated;

-- Reprise, à nouveau : les demandes rattrapées par `20260817100100` l'ont été
-- avec la fonction fautive.
alter table public.leave_requests disable trigger leave_requests_decision;

update public.leave_requests lr
set days_count = app.compute_leave_days(
      lr.start_date,
      lr.end_date,
      coalesce(o.holiday_territory, 'metropole'),
      lr.half_day_start,
      lr.half_day_end
    )
from public.organizations o
where o.id = lr.organization_id
  and app.compute_leave_days(
        lr.start_date, lr.end_date,
        coalesce(o.holiday_territory, 'metropole'),
        lr.half_day_start, lr.half_day_end
      ) > 0;

alter table public.leave_requests enable trigger leave_requests_decision;

-- =============================================================================
-- Moteur de décompte des congés
-- =============================================================================
--
-- LE DÉFAUT
--
-- `days_count` était calculé par le navigateur, ainsi :
--
--     Math.ceil((fin - début) / 86400000) + 1
--
-- Une absence du vendredi au lundi comptait QUATRE jours. Le 1er mai tombant
-- dans la période était décompté comme un jour de congé. Et le serveur acceptait
-- le nombre reçu : sa seule contrainte était `days_count > 0 and <= 366`.
--
-- Un solde de congés payés est une créance du salarié sur son employeur. Le
-- laisser calculer par du code qui s'exécute dans le navigateur de l'intéressé
-- n'est pas une question de confiance : c'est une question de source de vérité.
-- Un même formulaire, deux versions du bundle, deux totaux.
--
-- CE QUE CETTE MIGRATION POSE
--
--   app.easter_sunday(year)              Pâques, dont dérivent trois fériés
--   app.public_holidays(year, territory) le socle national + les fériés locaux
--   app.leave_day_breakdown(...)         le DÉTAIL, jour par jour
--   app.compute_leave_days(...)          la somme du détail
--
-- `leave_requests.days_count` devient calculé par trigger. Le client ne déclare
-- plus la durée, il la demande — même principe que `reviewed_by`, que le serveur
-- écrase déjà.
--
-- POURQUOI UN DÉTAIL ET PAS SEULEMENT UN TOTAL
--
-- Un salarié à qui l'on décompte cinq jours doit pouvoir savoir lesquels. Un
-- gestionnaire qui conteste doit voir où le calcul diverge du sien. Rendre le
-- détail coûte une fonction de plus et supprime une classe entière de litiges
-- qu'un total seul rend indémêlables.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Pâques
-- -----------------------------------------------------------------------------
--
-- Algorithme de Meeus/Jones/Butcher, calendrier grégorien, valable de 1583 à
-- 4099. Reproduit tel quel : ce n'est pas le genre de calcul qu'on adapte pour
-- « simplifier ». Il porte le lundi de Pâques, l'Ascension et la Pentecôte —
-- trois des onze fériés français.
--
-- `immutable` : pour une année donnée, le résultat ne change jamais. PostgreSQL
-- peut donc l'appeler une seule fois par requête et l'indexer si besoin.
create or replace function app.easter_sunday(p_year integer)
returns date
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  a integer := p_year % 19;
  b integer := p_year / 100;
  c integer := p_year % 100;
  d integer := b / 4;
  e integer := b % 4;
  f integer := (b + 8) / 25;
  g integer := (b - f + 1) / 3;
  h integer := (19 * a + b - d - g + 15) % 30;
  i integer := c / 4;
  k integer := c % 4;
  l integer := (32 + 2 * e + 2 * i - h - k) % 7;
  m integer := (a + 11 * h + 22 * l) / 451;
  v_month integer := (h + l - 7 * m + 114) / 31;
  v_day integer := ((h + l - 7 * m + 114) % 31) + 1;
begin
  return make_date(p_year, v_month, v_day);
end;
$$;

-- -----------------------------------------------------------------------------
-- Jours fériés
-- -----------------------------------------------------------------------------
--
-- Les dates d'abolition de l'esclavage sont FIXES et diffèrent d'un territoire à
-- l'autre : elles commémorent la promulgation LOCALE du décret de 1848, qui n'a
-- pas eu lieu le même jour partout. Les aligner serait une erreur historique
-- autant qu'une erreur de paie.
--
-- Le miroir TypeScript `src/features/planning/public-holidays.ts` doit rester
-- identique ; `public-holidays.test.ts` compare les deux.
create or replace function app.public_holidays(p_year integer, p_territory text default 'metropole')
returns table (holiday_date date, holiday_name text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_easter date := app.easter_sunday(p_year);
begin
  -- Socle national — onze jours, partout.
  return query values
    (make_date(p_year, 1, 1),   'Jour de l''An'),
    (v_easter + 1,              'Lundi de Pâques'),
    (make_date(p_year, 5, 1),   'Fête du Travail'),
    (make_date(p_year, 5, 8),   'Victoire 1945'),
    (v_easter + 39,             'Ascension'),
    (v_easter + 50,             'Lundi de Pentecôte'),
    (make_date(p_year, 7, 14),  'Fête Nationale'),
    (make_date(p_year, 8, 15),  'Assomption'),
    (make_date(p_year, 11, 1),  'Toussaint'),
    (make_date(p_year, 11, 11), 'Armistice 1918'),
    (make_date(p_year, 12, 25), 'Noël');

  if p_territory = 'martinique' then
    return query values
      (v_easter - 2,             'Vendredi Saint'),
      (make_date(p_year, 5, 22), 'Abolition de l''esclavage'),
      (make_date(p_year, 7, 21), 'Fête Victor Schœlcher');

  elsif p_territory = 'guadeloupe' then
    return query values
      (v_easter - 2,             'Vendredi Saint'),
      (make_date(p_year, 5, 27), 'Abolition de l''esclavage'),
      (make_date(p_year, 7, 21), 'Fête Victor Schœlcher');

  elsif p_territory = 'guyane' then
    return query values (make_date(p_year, 6, 10), 'Abolition de l''esclavage');

  elsif p_territory = 'reunion' then
    return query values (make_date(p_year, 12, 20), 'Abolition de l''esclavage (Fête Caf'')');

  elsif p_territory = 'mayotte' then
    return query values (make_date(p_year, 4, 27), 'Abolition de l''esclavage');

  elsif p_territory = 'alsace_moselle' then
    return query values
      (v_easter - 2,              'Vendredi Saint'),
      (make_date(p_year, 12, 26), 'Saint-Étienne');
  end if;
end;
$$;

grant execute on function app.easter_sunday(integer) to authenticated;
grant execute on function app.public_holidays(integer, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Le territoire est une donnée d'ENTREPRISE
-- -----------------------------------------------------------------------------
--
-- Il vivait dans une préférence `localStorage`, par navigateur. Un calcul de
-- paie ne peut pas dépendre de l'appareil depuis lequel on consulte : deux
-- gestionnaires de la même société obtiendraient deux décomptes.
alter table public.organizations
  add column if not exists holiday_territory text not null default 'metropole';

alter table public.organizations
  drop constraint if exists organizations_holiday_territory_known;

alter table public.organizations
  add constraint organizations_holiday_territory_known check (
    holiday_territory in (
      'metropole', 'guadeloupe', 'martinique', 'guyane',
      'reunion', 'mayotte', 'alsace_moselle'
    )
  );

-- -----------------------------------------------------------------------------
-- Demi-journées
-- -----------------------------------------------------------------------------
--
-- Deux booléens plutôt qu'un champ « durée » : une absence commence l'après-midi
-- OU se termine le matin, et les deux peuvent valoir en même temps sur une
-- absence d'une seule journée — auquel cas elle vaut une demi-journée, pas zéro.
alter table public.leave_requests
  add column if not exists half_day_start boolean not null default false;

alter table public.leave_requests
  add column if not exists half_day_end boolean not null default false;

-- -----------------------------------------------------------------------------
-- Le détail, jour par jour
-- -----------------------------------------------------------------------------
--
-- La fonction PARCOURT la période. Elle ne soustrait pas deux dates.
--
-- Convention retenue : jours OUVRÉS (lundi–vendredi). Le samedi n'est pas
-- décompté. C'est le décompte le plus répandu dans les conventions du bâtiment
-- et des télécoms, et c'est celui que l'interface annonçait implicitement en
-- parlant de « jours ». Passer aux jours OUVRABLES (lundi–samedi) se ferait ici,
-- à un seul endroit, et le détail rendrait le changement visible.
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

  -- Les fériés de toutes les années couvertes : une absence peut chevaucher le
  -- 31 décembre.
  select jsonb_object_agg(h.holiday_date::text, h.holiday_name)
  into v_holidays
  from generate_series(
         extract(year from p_start)::integer,
         extract(year from p_end)::integer
       ) as y(year)
  cross join lateral app.public_holidays(y.year, p_territory) h;

  return query
  select
    d::date,
    case
      when extract(isodow from d) >= 6 then false
      when v_holidays ? d::text        then false
      else true
    end as counted,
    case
      when extract(isodow from d) >= 6 then 0::numeric
      when v_holidays ? d::text        then 0::numeric
      -- Une demi-journée ne s'applique qu'aux bornes, et seulement si la borne
      -- est elle-même un jour décompté.
      when (d::date = p_start and p_half_day_start)
        or (d::date = p_end and p_half_day_end)   then 0.5::numeric
      else 1::numeric
    end as value,
    case
      when extract(isodow from d) = 6 then 'Samedi'
      when extract(isodow from d) = 7 then 'Dimanche'
      when v_holidays ? d::text       then coalesce(v_holidays ->> d::text, 'Jour férié')
      when (d::date = p_start and p_half_day_start)
        or (d::date = p_end and p_half_day_end)  then 'Demi-journée'
      else 'Jour ouvré'
    end as reason
  from generate_series(p_start, p_end, interval '1 day') as d;
end;
$$;

grant execute on function app.leave_day_breakdown(date, date, text, boolean, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Le total
-- -----------------------------------------------------------------------------
create or replace function app.compute_leave_days(
  p_start          date,
  p_end            date,
  p_territory      text default 'metropole',
  p_half_day_start boolean default false,
  p_half_day_end   boolean default false
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(b.value), 0)
  from app.leave_day_breakdown(p_start, p_end, p_territory, p_half_day_start, p_half_day_end) b;
$$;

grant execute on function app.compute_leave_days(date, date, text, boolean, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Le serveur calcule, le client demande
-- -----------------------------------------------------------------------------
--
-- Comme `reviewed_by` et `reviewed_at`, `days_count` cesse d'être une donnée que
-- le client fournit. Ce qu'il envoie est écrasé — le champ reste dans le type
-- `Insert` par commodité, mais sa valeur n'a aucun effet.
create or replace function app.set_leave_days_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_territory text;
begin
  select o.holiday_territory into v_territory
  from public.organizations o
  where o.id = new.organization_id;

  new.days_count := app.compute_leave_days(
    new.start_date,
    new.end_date,
    coalesce(v_territory, 'metropole'),
    new.half_day_start,
    new.half_day_end
  );

  -- Une absence entièrement composée de week-ends et de fériés ne consomme rien.
  -- La refuser vaut mieux que d'enregistrer une demande à zéro jour, que
  -- personne ne saurait interpréter — et la contrainte `days_count > 0` la
  -- rejetterait de toute façon, avec un message incompréhensible.
  if new.days_count <= 0 then
    raise exception
      'Cette période ne comprend aucun jour ouvré : elle ne consomme aucun congé.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- S'exécute AVANT `leave_requests_decision`, qui fige `days_count` sur une
-- demande déjà traitée. L'ordre alphabétique des triggers `before` de PostgreSQL
-- place `leave_requests_days_count` avant `leave_requests_decision` : voulu.
drop trigger if exists leave_requests_days_count on public.leave_requests;
create trigger leave_requests_days_count
  before insert or update of start_date, end_date, half_day_start, half_day_end
  on public.leave_requests
  for each row execute function app.set_leave_days_count();

-- -----------------------------------------------------------------------------
-- Reprise des demandes existantes
-- -----------------------------------------------------------------------------
--
-- Les demandes déjà saisies portent un décompte calculé par l'ancienne formule.
-- Les laisser en l'état ferait coexister deux méthodes dans la même table, et
-- les soldes en dépendent.
--
-- `leave_requests_decision` doit être neutralisé le temps de cette écriture, et
-- c'est rassurant qu'il faille le faire : il a REFUSÉ le premier essai, au motif
-- que « seul l'auteur peut corriger sa demande ». Une migration s'exécute sans
-- session, donc sans auteur. La règle est bonne ; c'est une reprise technique
-- qui doit s'en extraire, sur une seule instruction, explicitement.
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

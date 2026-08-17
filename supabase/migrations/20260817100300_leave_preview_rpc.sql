-- =============================================================================
-- Aperçu du décompte, côté client
-- =============================================================================
--
-- POURQUOI UNE RPC PLUTÔT QU'UN CALCUL EN TYPESCRIPT
--
-- Le formulaire doit annoncer « 2 jours » avant l'envoi, sans quoi l'utilisateur
-- découvre le décompte après coup. La tentation serait de refaire le calcul en
-- TypeScript — c'est ce que faisait la version précédente.
--
-- Deux implémentations du même barème finissent par diverger, et celle qui
-- diverge en silence est celle qu'on affiche. Un salarié verrait « 3 jours »,
-- son solde en perdrait 2, et rien ne dirait laquelle des deux a tort.
--
-- Cette fonction expose donc le MÊME moteur que le trigger. L'aperçu et
-- l'enregistrement ne peuvent pas se contredire : ils appellent le même code.
--
-- `app.leave_day_breakdown` vit dans le schéma privé `app`, que PostgREST
-- n'expose pas. Ce mince passe-plat dans `public` est le seul moyen d'y donner
-- accès sans ouvrir tout le schéma.
--
-- Aucune donnée d'entreprise ne transite : la fonction ne reçoit que des dates
-- et un territoire, et ne lit aucune table. Elle est sûre pour tout membre
-- authentifié — refuser l'aperçu à qui a le droit de poser un congé n'aurait
-- aucun sens.
-- =============================================================================

create or replace function public.preview_leave_days(
  p_start          date,
  p_end            date,
  p_territory      text default 'metropole',
  p_half_day_start boolean default false,
  p_half_day_end   boolean default false
)
returns table (day date, counted boolean, value numeric, reason text)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.day, b.counted, b.value, b.reason
  from app.leave_day_breakdown(p_start, p_end, p_territory, p_half_day_start, p_half_day_end) b;
$$;

revoke all on function public.preview_leave_days(date, date, text, boolean, boolean)
  from public, anon;

grant execute on function public.preview_leave_days(date, date, text, boolean, boolean)
  to authenticated;

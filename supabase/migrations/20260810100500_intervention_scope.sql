-- =============================================================================
-- Périmètre d'écriture sur une intervention
-- =============================================================================
--
-- LE CONSTAT, MESURÉ
--
-- `interventions_update_scoped` ouvre l'écriture à l'intervenant — il en a
-- besoin pour passer son intervention en `completed`. Mais son `WITH CHECK` ne
-- vérifie que l'appartenance à l'organisation, et une policy ne sait pas
-- raisonner colonne par colonne.
--
-- Sondage sur la base :
--   • réattribuer l'intervention à un collègue      → refusé (heureusement)
--   • la rattacher à une AUTRE mission              → RÉUSSI
--   • antidater le début de six heures              → RÉUSSI
--
-- Le second point est le plus lourd. Un relevé d'heures sert à facturer un
-- client, à payer un salarié et à prouver qu'on est intervenu. S'il est
-- modifiable par celui qu'il engage, il ne prouve rien.
--
-- LE CORRECTIF
--
-- Le serveur horodate. L'intervenant déclare des événements — « je démarre »,
-- « j'ai terminé » — et n'écrit jamais l'heure elle-même. Il ne peut pas
-- davantage déplacer son intervention vers une autre mission : cela
-- réattribuerait un travail effectué.
--
-- Ce que l'intervenant conserve : le statut, ses notes, et la géolocalisation
-- du départ, qui n'a de sens qu'au moment où il commence.
-- =============================================================================

create or replace function app.enforce_intervention_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Écriture par un rôle privilégié (migrations, webhook) : pas d'identité,
  -- pas de restriction.
  if (select auth.uid()) is null then
    if tg_op = 'INSERT' then
      return new;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- L'heure de début est celle du serveur, pas celle annoncée.
    new.start_time := now();
    new.end_time := null;
    return new;
  end if;

  -- Une intervention ne change jamais de mission : cela réattribuerait un
  -- travail déjà effectué à un autre chantier, et fausserait aussi bien la
  -- facturation que l'historique du client.
  if new.mission_id is distinct from old.mission_id then
    raise exception 'Une intervention ne peut pas être rattachée à une autre mission.'
      using errcode = 'check_violation';
  end if;

  -- Les horodatages ne sont jamais dictés par le client. `end_time` est posée
  -- au moment où l'intervention passe en `completed`, et une seule fois.
  new.start_time := old.start_time;

  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.end_time := now();
  else
    new.end_time := old.end_time;
  end if;

  -- Le responsable qui supervise (`intervention.view_all`) garde la main sur le
  -- reste ; l'intervenant, lui, ne réattribue pas son intervention.
  if not app.has_org_permission(new.organization_id, 'intervention.view_all')
     and new.technician_id is distinct from old.technician_id then
    raise exception 'Vous ne pouvez pas réattribuer votre intervention.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists interventions_enforce_scope on public.interventions;
create trigger interventions_enforce_scope
  before insert or update on public.interventions
  for each row execute function app.enforce_intervention_scope();

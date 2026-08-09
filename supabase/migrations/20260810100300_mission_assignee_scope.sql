-- =============================================================================
-- Périmètre d'écriture de l'intervenant affecté
-- =============================================================================
--
-- LE CONSTAT
--
-- `missions_update_permitted` autorise la mise à jour à qui détient
-- `mission.update` OU se trouve être l'intervenant affecté. Cette seconde
-- branche est indispensable : sans elle, le technicien ne pourrait pas faire
-- avancer sa mission dans la machine à états.
--
-- Mais une policy RLS raisonne par LIGNE, jamais par COLONNE. Accorder
-- l'écriture pour le statut, c'est l'accorder pour tout le reste. Mesuré sur la
-- base : un technicien affecté a réécrit l'intitulé de sa mission et l'a
-- rattachée à un autre client.
--
-- Ce n'est pas une brèche multi-tenant — tout reste dans l'organisation — mais
-- c'est une atteinte à l'intégrité. Celui qui exécute redéfinirait ce qu'il
-- était censé faire, et à qui l'intervention sera facturée. C'est le même
-- principe que la séparation des pouvoirs sur les comptes rendus : l'exécutant
-- rend compte, il n'arbitre pas.
--
-- LE CORRECTIF
--
-- Un trigger, seul capable de comparer colonne par colonne l'ancienne et la
-- nouvelle ligne. Il ne s'applique QU'À l'intervenant dépourvu de
-- `mission.update` : un responsable garde la main sur tout.
--
-- Nommé pour passer AVANT `missions_enforce_transition` dans l'ordre
-- alphabétique des triggers de même moment. À ce stade, `actual_start` et
-- `actual_end` n'ont pas encore été horodatés par la machine à états : la
-- comparaison porte donc bien sur ce que le client a envoyé.
-- =============================================================================

create or replace function app.enforce_mission_assignee_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Écriture par un rôle privilégié (service_role, migrations) : pas d'identité,
  -- pas de restriction.
  if (select auth.uid()) is null then
    return new;
  end if;

  -- Qui pilote les missions modifie tout ce qu'il veut.
  if app.has_org_permission(new.organization_id, 'mission.update') then
    return new;
  end if;

  -- À ce point, l'écriture ne peut venir que de l'intervenant affecté : la
  -- policy n'ouvre pas d'autre voie. On borne donc ce qu'il peut toucher.
  --
  -- Autorisé : le statut — dont la machine à états contrôle déjà chaque
  -- transition — et les notes de terrain, qui sont précisément sa contribution.
  --
  -- Refusé : tout le reste. L'intitulé, le client, le site, la planification,
  -- l'affectation et la priorité définissent le CADRE de l'intervention, et ce
  -- cadre est posé par celui qui commande le travail.
  if new.title            is distinct from old.title
     or new.description   is distinct from old.description
     or new.category_id   is distinct from old.category_id
     or new.customer_id   is distinct from old.customer_id
     or new.site_id       is distinct from old.site_id
     or new.priority      is distinct from old.priority
     or new.assigned_team_id is distinct from old.assigned_team_id
     or new.assigned_user_id is distinct from old.assigned_user_id
     or new.scheduled_start  is distinct from old.scheduled_start
     or new.scheduled_end    is distinct from old.scheduled_end
     or new.reference     is distinct from old.reference
     or new.customer_name is distinct from old.customer_name
     or new.location_label is distinct from old.location_label
  then
    raise exception
      'En tant qu''intervenant, vous pouvez faire avancer la mission et la commenter, mais pas en modifier la définition.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists missions_assignee_scope on public.missions;
create trigger missions_assignee_scope
  before update on public.missions
  for each row execute function app.enforce_mission_assignee_scope();

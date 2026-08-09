-- =============================================================================
-- Temps net travaillé, accessible depuis le client
-- =============================================================================
--
-- `app.intervention_worked_seconds` vit dans le schéma privé `app`, que
-- PostgREST n'expose pas — c'est précisément ce qui met les fonctions
-- d'autorisation hors de portée du navigateur.
--
-- Le temps net, lui, doit être lisible par l'application : c'est ce qu'affiche
-- la fiche d'intervention. Un mince passe-plat en `public` l'expose sans
-- déplacer la logique — le calcul reste unique, et c'est le même que celui qui
-- servira à facturer. Deux sommes écrites séparément finiraient par diverger,
-- et l'écart ne se verrait qu'au moment d'établir une facture.
--
-- Aucun droit supplémentaire n'est ouvert : la fonction ne renvoie qu'un entier,
-- et l'intervention elle-même reste protégée par `interventions_select_scoped`.
-- Connaître la durée d'une intervention dont on ignore tout le reste n'apprend
-- rien — et il faut déjà en connaître l'identifiant, qui est un UUID.
-- =============================================================================

create or replace function public.intervention_worked_seconds(p_intervention_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select app.intervention_worked_seconds(p_intervention_id);
$$;

revoke all on function public.intervention_worked_seconds(uuid) from public, anon;
grant execute on function public.intervention_worked_seconds(uuid) to authenticated;

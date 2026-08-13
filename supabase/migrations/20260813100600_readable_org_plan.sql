-- =============================================================================
-- Tout membre doit connaître la formule de son entreprise
-- =============================================================================
--
-- LE CONSTAT
--
-- Un technicien ouvre « Missions » et lit : « Le module Missions nécessite la
-- formule Entreprise ». Son entreprise EST abonnée, et le serveur le laisserait
-- parfaitement lire ces missions.
--
-- POURQUOI
--
-- `RequirePlan` déduit la formule en lisant la table `subscriptions`. Or
-- `subscriptions_select_own` la réserve à qui détient `billing.view` — les
-- propriétaires et les administrateurs. Pour tous les autres rôles, la requête
-- ne renvoie aucune ligne ; `resolvePlanCode` retombe alors sur `free`, et
-- l'interface conclut que l'entreprise n'a pas souscrit.
--
-- Cette restriction est juste : le montant, l'échéance et le mode de paiement
-- ne regardent pas un technicien. Mais le SIMPLE FAIT d'être abonné, si — c'est
-- ce qui détermine les écrans auxquels il accède, et le serveur s'en sert déjà
-- pour lui : `app.can_use_pro_module` appelle `app.org_plan_code`, en
-- `security definer`, sans jamais consulter le rôle de l'appelant.
--
-- Le frontend était donc plus restrictif que la base — et il bloquait
-- l'utilisateur avant même la requête que la base aurait acceptée.
--
-- LA CORRECTION
--
-- Une fonction qui expose le CODE de la formule, et rien d'autre. Ni prix, ni
-- statut, ni date d'échéance, ni identifiant chez le prestataire de paiement :
-- une chaîne de caractères, réservée aux membres de l'organisation concernée.
--
-- Elle réutilise `app.org_plan_code`, donc exactement le même calcul que celui
-- appliqué par les policies — expiration comprise. Lire `organizations.plan_code`
-- aurait été plus simple, mais cette colonne est un cache alimenté par trigger
-- depuis `subscriptions` : elle ne bouge pas quand une période d'essai s'achève
-- par le seul passage du temps, et afficherait un abonnement que le serveur ne
-- reconnaît plus.
-- =============================================================================

create or replace function public.organization_plan_code(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    -- Le contrôle d'appartenance est ici la seule barrière : sans lui, cette
    -- fonction dirait à n'importe qui la formule de n'importe quelle entreprise.
    when app.is_org_member(p_organization_id) then app.org_plan_code(p_organization_id)
    else null
  end;
$$;

revoke all on function public.organization_plan_code(uuid) from public, anon;
grant execute on function public.organization_plan_code(uuid) to authenticated;

comment on function public.organization_plan_code(uuid) is
  'Code de la formule d''une organisation dont on est membre. N''expose que le code — le détail de l''abonnement reste soumis à `billing.view`.';

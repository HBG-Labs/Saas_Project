-- =============================================================================
-- Prolongation des essais en cours, avant la mise en production
-- =============================================================================
--
-- LE CONSTAT
--
-- `app.start_organization_trial()` donne quatorze jours à toute organisation
-- nouvellement créée, et `app.org_plan_code()` écarte les abonnements dont
-- `current_period_end` est dépassé. C'est le comportement voulu pour un essai
-- commercial, et il ne change pas ici.
--
-- Mais les organisations existantes ont été créées pendant la mise au point du
-- produit, pas par un client. Leur essai expire dans les jours qui viennent, et
-- le jour où il expire tous les modules professionnels se vident d'un coup :
-- missions, clients, équipes, interventions, audit. Aucune erreur, aucun
-- message — les policies renvoient simplement des ensembles vides.
--
-- Mettre en ligne quelques jours avant cette échéance reviendrait à programmer
-- une panne.
--
-- CE QUE FAIT CETTE MIGRATION
--
-- Elle porte à douze mois les essais ACTUELLEMENT en cours. Rien d'autre :
--
--   • le trigger conserve ses quatorze jours pour toute NOUVELLE organisation,
--     parce que c'est la bonne durée pour un essai commercial ;
--   • aucun abonnement `active` n'est touché — s'il en existait un, posé par un
--     prestataire de paiement, le modifier ici l'écraserait ;
--   • aucune colonne, aucune table, aucune policy ne change.
--
-- CE QU'ELLE NE RÉSOUT PAS
--
-- Elle repousse l'échéance, elle ne la supprime pas. C'est délibéré : un essai
-- qui n'expire jamais n'est pas un essai, et le jour où le paiement sera
-- branché il faudra que le mécanisme d'expiration ait toujours fonctionné. Le
-- bandeau ajouté côté interface (`TrialBanner`) rend désormais cette date
-- visible, ce qui manquait le plus.
-- =============================================================================

update public.subscriptions
set
  trial_ends_at = greatest(coalesce(trial_ends_at, now()), now() + interval '12 months'),
  current_period_end = greatest(coalesce(current_period_end, now()), now() + interval '12 months'),
  updated_at = now()
where status = 'trialing';

-- Trace de la décision dans le journal, au même titre qu'une action humaine.
--
-- `user_id` reste NULL : cette écriture n'a pas d'acteur, elle vient d'une
-- migration. `actor_label` porte alors l'information à sa place — c'est
-- exactement le rôle de cette colonne, prévue pour survivre à la disparition
-- d'un compte.
--
-- Le trigger `audit_logs_immutable` n'interdit que UPDATE et DELETE : une
-- insertion reste possible, sans quoi le journal ne pourrait pas s'écrire.
insert into public.audit_logs (
  organization_id, user_id, actor_label, action, entity_type, entity_id, metadata
)
select
  s.organization_id,
  null,
  'Migration 20260814100000',
  'subscription.trial_extended',
  'subscription',
  s.id,
  jsonb_build_object(
    'reason', 'Mise en production : prolongation des essais de mise au point',
    'new_period_end', s.current_period_end
  )
from public.subscriptions s
where s.status = 'trialing'
  and s.organization_id is not null;

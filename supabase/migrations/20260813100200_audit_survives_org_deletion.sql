-- =============================================================================
-- Le journal d'audit survit à la suppression de l'organisation
-- =============================================================================
--
-- LE CONSTAT
--
--   DELETE FROM organizations WHERE id = ...
--   → 42501 « Le journal d'audit est immuable : ni modification ni suppression. »
--
-- Deux règles du schéma se contredisaient :
--
--   • `audit_logs.organization_id` était déclaré `on delete cascade` : supprimer
--     une organisation devait effacer son journal ;
--   • `audit_logs_immutable` interdit toute suppression dans cette table.
--
-- Résultat : la suppression échouait toujours. La policy
-- `organizations_delete_owner` accordait donc un droit que rien ne permettait
-- d'exercer — le second obstacle après `protect_last_owner`, corrigé juste
-- avant.
--
-- CE QUE LA CASCADE DISAIT DE TROP
--
-- Le fichier d'origine défend lui-même le principe inverse, trois lignes plus
-- bas, à propos de `user_id` : « la suppression d'un compte ne doit pas effacer
-- la trace de ses actions. C'est précisément l'inverse de ce qu'on veut d'un
-- journal d'audit. » Le raisonnement vaut mot pour mot pour l'organisation. Un
-- journal qu'on efface en supprimant son sujet ne prouve rien — et c'est
-- justement au moment d'une fermeture de compte qu'on peut avoir à le produire.
--
-- LA CORRECTION
--
-- `on delete set null`. Les lignes subsistent, détachées. Elles deviennent
-- invisibles depuis l'application — `audit_logs_select_permitted` filtre par
-- permission sur une organisation qui n'existe plus — ce qui est le bon
-- comportement : plus personne n'a de raison légitime d'y accéder par
-- l'interface, mais l'enregistrement demeure pour qui interroge la base
-- directement.
-- =============================================================================

alter table public.audit_logs
  drop constraint if exists audit_logs_organization_id_fkey;

alter table public.audit_logs
  add constraint audit_logs_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) on delete set null;

comment on column public.audit_logs.organization_id is
  'Détaché (NULL) si l''organisation est supprimée : le journal survit à son sujet.';

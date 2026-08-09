-- =============================================================================
-- Aperçu d'une invitation avant acceptation
-- =============================================================================
--
-- LE PROBLÈME
--
-- L'invité peut lire sa propre invitation — `organization_invitations_select`
-- l'autorise sur correspondance de l'adresse e-mail du JWT. Mais il ne peut pas
-- lire l'ORGANISATION : `organizations_select_member` exige d'en être déjà
-- membre, ce qu'il n'est précisément pas encore.
--
-- L'écran d'acceptation afficherait donc « Rejoindre l'organisation
-- a3f8-91c2-… ? ». On ne demande à personne d'accepter un identifiant.
--
-- LA SOLUTION, ET SA LIMITE
--
-- Une fonction `security definer` qui contourne la policy pour renvoyer TROIS
-- champs, et rien d'autre : le nom de l'organisation, le rôle proposé, la date
-- d'expiration. Ni l'identifiant de l'organisation, ni la liste de ses membres,
-- ni l'adresse e-mail invitée.
--
-- Ce qui rend l'exposition acceptable, c'est le jeton : un UUID v4 tiré par
-- `gen_random_uuid()`, soit 122 bits d'entropie. Le connaître n'est pas une
-- coïncidence — c'est qu'on vous l'a transmis. Aucune énumération n'est
-- praticable, et la fonction ne prend pas d'autre critère : impossible de
-- demander « les invitations de telle entreprise ».
--
-- Le contrôle réel reste ailleurs : `accept_organization_invitation` vérifie,
-- lui, que l'adresse du compte connecté correspond à celle de l'invitation.
-- Voir un aperçu n'a jamais valu acceptation.
-- =============================================================================

create or replace function public.get_invitation_preview(p_token uuid)
returns table (
  organization_name text,
  invited_role      public.org_role,
  expires_at        timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.name,
    i.role,
    i.expires_at
  from public.organization_invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token = p_token
    -- Une invitation révoquée ou déjà acceptée ne doit rien révéler : la
    -- fonction renvoie zéro ligne, indistinguable d'un jeton inexistant.
    and i.status = 'pending'
    and i.expires_at > now();
$$;

-- `anon` n'y a pas accès : accepter suppose un compte, et l'aperçu n'est utile
-- qu'à qui s'apprête à accepter. Un visiteur non connecté est de toute façon
-- redirigé vers la connexion avant d'atteindre l'écran.
revoke all on function public.get_invitation_preview(uuid) from public, anon;
grant execute on function public.get_invitation_preview(uuid) to authenticated;

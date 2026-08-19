-- =============================================================================
-- L'aperçu d'invitation annonce l'adresse concernée
-- =============================================================================
--
-- POURQUOI CE QUI ÉTAIT CACHÉ DOIT MAINTENANT ÊTRE MONTRÉ
--
-- L'aperçu taisait l'adresse invitée. C'était cohérent tant que la page se
-- contentait de proposer « Accepter » à quelqu'un de déjà connecté : son compte
-- suffisait à l'identifier.
--
-- La page crée désormais le compte. Elle doit donc dire LEQUEL : demander un
-- mot de passe sans nommer l'adresse à laquelle il se rattache reviendrait à
-- faire signer un formulaire dont on cache un champ. Et sans elle, l'écran ne
-- pouvait qu'avertir vaguement — « utilisez l'adresse à laquelle vous avez reçu
-- cette invitation » — en laissant la personne deviner laquelle, alors que le
-- serveur la connaît.
--
-- CE QUE CELA EXPOSE RÉELLEMENT
--
-- Qui détient le jeton reçoit une adresse e-mail. Or ce jeton a précisément été
-- envoyé à cette adresse : la révéler à qui la possède déjà n'apprend rien à
-- personne. Le seul cas nouveau est le lien transmis à un tiers — mais celui
-- qui transmet le lien transmet aussi, par construction, l'accès complet à
-- l'invitation. L'adresse est le moindre des renseignements qu'il livre.
--
-- Rien d'autre ne change : ni l'identifiant de l'organisation, ni aucun critère
-- de recherche. Et ACCEPTER reste soumis à la correspondance des adresses,
-- vérifiée par `accept_organization_invitation`.
-- =============================================================================

-- La signature change : `create or replace` ne suffit pas pour ajouter une
-- colonne à un `returns table`. On supprime, on recrée, on repose les droits —
-- que le `drop` emporte avec lui.
drop function if exists public.get_invitation_preview(uuid);

create function public.get_invitation_preview(p_token uuid)
returns table (
  organization_name text,
  invited_role      public.org_role,
  invited_email     text,
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
    i.email,
    i.expires_at
  from public.organization_invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token = p_token
    -- Une invitation révoquée ou déjà acceptée ne doit rien révéler : la
    -- fonction renvoie zéro ligne, indistinguable d'un jeton inexistant.
    and i.status = 'pending'
    and i.expires_at > now();
$$;

revoke all on function public.get_invitation_preview(uuid) from public;
grant execute on function public.get_invitation_preview(uuid) to anon, authenticated;

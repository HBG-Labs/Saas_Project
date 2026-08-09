-- =============================================================================
-- Rattrapage des profils et durcissement des fonctions exposées
-- =============================================================================
--
-- Deux constats faits après la première application du schéma sur le projet
-- distant. Aucun des deux n'est un défaut de conception : ce sont les angles
-- morts inévitables d'un socle appliqué à une base qui n'était pas vierge.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Profils manquants
-- -----------------------------------------------------------------------------
--
-- `handle_new_user` ne se déclenche qu'à l'INSERT dans `auth.users`. Tout compte
-- créé AVANT l'application de la migration `profiles` n'a donc pas de ligne
-- correspondante — et rien ne la créera jamais, l'utilisateur ne se réinscrivant
-- pas. L'application afficherait un profil vide sans expliquer pourquoi.
--
-- La règle de nommage reproduit exactement celle du trigger, pour qu'un compte
-- rattrapé soit indiscernable d'un compte créé normalement.
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Utilisateur'
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Fonctions de trigger exposées par PostgREST
-- -----------------------------------------------------------------------------
--
-- Toute fonction du schéma `public` est publiée par PostgREST sous
-- `/rest/v1/rpc/<nom>`. Les fonctions de trigger y figurent aussi, alors
-- qu'elles n'ont aucun sens hors d'un trigger.
--
-- Le risque réel est nul — PostgreSQL refuse d'exécuter une fonction retournant
-- `trigger` ou `event_trigger` par un appel direct. Mais laisser ces points
-- d'entrée ouverts encombre la surface publiée et fait remonter des
-- avertissements qui masqueraient un jour un signalement sérieux. Mieux vaut
-- une liste d'avertissements vide et significative.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- `rls_auto_enable` est un event trigger PRÉEXISTANT sur ce projet, absent des
-- migrations : il active RLS d'office sur toute table nouvellement créée. On le
-- conserve — c'est un filet de sécurité utile — mais on ferme son exposition.
--
-- Traité sous condition d'existence : il n'appartient pas à ce dépôt et peut
-- très bien ne pas exister sur un autre environnement.
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;

-- `accept_organization_invitation` reste délibérément exécutable par
-- `authenticated` : c'est le seul moyen pour un invité — qui n'est pas encore
-- membre, donc sans aucun droit d'écriture sur `organization_members` — de
-- rejoindre une organisation. La fonction vérifie elle-même le jeton, la date
-- d'expiration et la correspondance de l'adresse e-mail.

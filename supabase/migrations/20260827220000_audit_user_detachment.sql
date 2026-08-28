-- =============================================================================
-- Détachement de l'utilisateur supprimé dans le journal d'audit
-- =============================================================================
--
-- Tout comme pour la suppression d'une organisation, la suppression d'un
-- utilisateur (auth.users) déclenche une action référentielle ON DELETE SET NULL
-- sur audit_logs.user_id. Le trigger d'immuabilité doit autoriser ce détachement
-- lorsque l'utilisateur a disparu, tout en garantissant que le reste des données
-- d'audit est rigoureusement intact.
-- =============================================================================

create or replace function app.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     -- Cas 1 : Détachement de l'organisation disparue
     and (
       (
         old.organization_id is not null
         and new.organization_id is null
         and not exists (
           select 1 from public.organizations o where o.id = old.organization_id
         )
         and new.user_id is not distinct from old.user_id
       )
       or
       -- Cas 2 : Détachement de l'utilisateur disparu
       (
         old.user_id is not null
         and new.user_id is null
         and not exists (
           select 1 from auth.users u where u.id = old.user_id
         )
         and new.organization_id is not distinct from old.organization_id
       )
       or
       -- Cas 3 : Détachement simultané des deux s'ils ont tous deux disparu
       (
         old.organization_id is not null
         and new.organization_id is null
         and not exists (
           select 1 from public.organizations o where o.id = old.organization_id
         )
         and old.user_id is not null
         and new.user_id is null
         and not exists (
           select 1 from auth.users u where u.id = old.user_id
         )
       )
     )
     -- Le contenu du journal ne change pas
     and new.id          =              old.id
     and new.actor_label is not distinct from old.actor_label
     and new.action      =              old.action
     and new.entity_type =              old.entity_type
     and new.entity_id   is not distinct from old.entity_id
     and new.metadata    =              old.metadata
     and new.created_at  =              old.created_at
  then
    return new;
  end if;

  raise exception 'Le journal d''audit est immuable : ni modification ni suppression.'
    using errcode = 'insufficient_privilege';
end;
$$;

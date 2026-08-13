-- =============================================================================
-- Immuabilité du journal : une exception, et une seule
-- =============================================================================
--
-- LE CONSTAT
--
-- La migration précédente a fait passer `audit_logs.organization_id` en
-- `on delete set null`, pour que le journal survive à la suppression de son
-- organisation. La suppression échoue toujours :
--
--   → 42501 « Le journal d'audit est immuable : ni modification ni suppression. »
--
-- Le détachement est un UPDATE, et `audit_logs_immutable` s'exécute
-- `before delete or update` : il refuse aussi bien l'un que l'autre. Le
-- garde-fou bloque désormais l'opération même qui devait le contourner.
--
-- LE PRINCIPE À PRÉSERVER
--
-- Ce qu'un journal d'audit doit garantir, c'est que son CONTENU ne change
-- jamais : qui a fait quoi, sur quoi, et quand. Rattacher une ligne à une
-- organisation qui n'existe plus n'est pas une réécriture de l'histoire — c'est
-- une conséquence mécanique de la disparition du parent.
--
-- L'exception est donc taillée au plus juste. Elle n'accepte que la mise à NULL
-- de `organization_id`, uniquement si l'organisation a réellement disparu, et à
-- la stricte condition qu'AUCUN autre champ ne bouge. Toute autre modification,
-- toute suppression, restent refusées comme avant.
--
-- La vérification champ par champ n'est pas de la méfiance décorative : sans
-- elle, un `update audit_logs set action = '…', organization_id = null` passerait
-- dès lors que l'organisation aurait été supprimée. C'est exactement le scénario
-- qu'un journal doit rendre impossible.
-- =============================================================================

create or replace function app.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     -- Le seul changement autorisé : le détachement.
     and old.organization_id is not null
     and new.organization_id is null
     -- Et seulement si l'organisation a bel et bien disparu. PostgreSQL
     -- supprime la ligne parente AVANT de déclencher l'action référentielle :
     -- au moment où ce trigger s'exécute, elle n'est déjà plus là.
     and not exists (
       select 1 from public.organizations o where o.id = old.organization_id
     )
     -- Le contenu du journal, lui, ne bouge pas d'un octet.
     and new.id          =              old.id
     and new.user_id     is not distinct from old.user_id
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

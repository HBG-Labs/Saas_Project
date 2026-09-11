-- =============================================================================
-- La file des sièges ne doit pas empêcher de supprimer une organisation
-- =============================================================================
--
-- CE QUE CE CORRECTIF RÉPARE, ET COMMENT ON L'A TROUVÉ
--
-- `20260909234645_durable_subscription_seat_sync.sql` pose des triggers AFTER
-- sur `organization_members`, et `20260910201130` en ajoute sur `subscriptions`.
-- Tous appellent `app.enqueue_subscription_seat_sync()`, qui INSÈRE une ligne
-- dans `subscription_seat_sync_jobs` — table dont la clé étrangère exige que
-- l'organisation existe.
--
-- Or, quand on supprime une organisation, PostgreSQL supprime d'abord ses
-- enfants en cascade. Ces triggers se déclenchent donc alors que le parent a
-- déjà disparu, et l'insertion échoue :
--
--     insert or update on table "subscription_seat_sync_jobs" violates foreign
--     key constraint — Key (organization_id)=(…) is not present in table
--     "organizations"
--
-- Conséquence, et c'est elle qui rend ce correctif urgent : **plus AUCUNE
-- organisation ne pouvait être supprimée**. Pas seulement les jeux d'essai —
-- la fermeture de compte d'un vrai client aussi, alors que le RGPD l'impose.
--
-- Découvert en jouant un nettoyage complet dans une transaction annulée, avant
-- toute écriture : le défaut ne se voit pas autrement, puisqu'il ne se
-- manifeste qu'au moment d'une suppression d'organisation — geste rare.
--
-- LE CORRECTIF
--
-- Une organisation qui n'existe plus n'a plus de sièges à synchroniser : la
-- tâche n'a aucun sens, et le trigger n'a rien à faire. On sort sans insérer.
-- Le garde-fou n'est pas relâché pour autant — la clé étrangère reste, et toute
-- autre tentative d'inscrire une organisation inconnue échouera toujours.
-- =============================================================================

create or replace function app.enqueue_subscription_seat_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  v_organization_id := case when tg_op = 'DELETE'
    then old.organization_id
    else new.organization_id
  end;

  -- Suppression en cascade : le parent est déjà parti. Rien à synchroniser.
  if not exists (
    select 1 from public.organizations o where o.id = v_organization_id
  ) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  insert into public.subscription_seat_sync_jobs (
    organization_id,
    desired_extra_seats
  ) values (
    v_organization_id,
    app.org_extra_seats(v_organization_id)
  )
  on conflict (organization_id) do update set
    desired_extra_seats = excluded.desired_extra_seats,
    attempts            = 0,
    next_attempt_at     = now(),
    locked_at           = null,
    last_error          = null,
    revision            = gen_random_uuid(),
    updated_at          = now();

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function app.enqueue_subscription_seat_sync() from public, anon, authenticated;

comment on function app.enqueue_subscription_seat_sync() is
  'Actualise la file Stripe apres changement de membre ou d abonnement. Sans effet si l organisation a disparu.';

-- -----------------------------------------------------------------------------
-- Contrôle : la suppression d'une organisation doit désormais aboutir.
-- -----------------------------------------------------------------------------
do $$
declare
  v_org uuid;
begin
  -- On fabrique une organisation jetable, on lui donne un abonnement — donc un
  -- trigger à déclencher — puis on la supprime. Sans le correctif ci-dessus,
  -- ce bloc échoue sur la violation de clé étrangère.
  -- `organizations_slug_check` impose ^[a-z0-9]+(-[a-z0-9]+)*$ : ni underscore
  -- ni tiret en bordure.
  insert into public.organizations (name, slug)
  values ('Controle suppression', 'controle-suppression-20260911')
  returning id into v_org;

  -- Le déclencheur d'essai a peut-être déjà posé un abonnement ; on n'en ajoute
  -- un que s'il manque. Ce qui compte est qu'il y en ait un à supprimer, donc
  -- un trigger de synchronisation à déclencher.
  if not exists (select 1 from public.subscriptions where organization_id = v_org) then
    insert into public.subscriptions (organization_id, plan_code, status)
    values (v_org, 'starter', 'active');
  end if;

  delete from public.organizations where id = v_org;

  if exists (select 1 from public.organizations where id = v_org) then
    raise exception 'L''organisation de contrôle n''a pas été supprimée.';
  end if;
  if exists (select 1 from public.subscription_seat_sync_jobs where organization_id = v_org) then
    raise exception 'Une tâche de synchronisation subsiste pour une organisation supprimée.';
  end if;
end
$$;

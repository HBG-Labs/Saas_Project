-- Permet au propriétaire (dirigeant/patron) de statuer et valider ses propres congés.
-- Les autres collaborateurs (techniciens, managers) ne peuvent pas s'auto-approuver.

create or replace function app.enforce_leave_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor      uuid := (select auth.uid());
  v_actor_role text;
  v_subject    uuid;
  v_can_decide boolean;
begin
  select m.user_id into v_subject
  from public.organization_members m
  where m.id = new.member_id;

  select m.role into v_actor_role
  from public.organization_members m
  where m.organization_id = new.organization_id and m.user_id = v_actor;

  v_can_decide := app.has_org_permission(new.organization_id, 'leave.approve');

  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception 'Une demande de congé est créée en attente de validation.'
        using errcode = 'check_violation';
    end if;

    -- Saisir pour quelqu'un d'autre est un acte de gestion, pas une demande.
    if v_subject is distinct from v_actor and not v_can_decide then
      raise exception 'Vous ne pouvez déposer une demande que pour vous-même.'
        using errcode = 'insufficient_privilege';
    end if;

    new.reviewed_by := null;
    new.reviewed_at := null;
    return new;
  end if;

  -- À partir d'ici : UPDATE.
  if old.status <> 'pending' then
    raise exception 'Cette demande a déjà été traitée : elle n''est plus modifiable.'
      using errcode = 'check_violation';
  end if;

  if new.member_id is distinct from old.member_id then
    raise exception 'Une demande ne change pas de titulaire.'
      using errcode = 'check_violation';
  end if;

  if new.status = old.status then
    -- Simple correction avant décision : réservée à l'auteur.
    if v_subject is distinct from v_actor then
      raise exception 'Seul l''auteur peut corriger sa demande.'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if new.status = 'cancelled' then
    if v_subject is distinct from v_actor and not v_can_decide then
      raise exception 'Seul l''auteur peut retirer sa demande.'
        using errcode = 'insufficient_privilege';
    end if;
    new.reviewed_by := null;
    new.reviewed_at := now();
    return new;
  end if;

  if new.status in ('approved', 'rejected') then
    if not v_can_decide then
      raise exception 'Vous n''avez pas le droit de statuer sur une demande de congé.'
        using errcode = 'insufficient_privilege';
    end if;

    -- Le patron / propriétaire de l'organisation a pleine légitimité pour valider ses propres congés.
    -- Les autres rôles (ex. managers) ne peuvent pas auto-valider leurs congés sans validation tierce.
    if v_subject = v_actor and v_actor_role is distinct from 'owner' then
      raise exception 'Vous ne pouvez pas statuer sur vos propres congés.'
        using errcode = 'insufficient_privilege';
    end if;

    -- Le serveur signe et horodate. Ce que le client aurait envoyé est écrasé.
    new.reviewed_by := v_actor;
    new.reviewed_at := now();

    -- Une décision ne réécrit pas la demande.
    new.type       := old.type;
    new.start_date := old.start_date;
    new.end_date   := old.end_date;
    new.days_count := old.days_count;
    new.reason     := old.reason;
    return new;
  end if;

  raise exception 'Statut de congé invalide : %', new.status
    using errcode = 'check_violation';
end;
$$;

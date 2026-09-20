-- =============================================================================
-- Notifications actives : affectation, congé, compte rendu — par e-mail
-- =============================================================================
--
-- LE CONSTAT (audit Gestion, I4)
--
-- Les notifications de la cloche sont DÉRIVÉES à l'ouverture de l'app (phase 2,
-- choix validé). Rien ne part vers la personne tant qu'elle n'ouvre pas
-- REZO360 : un technicien affecté à une mission n'est prévenu par rien.
-- Affecter sans prévenir, c'est ne pas affecter.
--
-- CE QUI EST DÉCIDÉ ICI (arbitrages A–G du 20/09/2026)
--
-- A. Trois familles, celles où « ne pas prévenir » coûte tout de suite :
--    l'affectation (→ le technicien), le congé (demande → qui peut valider ;
--    décision → le demandeur), le compte rendu (soumis → qui contrôle ;
--    renvoyé → le technicien). Stock et étalonnage restent dans la cloche.
-- B. E-mail seulement, transport Resend existant. Pas de SMS : aucun
--    expéditeur n'existe. Pas de push : décision du 15/09.
-- C. Une file `notification_deliveries` remplie par des triggers AFTER qui
--    n'envoient jamais rien ; un worker Edge réveillé chaque minute réclame
--    (SKIP LOCKED), envoie, marque, réessaie avec recul. Même patron que les
--    alertes administrateur (20260915090000).
-- D. Les préférences (`user_preferences.notify_*`) sont évaluées À L'ENVOI,
--    par le worker : une personne qui coupe le réglage entre l'événement et
--    l'envoi ne reçoit rien. Nouveau réglage `notify_report_review`.
-- E. Anti-rafale : une seule ligne EN ATTENTE par (destinataire, événement,
--    entité). Réaffecter trois fois la même mission en une minute produit un
--    seul e-mail — celui de l'état final. Pas de digest en v1.
-- F. Le contenu est un instantané (`payload`) pris à l'événement : ce qu'on a
--    vu à l'instant T, même si la mission change ensuite. Le lien profond
--    mène à l'écran, qui montre l'état courant.
-- G. Ce que ça ne fait pas : suivi d'ouverture, historique visible par la
--    personne, push, envoi aux contacts du portail (ils ont leur circuit).
--
-- ON NE SE PRÉVIENT PAS SOI-MÊME : l'acteur de l'événement n'est jamais
-- destinataire. Un chef qui s'affecte une mission le sait déjà.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Le réglage manquant
-- -----------------------------------------------------------------------------
alter table public.user_preferences
  add column notify_report_review boolean not null default true;

comment on column public.user_preferences.notify_report_review is
  'E-mail quand un compte rendu est à contrôler (contrôleur) ou renvoyé (technicien).';

-- -----------------------------------------------------------------------------
-- 2. La file d'attente
-- -----------------------------------------------------------------------------
create table public.notification_deliveries (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  recipient_user_id  uuid not null references auth.users (id) on delete cascade,
  event              text not null
                       check (event in ('mission_assigned', 'leave_requested', 'leave_decided',
                                        'report_submitted', 'report_rejected')),
  entity_type        text not null,
  entity_id          uuid not null,
  -- L'instantané : titre, référence, dates, lieu, auteur, chemin de l'écran.
  payload            jsonb not null default '{}'::jsonb,

  status             text not null default 'pending'
                       check (status in ('pending', 'sent', 'skipped', 'failed')),
  attempts           integer not null default 0 check (attempts >= 0),
  next_attempt_at    timestamptz not null default now(),
  locked_at          timestamptz,
  sent_at            timestamptz,
  provider_id        text,
  last_error         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.notification_deliveries is
  'File d''attente des e-mails de notification (affectation, congé, compte rendu). '
  'Écrite par des triggers, traitée par notification-worker. service_role uniquement.';

-- E : une seule ligne en attente par destinataire, événement et entité.
create unique index notification_deliveries_pending_idx
  on public.notification_deliveries (recipient_user_id, event, entity_id) where status = 'pending';
create index notification_deliveries_due_idx
  on public.notification_deliveries (next_attempt_at) where status = 'pending';
create index notification_deliveries_entity_idx
  on public.notification_deliveries (entity_id, created_at desc);

create trigger notification_deliveries_set_updated_at
  before update on public.notification_deliveries
  for each row execute function public.set_updated_at();

alter table public.notification_deliveries enable row level security;
revoke all on table public.notification_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table public.notification_deliveries to service_role;

-- -----------------------------------------------------------------------------
-- 3. Enfiler
-- -----------------------------------------------------------------------------
/**
 * Une notification pour une personne. Rien si le destinataire est l'acteur.
 * Une ligne déjà en attente pour le même triplet est REMPLACÉE (instantané
 * et échéance à jour) : c'est l'anti-rafale.
 */
create or replace function app.enqueue_notification(
  p_organization_id uuid,
  p_recipient_user_id uuid,
  p_event text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_recipient_user_id is null or p_recipient_user_id = (select auth.uid()) then
    return;
  end if;
  insert into public.notification_deliveries
    (organization_id, recipient_user_id, event, entity_type, entity_id, payload)
  values
    (p_organization_id, p_recipient_user_id, p_event, p_entity_type, p_entity_id, coalesce(p_payload, '{}'::jsonb))
  on conflict (recipient_user_id, event, entity_id) where status = 'pending'
  do update set payload = excluded.payload, next_attempt_at = now(), updated_at = now();
end;
$$;

revoke all on function app.enqueue_notification(uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated;

/** Les comptes actifs d'une organisation qui portent une permission, sauf un. */
create or replace function app.users_with_permission(p_organization_id uuid, p_permission text, p_except_user uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id
  from public.organization_members m
  join public.role_permissions rp on rp.role = m.role and rp.permission = p_permission
  where m.organization_id = p_organization_id
    and m.status = 'active'
    and (p_except_user is null or m.user_id <> p_except_user);
$$;

revoke all on function app.users_with_permission(uuid, text, uuid) from public, anon, authenticated;

/** Le nom affiché d'un compte, pour dire QUI a fait quoi. */
create or replace function app.display_name_of(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.display_name, split_part(u.email, '@', 1), 'Un collègue')
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user_id;
$$;

revoke all on function app.display_name_of(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Les événements
-- -----------------------------------------------------------------------------
-- Affectation : la personne affectée change, ou une mission brouillon devient
-- affectée. Une mission annulée ou terminée ne prévient personne.
create or replace function app.notify_mission_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if new.assigned_user_id is null or new.status in ('draft', 'cancelled', 'completed') then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.assigned_user_id is not distinct from old.assigned_user_id
     and old.status not in ('draft') then
    return new;
  end if;

  select m.user_id into v_user from public.organization_members m where m.id = new.assigned_user_id;
  perform app.enqueue_notification(new.organization_id, v_user, 'mission_assigned', 'mission', new.id,
    jsonb_build_object(
      'reference', new.reference,
      'title', new.title,
      'scheduled_start', new.scheduled_start,
      'scheduled_end', new.scheduled_end,
      'address', concat_ws(', ', new.address_line1, concat_ws(' ', new.postal_code, new.city)),
      'customer_name', new.customer_name,
      'actor', app.display_name_of((select auth.uid())),
      'path', '/missions/' || new.id));
  return new;
end;
$$;

revoke all on function app.notify_mission_assigned() from public, anon, authenticated;

create trigger missions_notify_assigned
  after insert or update of assigned_user_id, status on public.missions
  for each row execute function app.notify_mission_assigned();

-- Congé : la demande vers qui peut valider ; la décision vers le demandeur.
create or replace function app.notify_leave_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester uuid;
  v_recipient uuid;
  v_payload   jsonb;
begin
  select m.user_id into v_requester from public.organization_members m where m.id = new.member_id;
  v_payload := jsonb_build_object(
    'type', new.type,
    'start_date', new.start_date,
    'end_date', new.end_date,
    'days_count', new.days_count,
    'status', new.status,
    'requester', app.display_name_of(v_requester),
    'actor', app.display_name_of((select auth.uid())),
    'review_note', new.review_note,
    'path', '/planning');

  if tg_op = 'INSERT' and new.status = 'pending' then
    for v_recipient in select app.users_with_permission(new.organization_id, 'leave.approve', v_requester) loop
      perform app.enqueue_notification(new.organization_id, v_recipient, 'leave_requested', 'leave_request', new.id, v_payload);
    end loop;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'rejected') then
    perform app.enqueue_notification(new.organization_id, v_requester, 'leave_decided', 'leave_request', new.id, v_payload);
  end if;
  return new;
end;
$$;

revoke all on function app.notify_leave_request() from public, anon, authenticated;

create trigger leave_requests_notify
  after insert or update of status on public.leave_requests
  for each row execute function app.notify_leave_request();

-- Compte rendu : soumis vers qui contrôle ; renvoyé vers le technicien.
create or replace function app.notify_intervention_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_technician uuid;
  v_recipient  uuid;
  v_mission    record;
  v_payload    jsonb;
begin
  if new.status is not distinct from old.status or new.status not in ('submitted', 'rejected') then
    return new;
  end if;

  select m.user_id into v_technician from public.organization_members m where m.id = new.technician_id;
  select mi.reference, mi.title into v_mission
  from public.interventions i join public.missions mi on mi.id = i.mission_id
  where i.id = new.intervention_id;

  v_payload := jsonb_build_object(
    'reference', v_mission.reference,
    'title', v_mission.title,
    'status', new.status,
    'technician', app.display_name_of(v_technician),
    'actor', app.display_name_of((select auth.uid())),
    'rejection_reason', new.rejection_reason,
    'path', '/interventions/' || new.intervention_id);

  if new.status = 'submitted' then
    for v_recipient in select app.users_with_permission(new.organization_id, 'intervention.review', v_technician) loop
      perform app.enqueue_notification(new.organization_id, v_recipient, 'report_submitted', 'intervention_report', new.id, v_payload);
    end loop;
  else
    perform app.enqueue_notification(new.organization_id, v_technician, 'report_rejected', 'intervention_report', new.id, v_payload);
  end if;
  return new;
end;
$$;

revoke all on function app.notify_intervention_report() from public, anon, authenticated;

create trigger intervention_reports_notify
  after update of status on public.intervention_reports
  for each row execute function app.notify_intervention_report();

-- -----------------------------------------------------------------------------
-- 5. Le tirage du worker, et son compte rendu
-- -----------------------------------------------------------------------------
-- Le worker reçoit tout ce qu'il faut pour décider et envoyer : l'adresse, le
-- nom, et les réglages du destinataire (D : évalués maintenant, pas à
-- l'enfilage). `auth.users` se lit ici, en `security definer`, plutôt que par
-- l'API d'administration depuis le worker.
create or replace function public.claim_notification_deliveries(p_limit integer default 25)
returns table (
  id                uuid,
  organization_id   uuid,
  organization_name text,
  recipient_user_id uuid,
  recipient_email   text,
  recipient_name    text,
  event             text,
  entity_id         uuid,
  payload           jsonb,
  attempts          integer,
  notify_new_mission boolean,
  notify_leave_requests boolean,
  notify_report_review boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select d.id
    from public.notification_deliveries d
    where d.status = 'pending'
      and d.next_attempt_at <= now()
      and (d.locked_at is null or d.locked_at < now() - interval '5 minutes')
    order by d.next_attempt_at, d.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  ), claimed as (
    update public.notification_deliveries d
       set locked_at = now()
      from candidates c
     where d.id = c.id
    returning d.id, d.organization_id, d.recipient_user_id, d.event, d.entity_id, d.payload, d.attempts
  )
  select c.id, c.organization_id, o.name, c.recipient_user_id, u.email::text,
         app.display_name_of(c.recipient_user_id),
         c.event, c.entity_id, c.payload, c.attempts,
         coalesce(p.notify_new_mission, true),
         coalesce(p.notify_leave_requests, true),
         coalesce(p.notify_report_review, true)
  from claimed c
  join public.organizations o on o.id = c.organization_id
  join auth.users u on u.id = c.recipient_user_id
  left join public.user_preferences p on p.user_id = c.recipient_user_id;
end;
$$;

revoke all on function public.claim_notification_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries(integer) to service_role;

/**
 * Le résultat d'une tentative. Un échec repousse la prochaine avec recul
 * (2, 4, 8… minutes, plafonné à 4 h) ; au huitième, la ligne est `failed` et
 * ne sera plus tentée — un e-mail d'affectation vieux d'une journée ne
 * prévient plus, il embrouille.
 */
create or replace function public.record_notification_delivery_result(
  p_id uuid,
  p_outcome text,
  p_provider_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  if p_outcome not in ('sent', 'skipped', 'error') then
    raise exception 'Résultat inconnu : %', p_outcome using errcode = 'check_violation';
  end if;

  select attempts + 1 into v_attempts from public.notification_deliveries where id = p_id;
  if v_attempts is null then return; end if;

  update public.notification_deliveries
  set attempts = v_attempts,
      locked_at = null,
      provider_id = coalesce(p_provider_id, provider_id),
      last_error = case when p_outcome = 'error' then left(p_error, 500) else null end,
      status = case when p_outcome = 'sent' then 'sent'
                    when p_outcome = 'skipped' then 'skipped'
                    when v_attempts >= 8 then 'failed'
                    else 'pending' end,
      sent_at = case when p_outcome = 'sent' then now() else sent_at end,
      next_attempt_at = case when p_outcome = 'error' and v_attempts < 8
                             then now() + least(power(2, v_attempts)::int * interval '1 minute', interval '4 hours')
                             else next_attempt_at end
  where id = p_id;
end;
$$;

revoke all on function public.record_notification_delivery_result(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_notification_delivery_result(uuid, text, text, text) to service_role;

create table public.notification_worker_runs (
  id          bigint generated always as identity primary key,
  ran_at      timestamptz not null default now(),
  attempted   integer not null default 0 check (attempted >= 0),
  sent        integer not null default 0 check (sent >= 0),
  skipped     integer not null default 0 check (skipped >= 0),
  failed      integer not null default 0 check (failed >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0)
);

create index notification_worker_runs_recent_idx on public.notification_worker_runs (ran_at desc);

alter table public.notification_worker_runs enable row level security;
revoke all on table public.notification_worker_runs from public, anon, authenticated;
grant select, insert on table public.notification_worker_runs to service_role;
grant usage, select on sequence public.notification_worker_runs_id_seq to service_role;

-- Ménage : une ligne envoyée ou abandonnée n'a plus d'intérêt après 90 jours.
create or replace function app.purge_notification_deliveries()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.notification_deliveries
  where status <> 'pending' and updated_at < now() - interval '90 days';
$$;

revoke all on function app.purge_notification_deliveries() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Le réveil planifié — même patron que les alertes administrateur
-- -----------------------------------------------------------------------------
-- Configuration hors dépôt, à poser une fois dans le SQL Editor :
--
--   select vault.create_secret(
--     'https://<ref>.supabase.co/functions/v1/notification-worker', 'notification_worker_url');
--   select vault.create_secret('<même valeur que le secret Edge NOTIFICATION_WORKER_SECRET>',
--     'notification_worker_secret');
create or replace function app.trigger_notification_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  -- Rien à envoyer : pas d'appel. Le worker n'est réveillé que pour du travail.
  if not exists (select 1 from public.notification_deliveries
                 where status = 'pending' and next_attempt_at <= now()) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notification_worker_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notification_worker_secret';
  if v_url is null or v_secret is null then
    raise notice 'Worker de notifications non configuré : renseignez notification_worker_url et notification_worker_secret dans Vault.';
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function app.trigger_notification_worker() from public, anon, authenticated;

select cron.schedule('notification-worker', '* * * * *', $$select app.trigger_notification_worker()$$);
select cron.schedule('notification-deliveries-purge', '15 3 * * *', $$select app.purge_notification_deliveries()$$);

-- -----------------------------------------------------------------------------
-- 7. Auto-vérification
-- -----------------------------------------------------------------------------
do $$
declare v int;
begin
  select count(*) into v from pg_trigger
  where tgname in ('missions_notify_assigned', 'leave_requests_notify', 'intervention_reports_notify');
  if v <> 3 then raise exception '% déclencheur(s) de notification au lieu de 3.', v; end if;
  select count(*) into v from cron.job where jobname in ('notification-worker', 'notification-deliveries-purge');
  if v <> 2 then raise exception '% tâche(s) planifiée(s) au lieu de 2.', v; end if;
  select count(*) into v from pg_policy p join pg_class c on c.oid = p.polrelid where c.relname = 'notification_deliveries';
  if v <> 0 then raise exception 'La file ne doit avoir aucune politique : service_role seul.'; end if;
end $$;

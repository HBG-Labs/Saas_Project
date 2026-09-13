-- =============================================================================
-- Portail client — identité du contact et messagerie
-- =============================================================================
--
-- QUI EST « LE CLIENT » POUR LA BASE
--
-- Un contact (`customer_contacts`) dont l'adresse a été vérifiée par Supabase
-- Auth — code à usage unique reçu sur cette adresse — et que l'entreprise a
-- explicitement autorisé (`portal_enabled`). La correspondance se fait sur
-- l'adresse portée par le jeton de session, jamais sur un identifiant fourni
-- par le navigateur : `app.my_portal_contact_ids()` est la seule porte, et
-- toutes les policies du portail passent par elle.
--
-- Conséquence assumée : si l'entreprise change l'adresse d'un contact, l'accès
-- suit l'adresse. C'est l'entreprise qui garde la main, et c'est voulu.
--
-- DEUX POPULATIONS SUR LES MÊMES TABLES
--
-- Les conversations et les messages sont lus par des membres de l'organisation
-- ET par des contacts. Chaque policy existe donc en deux exemplaires, nommés
-- `_staff_` et `_portal_`, et PostgreSQL les combine par OU. Aucune des deux
-- ne s'appuie sur l'autre : un contact n'est jamais membre, un membre n'est
-- jamais contact de sa propre organisation.
--
-- LE RATTACHEMENT DES RÉPONSES E-MAIL NE STOCKE AUCUN SECRET
--
-- L'adresse de réponse d'une conversation est dérivée par HMAC de son
-- identifiant, côté serveur, à partir d'un secret d'environnement. Le webhook
-- entrant recalcule et compare. Rien à conserver en clair, rien à hacher, et
-- une rotation du secret invalide toutes les adresses émises.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Identité portail
-- -----------------------------------------------------------------------------

create or replace function app.my_portal_contact_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.customer_contacts c
  join public.client_portal_settings s
    on s.organization_id = c.organization_id and s.enabled
  where c.portal_enabled
    and lower(c.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    and c.email is not null
    and app.org_has_feature(c.organization_id, 'client_portal');
$$;

revoke all on function app.my_portal_contact_ids() from public, anon;
grant execute on function app.my_portal_contact_ids() to authenticated;

comment on function app.my_portal_contact_ids() is
  'Contacts que la session courante incarne dans le portail : adresse vérifiée, accès accordé, portail actif, formule éligible.';

create or replace function app.portal_customer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct c.customer_id
  from public.customer_contacts c
  where c.id in (select app.my_portal_contact_ids());
$$;

revoke all on function app.portal_customer_ids() from public, anon;
grant execute on function app.portal_customer_ids() to authenticated;

/** Vrai si la session est un contact portail, de n'importe quelle organisation. */
create or replace function app.is_portal_contact()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from app.my_portal_contact_ids());
$$;

revoke all on function app.is_portal_contact() from public, anon;
grant execute on function app.is_portal_contact() to authenticated;

-- Un contact ne lit pas les réglages de l'organisation ; une policy qui les
-- interrogerait directement s'évaluerait sous SA RLS et serait toujours
-- fausse. Trouvé par la suite 07 avant que la migration ne soit appliquée.
create or replace function app.portal_client_may_initiate(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.client_portal_settings s
    where s.organization_id = p_organization_id and s.enabled and s.allow_client_initiated
  );
$$;

revoke all on function app.portal_client_may_initiate(uuid) from public, anon;
grant execute on function app.portal_client_may_initiate(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Conversations
-- -----------------------------------------------------------------------------

create table public.client_conversations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  customer_id      uuid not null references public.customers (id) on delete cascade,
  contact_id       uuid not null references public.customer_contacts (id) on delete cascade,
  subject          text not null check (char_length(subject) between 1 and 200),
  status           text not null default 'open' check (status in ('open', 'closed')),
  initiated_by     text not null check (initiated_by in ('organization', 'client')),
  -- Rattachements facultatifs. `on delete set null` : une conversation survit
  -- à la disparition de ce dont elle parlait.
  mission_id       uuid references public.missions (id) on delete set null,
  quote_id         uuid references public.quotes (id) on delete set null,
  invoice_id       uuid references public.invoices (id) on delete set null,
  last_message_at  timestamptz,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index client_conversations_org_idx
  on public.client_conversations (organization_id, last_message_at desc nulls last);
create index client_conversations_contact_idx
  on public.client_conversations (contact_id, last_message_at desc nulls last);
create index client_conversations_customer_idx
  on public.client_conversations (customer_id);

create trigger client_conversations_set_updated_at
  before update on public.client_conversations
  for each row execute function public.set_updated_at();

-- Le contact appartient au client, le client à l'organisation, et tout
-- rattachement pointe dans la même organisation ET le même client. Une
-- conversation ne doit jamais relier deux tenants, ni deux clients.
create or replace function app.enforce_client_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact_customer uuid;
  v_contact_org      uuid;
  v_customer_org     uuid;
begin
  select c.customer_id, c.organization_id into v_contact_customer, v_contact_org
  from public.customer_contacts c where c.id = new.contact_id;
  select organization_id into v_customer_org
  from public.customers where id = new.customer_id;

  if v_contact_customer is null or v_customer_org is null then
    raise exception 'Contact ou client introuvable.' using errcode = 'foreign_key_violation';
  end if;
  if v_contact_customer <> new.customer_id or v_contact_org <> new.organization_id
     or v_customer_org <> new.organization_id then
    raise exception 'La conversation relie un contact, un client et une organisation qui ne correspondent pas.'
      using errcode = 'check_violation';
  end if;

  if new.mission_id is not null and not exists (
    select 1 from public.missions m
    where m.id = new.mission_id and m.organization_id = new.organization_id
      and m.customer_id = new.customer_id
  ) then
    raise exception 'La mission rattachée n''appartient pas à ce client.' using errcode = 'check_violation';
  end if;
  if new.quote_id is not null and not exists (
    select 1 from public.quotes q
    where q.id = new.quote_id and q.organization_id = new.organization_id
      and q.customer_id = new.customer_id
  ) then
    raise exception 'Le devis rattaché n''appartient pas à ce client.' using errcode = 'check_violation';
  end if;
  if new.invoice_id is not null and not exists (
    select 1 from public.invoices i
    where i.id = new.invoice_id and i.organization_id = new.organization_id
      and i.customer_id = new.customer_id
  ) then
    raise exception 'La facture rattachée n''appartient pas à ce client.' using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id
       or new.customer_id is distinct from old.customer_id
       or new.contact_id is distinct from old.contact_id
       or new.initiated_by is distinct from old.initiated_by
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Les parties d''une conversation sont immuables.' using errcode = 'restrict_violation';
    end if;
  else
    if (select auth.uid()) is not null then
      new.created_by := (select auth.uid());
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app.enforce_client_conversation() from public, anon, authenticated;

create trigger client_conversations_enforce
  before insert or update on public.client_conversations
  for each row execute function app.enforce_client_conversation();

-- -----------------------------------------------------------------------------
-- Messages
-- -----------------------------------------------------------------------------

create table public.client_messages (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  conversation_id      uuid not null references public.client_conversations (id) on delete cascade,
  -- `outbound` : de l'entreprise vers le client. `inbound` : du client.
  direction            text not null check (direction in ('outbound', 'inbound')),
  -- `portal` : saisi dans REZO360 ou dans le portail. `email` : reçu par courriel.
  channel              text not null default 'portal' check (channel in ('portal', 'email')),
  author_user_id       uuid references auth.users (id) on delete set null,
  sender_email         text,
  recipient_email      text,
  subject              text check (subject is null or char_length(subject) <= 250),
  body_text            text not null check (char_length(body_text) between 1 and 20000),
  body_html            text check (body_html is null or char_length(body_html) <= 200000),
  -- Identifiants du fournisseur et du courrier, pour le suivi et le fil.
  resend_email_id      text,
  internet_message_id  text,
  in_reply_to          text,
  references_header    text,
  status               text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'failed', 'bounced', 'complained', 'received')),
  error                text,
  sent_at              timestamptz,
  delivered_at         timestamptz,
  received_at          timestamptz,
  read_by_client_at    timestamptz,
  read_by_staff_at     timestamptz,
  created_at           timestamptz not null default now()
);

create index client_messages_conversation_idx
  on public.client_messages (conversation_id, created_at);
create index client_messages_unread_staff_idx
  on public.client_messages (organization_id)
  where direction = 'inbound' and read_by_staff_at is null;
create unique index client_messages_resend_id_idx
  on public.client_messages (resend_email_id) where resend_email_id is not null;
create unique index client_messages_internet_id_idx
  on public.client_messages (internet_message_id) where internet_message_id is not null;

-- L'organisation vient de la conversation, jamais du navigateur ; la direction
-- vient de QUI écrit, jamais d'un champ libre. Le rôle de service, lui, est
-- cru sur parole : c'est le webhook et l'envoi, qui ont déjà vérifié.
create or replace function app.enforce_client_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org      uuid;
  v_contact  uuid;
  v_status   text;
  v_role     text := coalesce((select auth.jwt() ->> 'role'), '');
begin
  select organization_id, contact_id, status into v_org, v_contact, v_status
  from public.client_conversations where id = new.conversation_id;
  if v_org is null then
    raise exception 'Conversation introuvable.' using errcode = 'foreign_key_violation';
  end if;
  new.organization_id := v_org;

  if v_role = 'service_role' then
    return new;
  end if;

  if v_status <> 'open' then
    raise exception 'Cette conversation est close.' using errcode = 'check_violation';
  end if;

  if v_contact in (select app.my_portal_contact_ids()) then
    new.direction := 'inbound';
    new.channel := 'portal';
    new.status := 'received';
    new.received_at := now();
  elsif app.has_org_permission(v_org, 'client_message.send') then
    new.direction := 'outbound';
    new.channel := 'portal';
    new.status := 'queued';
  else
    raise exception 'Vous ne pouvez pas écrire dans cette conversation.' using errcode = 'insufficient_privilege';
  end if;

  new.author_user_id := (select auth.uid());
  -- Ce qui relève du fournisseur ne se déclare pas depuis le navigateur.
  new.resend_email_id := null;
  new.internet_message_id := null;
  new.in_reply_to := null;
  new.references_header := null;
  new.error := null;
  new.sent_at := null;
  new.delivered_at := null;
  return new;
end;
$$;

revoke all on function app.enforce_client_message() from public, anon, authenticated;

create trigger client_messages_enforce
  before insert on public.client_messages
  for each row execute function app.enforce_client_message();

-- Depuis le navigateur, seule la date de lecture de SON côté peut changer.
create or replace function app.guard_client_message_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact uuid;
  v_role    text := coalesce((select auth.jwt() ->> 'role'), '');
begin
  if v_role = 'service_role' then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.conversation_id is distinct from old.conversation_id
     or new.direction is distinct from old.direction
     or new.channel is distinct from old.channel
     or new.author_user_id is distinct from old.author_user_id
     or new.sender_email is distinct from old.sender_email
     or new.recipient_email is distinct from old.recipient_email
     or new.subject is distinct from old.subject
     or new.body_text is distinct from old.body_text
     or new.body_html is distinct from old.body_html
     or new.resend_email_id is distinct from old.resend_email_id
     or new.internet_message_id is distinct from old.internet_message_id
     or new.in_reply_to is distinct from old.in_reply_to
     or new.references_header is distinct from old.references_header
     or new.status is distinct from old.status
     or new.error is distinct from old.error
     or new.sent_at is distinct from old.sent_at
     or new.delivered_at is distinct from old.delivered_at
     or new.received_at is distinct from old.received_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Seule la date de lecture peut être modifiée.' using errcode = 'insufficient_privilege';
  end if;

  select contact_id into v_contact from public.client_conversations where id = new.conversation_id;
  if v_contact in (select app.my_portal_contact_ids()) then
    if new.read_by_staff_at is distinct from old.read_by_staff_at then
      raise exception 'Un contact ne marque pas la lecture de l''entreprise.' using errcode = 'insufficient_privilege';
    end if;
  else
    if new.read_by_client_at is distinct from old.read_by_client_at then
      raise exception 'L''entreprise ne marque pas la lecture du contact.' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app.guard_client_message_update() from public, anon, authenticated;

create trigger client_messages_guard_update
  before update on public.client_messages
  for each row execute function app.guard_client_message_update();

-- La conversation remonte à chaque message.
create or replace function app.touch_client_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.client_conversations
     set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at)
   where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function app.touch_client_conversation() from public, anon, authenticated;

create trigger client_messages_touch_conversation
  after insert on public.client_messages
  for each row execute function app.touch_client_conversation();

-- -----------------------------------------------------------------------------
-- Pièces jointes
-- -----------------------------------------------------------------------------

create table public.client_message_attachments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  message_id       uuid not null references public.client_messages (id) on delete cascade,
  file_name        text not null check (char_length(file_name) between 1 and 255),
  storage_path     text not null unique,
  mime_type        text not null,
  file_size        bigint not null check (file_size >= 0),
  created_at       timestamptz not null default now()
);

create index client_message_attachments_message_idx
  on public.client_message_attachments (message_id);

create or replace function app.enforce_client_message_attachment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.client_messages where id = new.message_id;
  if v_org is null then
    raise exception 'Message introuvable.' using errcode = 'foreign_key_violation';
  end if;
  new.organization_id := v_org;
  if split_part(new.storage_path, '/', 1) <> v_org::text then
    raise exception 'Le chemin de la pièce jointe ne correspond pas à son organisation.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function app.enforce_client_message_attachment() from public, anon, authenticated;

create trigger client_message_attachments_enforce
  before insert on public.client_message_attachments
  for each row execute function app.enforce_client_message_attachment();

-- -----------------------------------------------------------------------------
-- Événements Resend : l'idempotence, sur le modèle de `stripe_events`
-- -----------------------------------------------------------------------------

create table public.resend_events (
  -- `svix-id` de la livraison : identique quand Resend rejoue le même événement.
  id            text primary key,
  event_type    text not null,
  email_id      text,
  outcome       text not null default 'received'
    check (outcome in ('received', 'processed', 'ignored', 'unmatched', 'rejected', 'failed')),
  detail        text,
  -- Charge utile conservée pour le diagnostic — un entrant non rattaché doit
  -- pouvoir être compris après coup, sans que rien n'ait été inventé.
  payload       jsonb,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz
);

create index resend_events_email_idx on public.resend_events (email_id) where email_id is not null;
create index resend_events_outcome_idx on public.resend_events (outcome, received_at desc);

-- -----------------------------------------------------------------------------
-- Journal d'audit — jamais le contenu, seulement le fait
-- -----------------------------------------------------------------------------

create or replace function app.audit_client_messaging()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'client_conversations' then
    perform app.write_audit_log(
      new.organization_id, 'portal.conversation_created', 'client_conversation', new.id,
      jsonb_build_object('customer_id', new.customer_id, 'initiated_by', new.initiated_by)
    );
  elsif tg_table_name = 'client_messages' then
    perform app.write_audit_log(
      new.organization_id,
      case when new.direction = 'outbound' then 'portal.message_sent' else 'portal.message_received' end,
      'client_message', new.id,
      jsonb_build_object('conversation_id', new.conversation_id, 'channel', new.channel)
    );
  end if;
  return new;
end;
$$;

revoke all on function app.audit_client_messaging() from public, anon, authenticated;

create trigger client_conversations_audit
  after insert on public.client_conversations
  for each row execute function app.audit_client_messaging();

create trigger client_messages_audit
  after insert on public.client_messages
  for each row execute function app.audit_client_messaging();

-- -----------------------------------------------------------------------------
-- RLS — deux populations, deux jeux de policies
-- -----------------------------------------------------------------------------

alter table public.client_conversations enable row level security;
alter table public.client_messages enable row level security;
alter table public.client_message_attachments enable row level security;
alter table public.resend_events enable row level security;

revoke all on public.client_conversations from public, anon, authenticated;
revoke all on public.client_messages from public, anon, authenticated;
revoke all on public.client_message_attachments from public, anon, authenticated;
revoke all on public.resend_events from public, anon, authenticated;

grant select, insert, update on public.client_conversations to authenticated;
grant select, insert, update on public.client_messages to authenticated;
grant select, insert on public.client_message_attachments to authenticated;
-- `resend_events` : aucun droit client. Seul le rôle de service y écrit.

-- Côté entreprise ---------------------------------------------------------------

create policy "client_conversations_staff_select"
  on public.client_conversations for select to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'client_portal'))
    and (select app.has_org_permission(organization_id, 'client_portal.view'))
  );

create policy "client_conversations_staff_insert"
  on public.client_conversations for insert to authenticated
  with check (
    initiated_by = 'organization'
    and (select app.can_use_pro_module(organization_id, 'client_portal'))
    and (select app.has_org_permission(organization_id, 'client_message.send'))
  );

create policy "client_conversations_staff_update"
  on public.client_conversations for update to authenticated
  using ((select app.has_org_permission(organization_id, 'client_message.send')))
  with check ((select app.has_org_permission(organization_id, 'client_message.send')));

create policy "client_messages_staff_select"
  on public.client_messages for select to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'client_portal'))
    and (select app.has_org_permission(organization_id, 'client_portal.view'))
  );

create policy "client_messages_staff_insert"
  on public.client_messages for insert to authenticated
  with check (
    conversation_id in (
      select c.id from public.client_conversations c
      where (select app.has_org_permission(c.organization_id, 'client_message.send'))
    )
  );

create policy "client_messages_staff_update"
  on public.client_messages for update to authenticated
  using ((select app.has_org_permission(organization_id, 'client_portal.view')))
  with check ((select app.has_org_permission(organization_id, 'client_portal.view')));

create policy "client_message_attachments_staff_select"
  on public.client_message_attachments for select to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'client_portal'))
    and (select app.has_org_permission(organization_id, 'client_portal.view'))
  );

create policy "client_message_attachments_staff_insert"
  on public.client_message_attachments for insert to authenticated
  with check (
    message_id in (
      select m.id from public.client_messages m
      where m.direction = 'outbound' and m.author_user_id = (select auth.uid())
    )
  );

-- Côté portail ------------------------------------------------------------------

create policy "client_conversations_portal_select"
  on public.client_conversations for select to authenticated
  using (contact_id in (select app.my_portal_contact_ids()));

create policy "client_conversations_portal_insert"
  on public.client_conversations for insert to authenticated
  with check (
    initiated_by = 'client'
    and contact_id in (select app.my_portal_contact_ids())
    and (select app.portal_client_may_initiate(organization_id))
  );

create policy "client_messages_portal_select"
  on public.client_messages for select to authenticated
  using (
    conversation_id in (
      select c.id from public.client_conversations c
      where c.contact_id in (select app.my_portal_contact_ids())
    )
  );

create policy "client_messages_portal_insert"
  on public.client_messages for insert to authenticated
  with check (
    conversation_id in (
      select c.id from public.client_conversations c
      where c.contact_id in (select app.my_portal_contact_ids())
    )
  );

create policy "client_messages_portal_update"
  on public.client_messages for update to authenticated
  using (
    conversation_id in (
      select c.id from public.client_conversations c
      where c.contact_id in (select app.my_portal_contact_ids())
    )
  )
  with check (
    conversation_id in (
      select c.id from public.client_conversations c
      where c.contact_id in (select app.my_portal_contact_ids())
    )
  );

create policy "client_message_attachments_portal_select"
  on public.client_message_attachments for select to authenticated
  using (
    message_id in (
      select m.id from public.client_messages m
      join public.client_conversations c on c.id = m.conversation_id
      where c.contact_id in (select app.my_portal_contact_ids())
    )
  );

-- -----------------------------------------------------------------------------
-- Storage : bucket privé, lecture conditionnée à une ligne visible
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-message-attachments',
  'client-message-attachments',
  false,
  15728640,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ]
)
on conflict (id) do nothing;

-- Lisible si — et seulement si — une ligne `client_message_attachments` visible
-- de la session porte ce chemin : la RLS de la table fait le tri, pour les
-- membres comme pour les contacts.
create policy "client_message_attachments_storage_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'client-message-attachments'
    and exists (
      select 1 from public.client_message_attachments a
      where a.storage_path = storage.objects.name
    )
  );

-- Dépôt : un membre autorisé à écrire, dans le préfixe de son organisation.
create policy "client_message_attachments_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'client-message-attachments'
    and (split_part(name, '/', 1))::uuid in (select app.my_organization_ids())
    and (select app.has_org_permission((split_part(name, '/', 1))::uuid, 'client_message.send'))
  );

-- -----------------------------------------------------------------------------
-- Contrôles
-- -----------------------------------------------------------------------------

do $$
declare v integer;
begin
  select count(*) into v from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('client_conversations', 'client_messages', 'client_message_attachments', 'resend_events')
     and c.relrowsecurity;
  if v <> 4 then raise exception 'RLS manquante : % table(s) sur 4.', v; end if;

  if exists (select 1 from storage.buckets where id = 'client-message-attachments' and public) then
    raise exception 'Le bucket des pièces jointes est public.';
  end if;

  -- Aucun droit client sur les événements du fournisseur.
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'resend_events'
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'resend_events est accessible depuis le navigateur.';
  end if;

  -- Une session sans adresse n'incarne aucun contact.
  if exists (select 1 from app.my_portal_contact_ids()) then
    raise exception 'my_portal_contact_ids() renvoie des lignes hors de toute session.';
  end if;
end
$$;

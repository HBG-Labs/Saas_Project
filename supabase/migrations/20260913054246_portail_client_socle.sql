-- =============================================================================
-- Portail client — socle : réglages, accès des contacts, partage explicite
-- =============================================================================
--
-- CE QUE CETTE MIGRATION POSE, ET CE QU'ELLE NE POSE PAS
--
-- Le portail client donne à un CONTACT d'un client final (`customer_contacts`)
-- un accès restreint à ce que l'entreprise décide de lui montrer. Ce fichier
-- pose les décisions — qui a accès, ce qui est partagé — sans encore ouvrir la
-- moindre lecture : les fonctions de lecture du portail viennent dans une
-- migration ultérieure, et aucune policy d'une table du cœur n'est élargie ici.
--
-- PRIVÉ PAR DÉFAUT, ET PAR CONSTRUCTION
--
-- Chaque drapeau ajouté vaut `false` à la création : `portal_enabled` sur le
-- contact, `shared_with_client` sur les photos et les documents. Un contact
-- n'entre pas dans le portail parce qu'il a une adresse ; une photo n'est pas
-- visible parce qu'elle est jointe à l'intervention du client. Il faut un geste
-- explicite d'un membre autorisé, et ce geste est journalisé.
--
-- POURQUOI DES TRIGGERS EN PLUS DES POLICIES
--
-- Une policy raisonne par ligne, jamais par colonne (voir ARCHITECTURE.md).
-- Ouvrir `intervention_attachments` en UPDATE pour permettre le partage
-- ouvrirait aussi `storage_path`, `mime_type`, `size_bytes`. Le trigger
-- `app.guard_attachment_share_update` n'autorise que les colonnes de partage.
-- Même logique pour `customer_contacts.portal_enabled`, qui exige une
-- permission distincte de la simple modification du contact.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Réglages du portail, une ligne par organisation
-- -----------------------------------------------------------------------------

create table public.client_portal_settings (
  organization_id              uuid primary key
    references public.organizations (id) on delete cascade,
  enabled                      boolean not null default false,
  allow_client_initiated       boolean not null default true,
  display_name                 text
    check (display_name is null or char_length(display_name) between 2 and 120),
  -- Catégories d'`organization_documents` visibles de tous les clients, en plus
  -- des documents partagés un à un. Vide = aucune catégorie automatique.
  visible_document_categories  text[] not null default '{}',
  updated_by                   uuid references auth.users (id) on delete set null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

comment on table public.client_portal_settings is
  'Réglages du portail client, une ligne par organisation. Absente = portail désactivé.';

create trigger client_portal_settings_set_updated_at
  before update on public.client_portal_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Accès des contacts et partages, colonnes additives
-- -----------------------------------------------------------------------------

alter table public.customer_contacts
  add column if not exists portal_enabled      boolean not null default false,
  add column if not exists portal_last_seen_at timestamptz;

alter table public.intervention_attachments
  add column if not exists shared_with_client boolean not null default false,
  add column if not exists shared_at          timestamptz,
  add column if not exists shared_by          uuid references auth.users (id) on delete set null;

alter table public.organization_documents
  add column if not exists shared_with_client boolean not null default false;

-- Le portail cherche « les contacts portail de cette adresse » à chaque
-- requête : sans index, chaque lecture balaierait la table.
create index if not exists customer_contacts_portal_email_idx
  on public.customer_contacts (lower(email))
  where portal_enabled;

create index if not exists intervention_attachments_shared_idx
  on public.intervention_attachments (intervention_id)
  where shared_with_client;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
--
--   client_portal.view    voir l'état du portail et les conversations
--   client_message.send   écrire à un client
--   client_content.share  partager ou retirer une photo, un document
--   client_portal.manage  régler le portail, accorder ou révoquer un accès
--
-- Le technicien peut PARTAGER : c'est lui qui prend les photos, et lui imposer
-- de passer par un responsable rendrait le geste assez pénible pour qu'il ne
-- soit jamais fait. Il ne règle rien et n'accorde aucun accès.

insert into public.role_permissions (role, permission) values
  ('owner', 'client_portal.view'), ('owner', 'client_message.send'),
  ('owner', 'client_content.share'), ('owner', 'client_portal.manage'),
  ('admin', 'client_portal.view'), ('admin', 'client_message.send'),
  ('admin', 'client_content.share'), ('admin', 'client_portal.manage'),
  ('manager', 'client_portal.view'), ('manager', 'client_message.send'),
  ('manager', 'client_content.share'), ('manager', 'client_portal.manage'),
  ('team_leader', 'client_portal.view'), ('team_leader', 'client_message.send'),
  ('team_leader', 'client_content.share'),
  ('technician', 'client_portal.view'), ('technician', 'client_content.share')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Formule
-- -----------------------------------------------------------------------------
--
-- Pro, Business et Enterprise, sur décision de l'exploitant du 13/09/2026.
-- Starter en est exclu pour l'instant. Les trois codes sont écrits en toutes
-- lettres pour rester lisibles par `entitlements.test.ts`.

insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('pro', 'client_portal', null),
  ('business', 'client_portal', null),
  ('enterprise', 'client_portal', null)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Gardes par trigger : la colonne, pas la ligne
-- -----------------------------------------------------------------------------

-- Seules les colonnes de partage peuvent changer par ce chemin. Toute autre
-- modification d'une pièce jointe passe par la suppression et le dépôt.
create or replace function app.guard_attachment_share_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.intervention_id is distinct from old.intervention_id
     or new.organization_id is distinct from old.organization_id
     or new.kind is distinct from old.kind
     or new.storage_path is distinct from old.storage_path
     or new.file_name is distinct from old.file_name
     or new.mime_type is distinct from old.mime_type
     or new.size_bytes is distinct from old.size_bytes
     or new.uploaded_by is distinct from old.uploaded_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Seul le partage d''une pièce jointe peut être modifié.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.shared_with_client is distinct from old.shared_with_client then
    if not app.has_org_permission(new.organization_id, 'client_content.share') then
      raise exception 'Partager une pièce jointe exige la permission client_content.share.'
        using errcode = 'insufficient_privilege';
    end if;
    new.shared_at := case when new.shared_with_client then now() else null end;
    new.shared_by := case when new.shared_with_client then (select auth.uid()) else null end;
  end if;

  return new;
end;
$$;

revoke all on function app.guard_attachment_share_update() from public, anon, authenticated;

create trigger intervention_attachments_guard_share
  before update on public.intervention_attachments
  for each row execute function app.guard_attachment_share_update();

-- Accorder l'accès au portail n'est pas modifier un contact : c'est ouvrir une
-- porte. La permission est distincte de `customer.update`.
create or replace function app.guard_contact_portal_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.portal_enabled is distinct from old.portal_enabled
     and not app.has_org_permission(new.organization_id, 'client_portal.manage') then
    raise exception 'Modifier l''accès au portail exige la permission client_portal.manage.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

revoke all on function app.guard_contact_portal_update() from public, anon, authenticated;

create trigger customer_contacts_guard_portal
  before update on public.customer_contacts
  for each row execute function app.guard_contact_portal_update();

-- Partager un document exige la même permission que partager une photo, même
-- si `document.manage` autorise déjà la modification du document.
create or replace function app.guard_document_share_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.shared_with_client is distinct from old.shared_with_client
     and not app.has_org_permission(new.organization_id, 'client_content.share') then
    raise exception 'Partager un document exige la permission client_content.share.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

revoke all on function app.guard_document_share_update() from public, anon, authenticated;

create trigger organization_documents_guard_share
  before update on public.organization_documents
  for each row execute function app.guard_document_share_update();

-- -----------------------------------------------------------------------------
-- Journal d'audit : chaque geste qui ouvre ou ferme une porte
-- -----------------------------------------------------------------------------

create or replace function app.audit_portal_sharing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'customer_contacts' then
    if new.portal_enabled is distinct from old.portal_enabled then
      perform app.write_audit_log(
        new.organization_id,
        case when new.portal_enabled then 'portal.access_granted' else 'portal.access_revoked' end,
        'customer_contact', new.id,
        jsonb_build_object('customer_id', new.customer_id)
      );
    end if;
  elsif tg_table_name = 'intervention_attachments' then
    if new.shared_with_client is distinct from old.shared_with_client then
      perform app.write_audit_log(
        new.organization_id,
        case when new.shared_with_client then 'portal.attachment_shared' else 'portal.attachment_unshared' end,
        'intervention_attachment', new.id,
        jsonb_build_object('intervention_id', new.intervention_id, 'kind', new.kind)
      );
    end if;
  elsif tg_table_name = 'organization_documents' then
    if new.shared_with_client is distinct from old.shared_with_client then
      perform app.write_audit_log(
        new.organization_id,
        case when new.shared_with_client then 'portal.document_shared' else 'portal.document_unshared' end,
        'organization_document', new.id,
        jsonb_build_object('category', new.category)
      );
    end if;
  elsif tg_table_name = 'client_portal_settings' then
    perform app.write_audit_log(
      new.organization_id,
      case when tg_op = 'INSERT' then 'portal.settings_created' else 'portal.settings_updated' end,
      'client_portal_settings', new.organization_id,
      jsonb_build_object('enabled', new.enabled, 'allow_client_initiated', new.allow_client_initiated)
    );
  end if;
  return new;
end;
$$;

revoke all on function app.audit_portal_sharing() from public, anon, authenticated;

create trigger customer_contacts_audit_portal
  after update on public.customer_contacts
  for each row execute function app.audit_portal_sharing();

create trigger intervention_attachments_audit_share
  after update on public.intervention_attachments
  for each row execute function app.audit_portal_sharing();

create trigger organization_documents_audit_share
  after update on public.organization_documents
  for each row execute function app.audit_portal_sharing();

create trigger client_portal_settings_audit
  after insert or update on public.client_portal_settings
  for each row execute function app.audit_portal_sharing();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.client_portal_settings enable row level security;
revoke all on public.client_portal_settings from public, anon, authenticated;
grant select, insert, update on public.client_portal_settings to authenticated;

create policy "client_portal_settings_select"
  on public.client_portal_settings for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'client_portal')));

create policy "client_portal_settings_insert"
  on public.client_portal_settings for insert to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'client_portal'))
    and (select app.has_org_permission(organization_id, 'client_portal.manage'))
  );

create policy "client_portal_settings_update"
  on public.client_portal_settings for update to authenticated
  using ((select app.has_org_permission(organization_id, 'client_portal.manage')))
  with check ((select app.has_org_permission(organization_id, 'client_portal.manage')));

-- La table n'avait aucune policy UPDATE : le partage passe par celle-ci, et le
-- trigger ci-dessus borne ce qu'elle laisse changer.
create policy "intervention_attachments_update_share"
  on public.intervention_attachments for update to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'client_portal'))
    and (select app.has_org_permission(organization_id, 'client_content.share'))
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'client_portal'))
    and (select app.has_org_permission(organization_id, 'client_content.share'))
  );

-- -----------------------------------------------------------------------------
-- Contrôles
-- -----------------------------------------------------------------------------

do $$
declare v integer;
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'client_portal_settings' and c.relrowsecurity) then
    raise exception 'RLS absente sur client_portal_settings.';
  end if;

  select count(*) into v from public.role_permissions where permission like 'client_%';
  if v <> 17 then raise exception 'Permissions du portail : % au lieu de 17.', v; end if;

  select count(*) into v from public.plan_features where feature_key = 'client_portal';
  if v <> 3 then raise exception 'client_portal accordé à % formule(s) au lieu de 3.', v; end if;

  if exists (select 1 from public.plan_features where feature_key = 'client_portal' and plan_code in ('free', 'starter')) then
    raise exception 'client_portal ne doit être accordé ni à free ni à starter.';
  end if;

  -- Privé par défaut : aucune ligne existante ne doit avoir été ouverte.
  if exists (select 1 from public.customer_contacts where portal_enabled) then
    raise exception 'Un contact a un accès portail alors qu''aucun n''a été accordé.';
  end if;
  if exists (select 1 from public.intervention_attachments where shared_with_client)
     or exists (select 1 from public.organization_documents where shared_with_client) then
    raise exception 'Un contenu est partagé alors qu''aucun partage n''a été fait.';
  end if;
end
$$;

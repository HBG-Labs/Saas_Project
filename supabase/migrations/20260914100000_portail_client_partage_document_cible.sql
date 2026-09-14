-- =============================================================================
-- Portail client — partage d'un document avec UN client (et non tous)
-- =============================================================================
--
-- La bibliothèque est au niveau de l'entreprise : `shared_with_client` y
-- signifiait « visible dans tous les espaces clients ». Juste pour des CGV ou
-- une attestation ; faux pour le plan du site d'un client, qu'aucun autre ne
-- doit voir. Cette migration ajoute le partage ciblé, sans retirer le partage
-- général — les deux se lisent ensemble :
--
--   visible pour un contact  ⇔  shared_with_client
--                              OU catégorie ouverte
--                              OU une ligne de partage vers SON client
--
-- Le partage ciblé est une table, pas une colonne : un document peut être
-- partagé avec plusieurs clients, et chaque partage est révocable seul.
-- =============================================================================

create table public.organization_document_shares (
  document_id      uuid not null references public.organization_documents (id) on delete cascade,
  customer_id      uuid not null references public.customers (id) on delete cascade,
  -- Dénormalisé pour les policies. ÉCRASÉ PAR TRIGGER depuis le document.
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  shared_by        uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  primary key (document_id, customer_id)
);

create index organization_document_shares_customer_idx
  on public.organization_document_shares (customer_id);

comment on table public.organization_document_shares is
  'Partage ciblé d''un document de la bibliothèque avec un client du portail. Une ligne = un client qui le voit.';

-- L'organisation vient du document ; le client doit être de la même. Le
-- partage exige `client_content.share`, comme les photos et le partage général.
create or replace function app.enforce_document_share()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.organization_documents where id = new.document_id;
  if v_org is null then
    raise exception 'Document introuvable.' using errcode = 'foreign_key_violation';
  end if;
  if not exists (select 1 from public.customers c where c.id = new.customer_id and c.organization_id = v_org) then
    raise exception 'Le client n''appartient pas à l''organisation du document.' using errcode = 'check_violation';
  end if;
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
     and not app.has_org_permission(v_org, 'client_content.share') then
    raise exception 'Partager un document exige la permission client_content.share.'
      using errcode = 'insufficient_privilege';
  end if;
  new.organization_id := v_org;
  new.shared_by := coalesce((select auth.uid()), new.shared_by);
  return new;
end;
$$;

revoke all on function app.enforce_document_share() from public, anon, authenticated;

create trigger organization_document_shares_enforce
  before insert on public.organization_document_shares
  for each row execute function app.enforce_document_share();

-- Retirer un partage exige la même permission que le donner.
create or replace function app.guard_document_share_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
     and not app.has_org_permission(old.organization_id, 'client_content.share') then
    raise exception 'Retirer un partage exige la permission client_content.share.'
      using errcode = 'insufficient_privilege';
  end if;
  return old;
end;
$$;

revoke all on function app.guard_document_share_delete() from public, anon, authenticated;

create trigger organization_document_shares_guard_delete
  before delete on public.organization_document_shares
  for each row execute function app.guard_document_share_delete();

-- Journal : le fait, jamais le contenu.
create or replace function app.audit_document_share()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_audit_log(new.organization_id, 'portal.document_shared', 'organization_document', new.document_id,
      jsonb_build_object('customer_id', new.customer_id, 'scope', 'customer'));
    return new;
  end if;
  perform app.write_audit_log(old.organization_id, 'portal.document_unshared', 'organization_document', old.document_id,
    jsonb_build_object('customer_id', old.customer_id, 'scope', 'customer'));
  return old;
end;
$$;

revoke all on function app.audit_document_share() from public, anon, authenticated;

create trigger organization_document_shares_audit
  after insert or delete on public.organization_document_shares
  for each row execute function app.audit_document_share();

-- RLS : lecture pour qui voit la bibliothèque ; écriture pour qui partage.
-- Le contact du portail n'a aucun droit direct : il lit via `portal_*`.
alter table public.organization_document_shares enable row level security;
revoke all on public.organization_document_shares from public, anon, authenticated;
grant select, insert, delete on public.organization_document_shares to authenticated;

create policy "organization_document_shares_select"
  on public.organization_document_shares for select to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'documents'))
    and (select app.has_org_permission(organization_id, 'document.view'))
  );

create policy "organization_document_shares_insert"
  on public.organization_document_shares for insert to authenticated
  with check (
    organization_id in (select app.my_organization_ids())
    and (select app.has_org_permission(organization_id, 'client_content.share'))
  );

create policy "organization_document_shares_delete"
  on public.organization_document_shares for delete to authenticated
  using ((select app.has_org_permission(organization_id, 'client_content.share')));

-- -----------------------------------------------------------------------------
-- Lecture portail : les trois chemins de visibilité
-- -----------------------------------------------------------------------------

create or replace function public.portal_list_documents()
returns table (
  id               uuid,
  organization_id  uuid,
  name             text,
  category         text,
  mime_type        text,
  file_size        bigint,
  storage_path     text,
  created_at       timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.organization_id, d.name, d.category, d.mime_type, d.file_size, d.storage_path, d.created_at
  from public.organization_documents d
  join public.client_portal_settings s on s.organization_id = d.organization_id
  where app.is_portal_contact()
    and app.org_has_feature(d.organization_id, 'documents')
    and d.organization_id in (
      select c.organization_id from public.customer_contacts c
      where c.id in (select app.my_portal_contact_ids())
    )
    and (
      d.shared_with_client
      or d.category = any (s.visible_document_categories)
      or exists (
        select 1 from public.organization_document_shares sh
        where sh.document_id = d.id
          and sh.customer_id in (select app.portal_customer_ids())
      )
    )
  order by d.created_at desc;
$$;

-- `portal_can_read_file` s'appuie sur `portal_list_documents()` pour ce bucket :
-- le téléchargement suit donc la même règle sans rien réécrire.

-- -----------------------------------------------------------------------------
-- Contrôles
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_class where relname = 'organization_document_shares' and relrowsecurity
  ) then
    raise exception 'RLS absente sur organization_document_shares.';
  end if;
  if exists (select 1 from public.portal_list_documents()) then
    raise exception 'portal_list_documents renvoie des lignes hors session.';
  end if;
end
$$;

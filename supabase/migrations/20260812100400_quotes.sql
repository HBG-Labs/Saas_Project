-- =============================================================================
-- Devis & chiffrage
-- =============================================================================
--
-- LE CONSTAT
--
-- L'écran « Devis Express » chiffre une intervention à partir d'un catalogue de
-- prestations. Deux choses y vivaient séparément et mal :
--
--   • le catalogue de prestations, persisté dans `nexoratech_quote_catalog` —
--     donc propre au navigateur de celui qui l'a saisi ;
--   • les lignes du devis en cours, dans un simple `useState` — donc PERDUES au
--     moindre rechargement de page.
--
-- Un devis est un engagement commercial. Il se retrouve, se rouvre, se compare
-- au réalisé. Trois tables plutôt qu'une, parce que ce sont trois durées de vie
-- distinctes : le catalogue survit aux devis, le devis survit à ses lignes.
--
-- LES MONTANTS SONT EN CENTIMES
--
-- Des entiers, jamais des flottants. `0.1 + 0.2` ne vaut pas `0.3` en virgule
-- flottante, et un devis dont le total diffère d'un centime de la somme de ses
-- lignes est un devis que le client conteste. Les quantités, elles, sont
-- décimales : on tire 150,5 mètres de câble.
--
-- LE TOTAL N'EST PAS STOCKÉ
--
-- Il se recalcule à partir des lignes. Le figer obligerait à le maintenir à
-- chaque modification, et un total désynchronisé de ses lignes est pire que pas
-- de total. La vue `quote_totals` le calcule à la demande.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type public.quote_status as enum ('draft', 'sent', 'accepted', 'refused', 'expired');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- quote_templates — le catalogue de prestations
-- -----------------------------------------------------------------------------
--
-- Réutilisable d'un devis à l'autre : « Raccordement & soudure fibre, forfait,
-- 120 € ». C'est le savoir-faire tarifaire de l'entreprise, et il lui appartient
-- collectivement — pas au navigateur de la personne qui l'a saisi.
create table if not exists public.quote_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  label           text not null check (char_length(label) between 2 and 200),
  unit            text not null default 'Unité',
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  sort_order      integer not null default 0,
  status          public.content_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists quote_templates_organization_idx
  on public.quote_templates (organization_id, status, sort_order);

drop trigger if exists quote_templates_set_updated_at on public.quote_templates;
create trigger quote_templates_set_updated_at
  before update on public.quote_templates
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- quotes
-- -----------------------------------------------------------------------------
--
-- `customer_id` et `site_id` sont optionnels : on chiffre parfois avant que le
-- client n'existe en fiche. Les colonnes texte les doublent volontairement, sur
-- le même principe que les missions — un devis émis en 2026 doit continuer
-- d'afficher le nom porté par le client à cette date, même renommé depuis.
create table if not exists public.quotes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference       text not null,
  title           text,
  customer_id     uuid references public.customers (id) on delete set null,
  site_id         uuid references public.sites (id) on delete set null,
  customer_name   text,
  site_name       text,
  -- Taux en pourcentage : 8.50 pour 8,5 %. La Martinique applique 8,5 %, la
  -- métropole 20 % ; la valeur ne peut donc pas être une constante du code.
  vat_rate        numeric(5, 2) not null default 20 check (vat_rate >= 0 and vat_rate <= 100),
  status          public.quote_status not null default 'draft',
  notes           text,
  valid_until     date,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (organization_id, reference)
);

create index if not exists quotes_organization_idx
  on public.quotes (organization_id, status, created_at desc);

create index if not exists quotes_customer_idx
  on public.quotes (customer_id)
  where customer_id is not null;

drop trigger if exists quotes_set_updated_at on public.quotes;
create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

drop trigger if exists quotes_organization_immutable on public.quotes;
create trigger quotes_organization_immutable
  before update on public.quotes
  for each row execute function app.enforce_organization_immutable();

-- Référence lisible, remise à 1 par organisation — même raisonnement que
-- `CLI-nnnn` pour les clients et `AAAA-NNNN` pour les missions.
create or replace function app.generate_quote_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
begin
  if new.reference is not null and new.reference <> '' then
    return new;
  end if;

  select coalesce(max(substring(reference from '\d+$')::integer), 0) + 1
  into v_next
  from public.quotes
  where organization_id = new.organization_id
    and reference like 'DEV-%';

  new.reference := 'DEV-' || lpad(v_next::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists quotes_generate_reference on public.quotes;
create trigger quotes_generate_reference
  before insert on public.quotes
  for each row execute function app.generate_quote_reference();

-- Le client et le site désignés appartiennent bien à cette organisation.
create or replace function app.enforce_quote_customer_site()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if new.customer_id is not null then
    select c.organization_id into v_org from public.customers c where c.id = new.customer_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Ce client n''appartient pas à cette organisation.'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  if new.site_id is not null then
    select s.organization_id into v_org from public.sites s where s.id = new.site_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Ce site n''appartient pas à cette organisation.'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists quotes_customer_site_guard on public.quotes;
create trigger quotes_customer_site_guard
  before insert or update on public.quotes
  for each row execute function app.enforce_quote_customer_site();

-- -----------------------------------------------------------------------------
-- quote_items
-- -----------------------------------------------------------------------------
--
-- La ligne COPIE le libellé et le prix du modèle plutôt que d'y pointer :
-- augmenter un tarif au catalogue ne doit pas réécrire les devis déjà émis.
create table if not exists public.quote_items (
  id               uuid primary key default gen_random_uuid(),
  quote_id         uuid not null references public.quotes (id) on delete cascade,
  -- Dénormalisé pour que les policies filtrent sans jointure. ÉCRASÉ PAR TRIGGER.
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  description      text not null check (char_length(description) between 1 and 300),
  unit             text not null default 'Unité',
  quantity         numeric(12, 3) not null default 1 check (quantity >= 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  position         integer not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists quote_items_quote_idx
  on public.quote_items (quote_id, position);

create or replace function app.enforce_quote_item_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select q.organization_id into new.organization_id
  from public.quotes q
  where q.id = new.quote_id;

  if new.organization_id is null then
    raise exception 'Devis introuvable.' using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists quote_items_enforce_org on public.quote_items;
create trigger quote_items_enforce_org
  before insert or update on public.quote_items
  for each row execute function app.enforce_quote_item_org();

-- -----------------------------------------------------------------------------
-- Totaux
-- -----------------------------------------------------------------------------
--
-- Une vue, pas des colonnes : le total est une CONSÉQUENCE des lignes, pas une
-- donnée à maintenir. Les vues héritent des policies des tables qu'elles
-- interrogent — rien à sécuriser ici de plus.
--
-- Les centimes sont sommés en entier puis arrondis une seule fois pour la TVA.
-- Arrondir ligne à ligne ferait dériver le total de quelques centimes.
create or replace view public.quote_totals
with (security_invoker = true)
as
select
  q.id as quote_id,
  q.organization_id,
  coalesce(sum(round(i.quantity * i.unit_price_cents))::bigint, 0) as subtotal_cents,
  round(coalesce(sum(round(i.quantity * i.unit_price_cents)), 0) * q.vat_rate / 100)::bigint as vat_cents,
  round(
    coalesce(sum(round(i.quantity * i.unit_price_cents)), 0) * (1 + q.vat_rate / 100)
  )::bigint as total_cents
from public.quotes q
left join public.quote_items i on i.quote_id = q.id
group by q.id, q.organization_id, q.vat_rate;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
--
-- Le chiffrage est un acte commercial : il suit le portefeuille client. Le chef
-- d'équipe consulte — il prépare des interventions à partir d'un devis accepté —
-- sans pouvoir modifier les prix. Le technicien n'y a pas accès : les tarifs de
-- l'entreprise ne le regardent pas, exactement comme le fichier client.
insert into public.role_permissions (role, permission) values
  ('owner',       'quote.view'),
  ('owner',       'quote.manage'),
  ('admin',       'quote.view'),
  ('admin',       'quote.manage'),
  ('manager',     'quote.view'),
  ('manager',     'quote.manage'),
  ('team_leader', 'quote.view')
on conflict (role, permission) do nothing;

insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('business', 'quotes', null),
  ('ultimate', 'quotes', null)
on conflict (plan_code, feature_key) do update set
  limit_value = excluded.limit_value;

-- -----------------------------------------------------------------------------
-- Privilèges et RLS
-- -----------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array['quote_templates', 'quotes', 'quote_items'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', v_table);
    execute format('grant select, insert, update, delete on public.%I to authenticated', v_table);
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end
$$;

revoke all on public.quote_totals from public, anon, authenticated;
grant select on public.quote_totals to authenticated;

-- ------------------------------------------------------------ quote_templates
drop policy if exists "quote_templates_select" on public.quote_templates;
create policy "quote_templates_select"
  on public.quote_templates for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'quotes'))
    and (select app.has_org_permission(organization_id, 'quote.view'))
  );

drop policy if exists "quote_templates_insert" on public.quote_templates;
create policy "quote_templates_insert"
  on public.quote_templates for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'quotes'))
    and (select app.has_org_permission(organization_id, 'quote.manage'))
  );

drop policy if exists "quote_templates_update" on public.quote_templates;
create policy "quote_templates_update"
  on public.quote_templates for update
  to authenticated
  using ((select app.has_org_permission(organization_id, 'quote.manage')))
  with check ((select app.has_org_permission(organization_id, 'quote.manage')));

drop policy if exists "quote_templates_delete" on public.quote_templates;
create policy "quote_templates_delete"
  on public.quote_templates for delete
  to authenticated
  using ((select app.has_org_permission(organization_id, 'quote.manage')));

-- --------------------------------------------------------------------- quotes
drop policy if exists "quotes_select" on public.quotes;
create policy "quotes_select"
  on public.quotes for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'quotes'))
    and (select app.has_org_permission(organization_id, 'quote.view'))
  );

drop policy if exists "quotes_insert" on public.quotes;
create policy "quotes_insert"
  on public.quotes for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'quotes'))
    and (select app.has_org_permission(organization_id, 'quote.manage'))
  );

drop policy if exists "quotes_update" on public.quotes;
create policy "quotes_update"
  on public.quotes for update
  to authenticated
  using ((select app.has_org_permission(organization_id, 'quote.manage')))
  with check ((select app.has_org_permission(organization_id, 'quote.manage')));

drop policy if exists "quotes_delete" on public.quotes;
create policy "quotes_delete"
  on public.quotes for delete
  to authenticated
  using ((select app.has_org_permission(organization_id, 'quote.manage')));

-- ---------------------------------------------------------------- quote_items
drop policy if exists "quote_items_select" on public.quote_items;
create policy "quote_items_select"
  on public.quote_items for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'quotes'))
    and (select app.has_org_permission(organization_id, 'quote.view'))
  );

-- `organization_id` est écrasé par trigger DEPUIS le devis parent : la condition
-- porte donc sur une valeur que le client ne contrôle pas.
drop policy if exists "quote_items_insert" on public.quote_items;
create policy "quote_items_insert"
  on public.quote_items for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'quotes'))
    and (select app.has_org_permission(organization_id, 'quote.manage'))
  );

drop policy if exists "quote_items_update" on public.quote_items;
create policy "quote_items_update"
  on public.quote_items for update
  to authenticated
  using ((select app.has_org_permission(organization_id, 'quote.manage')))
  with check ((select app.has_org_permission(organization_id, 'quote.manage')));

drop policy if exists "quote_items_delete" on public.quote_items;
create policy "quote_items_delete"
  on public.quote_items for delete
  to authenticated
  using ((select app.has_org_permission(organization_id, 'quote.manage')));

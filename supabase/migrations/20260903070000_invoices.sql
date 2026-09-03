-- =============================================================================
-- Factures
-- =============================================================================
--
-- CE QUI N'EXISTAIT PAS
--
-- REZO360 savait établir des devis, pas des factures. Aucune table, aucune
-- permission `invoice.*`, aucune route : le mot « facturation » ne désignait
-- jusqu'ici que l'abonnement Stripe de l'entreprise elle-même.
--
-- La facturation électronique obligatoire impose de combler ce manque d'abord :
-- réception obligatoire depuis le 1er septembre 2026 pour tout assujetti à la
-- TVA, émission obligatoire au 1er septembre 2027 pour les TPE et PME — soit
-- exactement les clients de REZO360.
--
-- POURQUOI DES TABLES DÉDIÉES ET NON UN CHAMP `type` SUR `quotes`
--
-- Un devis se modifie, se supprime, se renumérote sans conséquence. Une facture
-- émise, non : sa numérotation doit être séquentielle et sans trou, son contenu
-- ne change plus, et elle se conserve dix ans. Porter les deux régimes sur une
-- même table obligerait à conditionner chaque écriture, chaque policy et chaque
-- trigger sur une colonne — et la première condition oubliée rendrait une
-- facture modifiable.
--
-- CE QUI EST REPRIS DES DEVIS, ET CE QUI NE L'EST PAS
--
-- Repris : montants en centimes entiers, totaux non stockés mais calculés par
-- vue, instantané du nom du client, `organization_id` dénormalisé sur les lignes
-- et écrasé par trigger, une policy par verbe.
--
-- Pas repris : la numérotation. Celle des devis fait `max(...) + 1` sans verrou.
-- Deux enregistrements simultanés calculent le même numéro — l'unicité les fait
-- échouer sans réessai — et supprimer le dernier devis FAIT RÉGRESSER le
-- compteur, qui réattribue alors un numéro déjà utilisé. Tolérable sur un devis,
-- inacceptable sur une facture.
--
-- Pas repris non plus : le taux de TVA unique par document. La norme EN 16931
-- exige une ventilation par taux, et un artisan facture couramment 8,5 % de
-- main-d'œuvre et 20 % de fournitures sur la même facture.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    -- `sent` dit que le document est PARTI chez le client, pas qu'il a été
    -- transmis à une plateforme agréée : le statut de transmission électronique
    -- vivra dans ses propres colonnes, et un document peut être réglé sans
    -- jamais avoir transité par une plateforme.
    create type public.invoice_status as enum
      ('draft', 'issued', 'sent', 'paid', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'invoice_document_type') then
    create type public.invoice_document_type as enum ('invoice', 'credit_note');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- invoice_counters — la numérotation, sérialisée
-- -----------------------------------------------------------------------------
--
-- Une ligne par organisation, année et nature de document. Le numéro ne se
-- déduit pas des factures existantes : il se PRÉLÈVE ici, et le verrou de ligne
-- que pose la mise à jour sérialise les demandes concurrentes au lieu de les
-- faire échouer.
--
-- Conséquence voulue : une transaction annulée rend son numéro, puisque le
-- compteur est annulé avec elle. C'est ce qui garantit l'absence de trou.
create table if not exists public.invoice_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  year            integer not null check (year between 2000 and 2999),
  document_type   public.invoice_document_type not null,
  last_value      integer not null default 0 check (last_value >= 0),
  updated_at      timestamptz not null default now(),

  primary key (organization_id, year, document_type)
);

-- -----------------------------------------------------------------------------
-- invoices
-- -----------------------------------------------------------------------------
--
-- L'IDENTITÉ DU CLIENT EST RECOPIÉE, PAS SEULEMENT POINTÉE
--
-- `customer_id` est en `on delete set null`, et une fiche client se renomme,
-- déménage, change de numéro de TVA. Une facture émise doit continuer d'énoncer
-- ce qui était vrai le jour de son émission : c'est une exigence comptable, et
-- la norme EN 16931 réclame ces mentions dans les données structurées. D'où les
-- colonnes `customer_*`, figées à l'émission.
--
-- L'identité du VENDEUR n'est pas encore recopiée ici : les champs qui lui
-- manquent (SIREN distinct du SIRET, code APE, forme juridique, IBAN) n'existent
-- pas encore sur `organizations`. Les figer maintenant reviendrait à figer des
-- trous. Ce sera l'objet de la migration qui les ajoute.
create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference       text not null,
  document_type   public.invoice_document_type not null default 'invoice',

  -- Un avoir corrige une facture précise. `restrict` et non `cascade` : on ne
  -- supprime pas une facture qu'un avoir référence.
  corrects_invoice_id uuid references public.invoices (id) on delete restrict,

  title           text,
  customer_id     uuid references public.customers (id) on delete set null,
  site_id         uuid references public.sites (id) on delete set null,
  quote_id        uuid references public.quotes (id) on delete set null,

  -- Instantané du destinataire, figé à l'émission.
  customer_name                text,
  customer_legal_name          text,
  customer_registration_number text,
  customer_vat_number          text,
  customer_address_line1       text,
  customer_address_line2       text,
  customer_postal_code         text,
  customer_city                text,
  customer_country             text,
  site_name                    text,

  currency        text not null default 'EUR' check (char_length(currency) = 3),
  status          public.invoice_status not null default 'draft',

  -- Date d'émission : ce qui fige le document. Nulle tant qu'il est brouillon.
  issued_at       timestamptz,
  due_date        date,

  payment_terms   text,
  payment_method  text,
  notes           text,

  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (organization_id, reference),

  -- Un document qui n'est plus brouillon porte forcément sa date d'émission :
  -- sans elle, ni l'échéance, ni l'exercice comptable, ni le numéro ne veulent
  -- dire quoi que ce soit.
  constraint invoices_issued_needs_date
    check (status = 'draft' or issued_at is not null),

  -- Une échéance antérieure à l'émission n'a pas de sens.
  constraint invoices_due_after_issue
    check (due_date is null or issued_at is null or due_date >= (issued_at at time zone 'UTC')::date),

  -- Un avoir désigne la facture qu'il corrige ; une facture ne corrige rien.
  constraint invoices_credit_note_target
    check (document_type = 'credit_note' or corrects_invoice_id is null)
);

create index if not exists invoices_organization_idx
  on public.invoices (organization_id, status, issued_at desc nulls last);

create index if not exists invoices_customer_idx
  on public.invoices (customer_id)
  where customer_id is not null;

create index if not exists invoices_quote_idx
  on public.invoices (quote_id)
  where quote_id is not null;

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

drop trigger if exists invoices_organization_immutable on public.invoices;
create trigger invoices_organization_immutable
  before update on public.invoices
  for each row execute function app.enforce_organization_immutable();

-- -----------------------------------------------------------------------------
-- Numérotation
-- -----------------------------------------------------------------------------
--
-- `FAC-AAAA-NNNNN`, remis à 1 chaque année et par organisation. Les avoirs ont
-- leur propre série, `AV-AAAA-NNNNN` : mélanger les deux dans une même
-- séquence rendrait la numérotation des factures non continue.
--
-- L'UPSERT EST LE VERROU
--
-- Une seule instruction : elle insère la ligne de compteur si elle manque, ou
-- l'incrémente si elle existe, et rend la valeur retenue. Sur conflit,
-- PostgreSQL verrouille la ligne — une transaction concurrente ATTEND au lieu
-- de lire une valeur périmée. C'est ce qui distingue ce compteur du `max() + 1`
-- des devis, où deux insertions simultanées obtiennent le même numéro.
create or replace function app.generate_invoice_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year   integer;
  v_next   integer;
  v_prefix text;
begin
  if new.reference is not null and new.reference <> '' then
    return new;
  end if;

  -- L'année de la date d'émission, ou celle du jour tant que le document est un
  -- brouillon. Un brouillon créé en décembre et émis en janvier sera renuméroté
  -- à l'émission, c'est ce que l'on veut.
  v_year := extract(year from coalesce(new.issued_at, now()))::integer;
  v_prefix := case when new.document_type = 'credit_note' then 'AV' else 'FAC' end;

  insert into public.invoice_counters as c (organization_id, year, document_type, last_value)
  values (new.organization_id, v_year, new.document_type, 1)
  on conflict (organization_id, year, document_type)
    do update set last_value = c.last_value + 1, updated_at = now()
  returning c.last_value into v_next;

  new.reference := v_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 5, '0');
  return new;
end;
$$;

drop trigger if exists invoices_generate_reference on public.invoices;
create trigger invoices_generate_reference
  before insert on public.invoices
  for each row execute function app.generate_invoice_reference();

-- Le client, le site et le devis désignés appartiennent bien à l'organisation.
create or replace function app.enforce_invoice_relations()
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

  if new.quote_id is not null then
    select q.organization_id into v_org from public.quotes q where q.id = new.quote_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Ce devis n''appartient pas à cette organisation.'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  if new.corrects_invoice_id is not null then
    select f.organization_id into v_org from public.invoices f where f.id = new.corrects_invoice_id;
    if v_org is distinct from new.organization_id then
      raise exception 'La facture corrigée n''appartient pas à cette organisation.'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_relations_guard on public.invoices;
create trigger invoices_relations_guard
  before insert or update on public.invoices
  for each row execute function app.enforce_invoice_relations();

-- -----------------------------------------------------------------------------
-- Immuabilité
-- -----------------------------------------------------------------------------
--
-- Un brouillon se modifie librement. Une facture ÉMISE ne change plus : on la
-- corrige par un avoir. La règle vit ici et non dans l'application, parce
-- qu'une règle applicative ne protège que les chemins qui pensent à l'appeler.
--
-- ON DÉCLARE CE QUI RESTE MODIFIABLE, PAS CE QUI EST FIGÉ
--
-- La première version faisait l'inverse : une longue liste de colonnes à
-- comparer une à une. La suite de tests l'a prise en défaut dès son premier
-- passage — `title` manquait à l'appel, et le titre d'une facture émise se
-- modifiait donc librement. `notes`, `site_name` et `quote_id` manquaient
-- aussi.
--
-- Ce n'était pas un oubli isolé mais un sens de lecture dangereux : toute
-- colonne ajoutée par la suite serait modifiable jusqu'à ce que quelqu'un pense
-- à l'inscrire dans la liste. Pour un document légal, le défaut sûr est
-- l'inverse.
--
-- La comparaison porte donc sur la ligne ENTIÈRE, moins les colonnes
-- explicitement autorisées. Une colonne ajoutée demain sera figée sans que
-- personne n'ait à y penser ; la rendre modifiable devient un acte délibéré,
-- ce qu'il doit être.
create or replace function app.enforce_invoice_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- `status` doit pouvoir passer à `sent`, `paid` ou `cancelled` : faire vivre
  -- le document n'est pas le modifier. `updated_at` est posé par un autre
  -- trigger. Les phases suivantes ajouteront ici le règlement et la
  -- transmission électronique — chaque ajout étant une décision, pas un effet
  -- de bord.
  v_modifiables constant text[] := array['status', 'updated_at'];
  v_avant jsonb;
  v_apres jsonb;
begin
  if old.status = 'draft' then
    return new;
  end if;

  v_avant := to_jsonb(old) - v_modifiables;
  v_apres := to_jsonb(new) - v_modifiables;

  if v_avant is distinct from v_apres then
    raise exception
      'Facture % déjà émise : son contenu ne peut plus être modifié. Émettez un avoir.',
      old.reference
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_immutable on public.invoices;
create trigger invoices_immutable
  before update on public.invoices
  for each row execute function app.enforce_invoice_immutable();

-- Une facture émise ne se supprime pas. `cancelled` la neutralise sans effacer
-- le numéro, ce qui préserve la continuité de la série.
create or replace function app.enforce_invoice_undeletable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception
      'Facture % déjà émise : elle ne peut pas être supprimée. Annulez-la ou émettez un avoir.',
      old.reference
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists invoices_undeletable on public.invoices;
create trigger invoices_undeletable
  before delete on public.invoices
  for each row execute function app.enforce_invoice_undeletable();

-- -----------------------------------------------------------------------------
-- invoice_items
-- -----------------------------------------------------------------------------
--
-- LA TVA EST PORTÉE PAR LA LIGNE, PAS PAR LE DOCUMENT
--
-- C'est la différence de fond avec `quote_items`. Un artisan facture 8,5 % de
-- main-d'œuvre et 20 % de fournitures sur la même facture, et EN 16931 impose
-- une ventilation par taux.
--
-- `vat_category` reprend les codes UNCL5305 de la norme : S standard, Z taux
-- zéro, E exonéré, AE autoliquidation, K livraison intracommunautaire, G
-- exportation, O hors champ. La colonne existe dès maintenant parce qu'un code
-- absent ne se reconstitue pas après coup.
--
-- CE QUI N'EST PAS CONTRAINT ICI, DÉLIBÉRÉMENT
--
-- Qu'un motif d'exonération accompagne un code E ou AE est une règle
-- réglementaire, et les règles réglementaires changent. Les figer en contrainte
-- obligerait à une migration à chaque évolution ; elles vivront dans la couche
-- de validation, centralisée et versionnée.
create table if not exists public.invoice_items (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references public.invoices (id) on delete cascade,
  -- Dénormalisé pour que les policies filtrent sans jointure. ÉCRASÉ PAR TRIGGER.
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  description      text not null check (char_length(description) between 1 and 300),
  unit             text not null default 'Unité',
  quantity         numeric(12, 3) not null default 1 check (quantity >= 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  vat_rate         numeric(5, 2) not null default 20 check (vat_rate >= 0 and vat_rate <= 100),
  vat_category     text not null default 'S'
                     check (vat_category in ('S', 'Z', 'E', 'AE', 'K', 'G', 'O')),
  vat_exemption_reason text,
  position         integer not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists invoice_items_invoice_idx
  on public.invoice_items (invoice_id, position);

create or replace function app.enforce_invoice_item_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.invoice_status;
begin
  select f.organization_id, f.status
    into new.organization_id, v_status
  from public.invoices f
  where f.id = new.invoice_id;

  if new.organization_id is null then
    raise exception 'Facture introuvable.' using errcode = 'foreign_key_violation';
  end if;

  -- Les lignes suivent l'immuabilité de leur facture : sans ce contrôle, on
  -- changerait les montants d'un document émis sans jamais toucher à ce
  -- document.
  if v_status <> 'draft' then
    raise exception 'Facture déjà émise : ses lignes ne peuvent plus être modifiées.'
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists invoice_items_enforce_org on public.invoice_items;
create trigger invoice_items_enforce_org
  before insert or update on public.invoice_items
  for each row execute function app.enforce_invoice_item_org();

create or replace function app.enforce_invoice_item_deletable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.invoice_status;
begin
  select f.status into v_status from public.invoices f where f.id = old.invoice_id;

  -- `null` = la facture disparaît en cascade, la ligne suit légitimement.
  if v_status is not null and v_status <> 'draft' then
    raise exception 'Facture déjà émise : ses lignes ne peuvent plus être supprimées.'
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists invoice_items_deletable on public.invoice_items;
create trigger invoice_items_deletable
  before delete on public.invoice_items
  for each row execute function app.enforce_invoice_item_deletable();

-- -----------------------------------------------------------------------------
-- Totaux
-- -----------------------------------------------------------------------------
--
-- Deux vues, parce que la facture doit montrer DEUX choses : son total, et le
-- détail de la TVA par taux.
--
-- L'ARRONDI SE FAIT PAR GROUPE DE TAUX, JAMAIS LIGNE À LIGNE
--
-- EN 16931 calcule la TVA sur la somme des bases d'un même taux. Arrondir
-- chaque ligne puis sommer donne un résultat qui diffère de quelques centimes —
-- assez pour qu'un contrôle rejette la facture, et pour qu'un client conteste.
create or replace view public.invoice_vat_breakdown
with (security_invoker = true)
as
select
  f.id as invoice_id,
  f.organization_id,
  it.vat_rate,
  it.vat_category,
  sum(round(it.quantity * it.unit_price_cents))::bigint as base_cents,
  round(sum(round(it.quantity * it.unit_price_cents)) * it.vat_rate / 100)::bigint as vat_cents
from public.invoices f
join public.invoice_items it on it.invoice_id = f.id
group by f.id, f.organization_id, it.vat_rate, it.vat_category;

create or replace view public.invoice_totals
with (security_invoker = true)
as
select
  f.id as invoice_id,
  f.organization_id,
  coalesce(b.base_cents, 0)::bigint as subtotal_cents,
  coalesce(b.vat_cents, 0)::bigint  as vat_cents,
  (coalesce(b.base_cents, 0) + coalesce(b.vat_cents, 0))::bigint as total_cents
from public.invoices f
left join (
  select invoice_id,
         sum(base_cents) as base_cents,
         sum(vat_cents)  as vat_cents
  from public.invoice_vat_breakdown
  group by invoice_id
) b on b.invoice_id = f.id;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
--
-- Même découpage que les devis, dont la facture est la suite naturelle : le
-- chef d'équipe consulte, le technicien n'y a pas accès — le chiffre d'affaires
-- de l'entreprise ne le regarde pas, exactement comme le fichier client.
insert into public.role_permissions (role, permission) values
  ('owner',       'invoice.view'),
  ('owner',       'invoice.manage'),
  ('admin',       'invoice.view'),
  ('admin',       'invoice.manage'),
  ('manager',     'invoice.view'),
  ('manager',     'invoice.manage'),
  ('team_leader', 'invoice.view')
on conflict (role, permission) do nothing;

-- `app.role_has_permission` lit une vue matérialisée : sans ce rafraîchissement,
-- les permissions ci-dessus existent en table et restent invisibles aux policies.
refresh materialized view app.role_permission_cache;

-- Disponible dès Starter, au même niveau que les devis : vendre le chiffrage
-- sans la facture qui le suit n'aurait pas de sens pour un artisan.
insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('starter',    'invoicing', null),
  ('pro',        'invoicing', null),
  ('business',   'invoicing', null),
  ('enterprise', 'invoicing', null)
on conflict (plan_code, feature_key) do update set
  limit_value = excluded.limit_value;

-- -----------------------------------------------------------------------------
-- Privilèges et RLS
-- -----------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array['invoices', 'invoice_items'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', v_table);
    execute format('grant select, insert, update, delete on public.%I to authenticated', v_table);
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end
$$;

-- Le compteur n'est jamais touché par l'application : seul le trigger de
-- numérotation y écrit, et il est `security definer`. RLS active SANS AUCUNE
-- POLICY — refus total et explicite, comme `stripe_events`.
revoke all on public.invoice_counters from public, anon, authenticated;
alter table public.invoice_counters enable row level security;

revoke all on public.invoice_totals from public, anon, authenticated;
grant select on public.invoice_totals to authenticated;

revoke all on public.invoice_vat_breakdown from public, anon, authenticated;
grant select on public.invoice_vat_breakdown to authenticated;

-- ------------------------------------------------------------------- invoices
drop policy if exists "invoices_select" on public.invoices;
create policy "invoices_select"
  on public.invoices for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'invoicing'))
    and (select app.has_org_permission(organization_id, 'invoice.view'))
  );

drop policy if exists "invoices_insert" on public.invoices;
create policy "invoices_insert"
  on public.invoices for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'invoicing'))
    and (select app.has_org_permission(organization_id, 'invoice.manage'))
  );

drop policy if exists "invoices_update" on public.invoices;
create policy "invoices_update"
  on public.invoices for update
  to authenticated
  using ((select app.has_org_permission(organization_id, 'invoice.manage')))
  with check ((select app.has_org_permission(organization_id, 'invoice.manage')));

-- La policy autorise la suppression ; le trigger `invoices_undeletable` la
-- refuse dès que le document est émis. Deux contrôles distincts : celui-ci dit
-- QUI a le droit, l'autre dit QUAND c'est encore possible.
drop policy if exists "invoices_delete" on public.invoices;
create policy "invoices_delete"
  on public.invoices for delete
  to authenticated
  using ((select app.has_org_permission(organization_id, 'invoice.manage')));

-- -------------------------------------------------------------- invoice_items
drop policy if exists "invoice_items_select" on public.invoice_items;
create policy "invoice_items_select"
  on public.invoice_items for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'invoicing'))
    and (select app.has_org_permission(organization_id, 'invoice.view'))
  );

-- `organization_id` est écrasé par trigger DEPUIS la facture parente : la
-- condition porte sur une valeur que le client ne contrôle pas.
drop policy if exists "invoice_items_insert" on public.invoice_items;
create policy "invoice_items_insert"
  on public.invoice_items for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'invoicing'))
    and (select app.has_org_permission(organization_id, 'invoice.manage'))
  );

drop policy if exists "invoice_items_update" on public.invoice_items;
create policy "invoice_items_update"
  on public.invoice_items for update
  to authenticated
  using ((select app.has_org_permission(organization_id, 'invoice.manage')))
  with check ((select app.has_org_permission(organization_id, 'invoice.manage')));

drop policy if exists "invoice_items_delete" on public.invoice_items;
create policy "invoice_items_delete"
  on public.invoice_items for delete
  to authenticated
  using ((select app.has_org_permission(organization_id, 'invoice.manage')));

-- -----------------------------------------------------------------------------
-- Garde-fou
-- -----------------------------------------------------------------------------
--
-- Un `insert ... on conflict do nothing` qui ne pose aucune ligne reussit sans
-- rien dire. On verifie donc l'etat ATTEINT.
do $$
declare
  v_manquant text;
begin
  select string_agg(attendu, ', ')
    into v_manquant
  from (
    select 'permission ' || r.role || '/' || r.permission as attendu
    from (values
      ('owner', 'invoice.view'), ('owner', 'invoice.manage'),
      ('admin', 'invoice.view'), ('admin', 'invoice.manage'),
      ('manager', 'invoice.view'), ('manager', 'invoice.manage'),
      ('team_leader', 'invoice.view')
    ) as r(role, permission)
    where not exists (
      select 1 from public.role_permissions rp
      where rp.role = r.role::public.org_role and rp.permission = r.permission
    )
  ) manquants;

  if v_manquant is not null then
    raise exception 'Permissions absentes apres migration : %', v_manquant;
  end if;

  if (select count(*) from public.plan_features
      where feature_key = 'invoicing' and limit_value is null) <> 4 then
    raise exception 'La fonctionnalite invoicing n''est pas ouverte aux quatre formules attendues.';
  end if;

  -- La vue materialisee doit reellement porter les nouvelles permissions,
  -- faute de quoi les policies refuseront tout le monde en silence.
  if not (select app.role_has_permission('owner'::public.org_role, 'invoice.manage')) then
    raise exception 'Le cache des permissions n''a pas ete rafraichi.';
  end if;
end
$$;

comment on table public.invoices is
  'Factures et avoirs. Immuables des l''emission : voir app.enforce_invoice_immutable.';
comment on table public.invoice_counters is
  'Compteur de numerotation par organisation, annee et nature. Ecrit uniquement par le trigger de numerotation.';
comment on view public.invoice_vat_breakdown is
  'Ventilation de la TVA par taux, exigee par EN 16931. Arrondi par groupe, jamais ligne a ligne.';

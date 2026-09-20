-- =============================================================================
-- Le compte client : crédits, imputations, remboursements (D4, trois cas)
-- =============================================================================
--
-- LE CONSTAT
--
-- Trois cas restaient hors du livre après 20260928090000 : le remboursement
-- d'un avoir (un interrupteur « remboursé / imputé », sans montant), son
-- imputation sur une autre facture (impossible), et le trop-perçu (refusé).
-- C'est le même problème trois fois : de l'argent ou du crédit qui existe
-- ENTRE deux factures, et qu'un règlement rattaché à une facture ne sait pas
-- poser.
--
-- LE MODÈLE
--
-- Un CRÉDIT au profit d'un client naît de deux façons : un avoir émis, ou un
-- trop-perçu accepté. Il se consomme de deux façons : IMPUTÉ sur une facture
-- (compensation, lettrage du 411, aucun mouvement de trésorerie) ou REMBOURSÉ
-- (sortie de trésorerie, 411 → 512, datée, avec mode et référence).
--
--   customer_credits      le crédit, son origine, son montant
--   credit_allocations    une imputation : crédit → facture
--   credit_refunds        un remboursement : crédit → trésorerie
--
-- Tout le reste est CALCULÉ : le solde d'un crédit, le reste dû d'une facture
-- (total − encaissé − imputé), le statut de l'avoir (« réglé » quand son crédit
-- est consommé), l'encours par client. Rien n'est stocké deux fois.
--
-- LA RÈGLE DU RATTACHEMENT
--
-- Un crédit appartient à un CLIENT — pas à un nom. Une facture ou un avoir
-- sans fiche client rattachée (`customer_id` NULL) reste possible, mais reste
-- hors du compte client : pas de crédit à l'émission de l'avoir, pas
-- d'imputation, pas de trop-perçu accepté. Pour ces documents, tout continue
-- comme avant — l'avoir garde son interrupteur. Le jour où la fiche est
-- rattachée (`link_invoice_customer`), le compte s'ouvre.
--
-- C'est la décision présentée à Harry le 20/09/2026 : obligatoire pour tout
-- ce qui touche au crédit, pas pour facturer.
--
-- LE TROP-PERÇU
--
-- Un client qui vire plus que dû n'a PAS reçu une facture fausse : l'avoir
-- serait une erreur. L'encaissement est enregistré pour ce qui solde la
-- facture, et l'excédent porté au crédit du client — SI l'appelant l'a
-- accepté explicitement (`p_accept_overpayment`). Sans cela, refus, comme
-- avant : mieux vaut refuser qu'inventer un solde négatif.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Types et tables
-- -----------------------------------------------------------------------------
create type public.customer_credit_origin as enum ('credit_note', 'overpayment');
revoke all on type public.customer_credit_origin from public, anon;
grant usage on type public.customer_credit_origin to authenticated, service_role;

create table public.customer_credits (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  customer_id      uuid not null references public.customers (id) on delete restrict,
  origin           public.customer_credit_origin not null,
  -- L'avoir qui l'a créé, ou le règlement dont il est l'excédent.
  credit_note_id   uuid references public.invoices (id) on delete restrict,
  payment_id       uuid references public.invoice_payments (id) on delete set null,
  amount_cents     bigint not null,
  note             text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),

  constraint customer_credits_amount_positive check (amount_cents > 0),
  constraint customer_credits_note_length check (note is null or length(note) <= 500),
  constraint customer_credits_origin_source check (
    (origin = 'credit_note' and credit_note_id is not null)
    or (origin = 'overpayment' and credit_note_id is null)
  ),
  -- Un avoir ne crée qu'un crédit.
  constraint customer_credits_one_per_credit_note unique (credit_note_id)
);

comment on table public.customer_credits is
  'Un crédit au profit d''un client : né d''un avoir émis ou d''un trop-perçu accepté. Son solde est calculé (customer_credit_balances).';

create index customer_credits_customer_idx on public.customer_credits (organization_id, customer_id);

create table public.credit_allocations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  credit_id        uuid not null references public.customer_credits (id) on delete cascade,
  invoice_id       uuid not null references public.invoices (id) on delete cascade,
  amount_cents     bigint not null,
  allocated_on     date not null default current_date,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),

  constraint credit_allocations_amount_positive check (amount_cents > 0),
  constraint credit_allocations_not_future check (allocated_on <= current_date)
);

comment on table public.credit_allocations is
  'Une imputation : un crédit client vient réduire le reste dû d''une facture. Aucun mouvement de trésorerie.';

create index credit_allocations_credit_idx on public.credit_allocations (credit_id);
create index credit_allocations_invoice_idx on public.credit_allocations (invoice_id);

create table public.credit_refunds (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  credit_id        uuid not null references public.customer_credits (id) on delete cascade,
  amount_cents     bigint not null,
  paid_on          date not null default current_date,
  method           public.payment_method not null default 'transfer',
  reference        text,
  note             text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint credit_refunds_amount_positive check (amount_cents > 0),
  constraint credit_refunds_not_future check (paid_on <= current_date),
  constraint credit_refunds_reference_length check (reference is null or length(reference) <= 120),
  constraint credit_refunds_note_length check (note is null or length(note) <= 500)
);

comment on table public.credit_refunds is
  'Un remboursement : un crédit client rendu en trésorerie, daté, avec mode et référence.';

create index credit_refunds_credit_idx on public.credit_refunds (credit_id);

create trigger credit_refunds_set_updated_at
  before update on public.credit_refunds
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Les soldes, calculés
-- -----------------------------------------------------------------------------
create or replace view public.customer_credit_balances
with (security_invoker = true)
as
select
  c.id                                  as credit_id,
  c.organization_id,
  c.customer_id,
  c.origin,
  c.credit_note_id,
  c.amount_cents,
  coalesce(a.allocated_cents, 0)        as allocated_cents,
  coalesce(r.refunded_cents, 0)         as refunded_cents,
  c.amount_cents - coalesce(a.allocated_cents, 0) - coalesce(r.refunded_cents, 0)
                                        as remaining_cents,
  (c.amount_cents - coalesce(a.allocated_cents, 0) - coalesce(r.refunded_cents, 0)) = 0
                                        as settled,
  c.created_at
from public.customer_credits c
left join (select credit_id, sum(amount_cents)::bigint as allocated_cents from public.credit_allocations group by credit_id) a
  on a.credit_id = c.id
left join (select credit_id, sum(amount_cents)::bigint as refunded_cents from public.credit_refunds group by credit_id) r
  on r.credit_id = c.id;

revoke all on public.customer_credit_balances from public, anon;
grant select on public.customer_credit_balances to authenticated, service_role;

-- `invoice_balances` : l'imputation entre dans le reste dû. Colonne ajoutée en
-- fin (une vue remplacée ne réordonne pas), expressions révisées.
create or replace view public.invoice_balances
with (security_invoker = true)
as
select
  f.id                         as invoice_id,
  f.organization_id,
  f.status,
  f.document_type,
  f.due_date,
  t.total_cents,
  coalesce(p.paid_cents, 0)    as paid_cents,
  case
    when f.status in ('issued', 'sent')
      then greatest(t.total_cents - coalesce(p.paid_cents, 0) - coalesce(al.allocated_cents, 0), 0)
    else 0
  end                          as remaining_cents,
  coalesce(p.payment_count, 0) as payment_count,
  p.last_paid_on,
  (f.status = 'paid' and coalesce(p.paid_cents, 0) + coalesce(al.allocated_cents, 0) < t.total_cents)
                               as settled_without_ledger,
  (f.status in ('issued', 'sent')
     and coalesce(p.paid_cents, 0) + coalesce(al.allocated_cents, 0) > 0
     and coalesce(p.paid_cents, 0) + coalesce(al.allocated_cents, 0) < t.total_cents)
                               as partially_paid,
  (f.status in ('issued', 'sent')
     and t.total_cents - coalesce(p.paid_cents, 0) - coalesce(al.allocated_cents, 0) > 0
     and f.due_date is not null
     and f.due_date < current_date)
                               as overdue,
  coalesce(al.allocated_cents, 0) as allocated_cents
from public.invoices f
join public.invoice_totals t on t.invoice_id = f.id
left join (
  select invoice_id, sum(amount_cents)::bigint as paid_cents, count(*)::int as payment_count, max(paid_on) as last_paid_on
  from public.invoice_payments group by invoice_id
) p on p.invoice_id = f.id
left join (
  select invoice_id, sum(amount_cents)::bigint as allocated_cents
  from public.credit_allocations group by invoice_id
) al on al.invoice_id = f.id
where f.document_type = 'invoice';

-- L'encours par client : ce qu'il doit, ce qu'on lui doit.
create or replace view public.customer_accounts
with (security_invoker = true)
as
select
  c.id                                       as customer_id,
  c.organization_id,
  coalesce(inv.invoiced_cents, 0)            as invoiced_cents,
  coalesce(inv.outstanding_cents, 0)         as outstanding_cents,
  coalesce(inv.overdue_cents, 0)             as overdue_cents,
  coalesce(cr.credits_remaining_cents, 0)    as credits_remaining_cents,
  coalesce(inv.outstanding_cents, 0) - coalesce(cr.credits_remaining_cents, 0)
                                             as net_position_cents
from public.customers c
left join (
  select f.customer_id,
         sum(b.total_cents) filter (where f.status in ('issued', 'sent', 'paid'))::bigint as invoiced_cents,
         sum(b.remaining_cents)::bigint as outstanding_cents,
         sum(b.remaining_cents) filter (where b.overdue)::bigint as overdue_cents
  from public.invoices f
  join public.invoice_balances b on b.invoice_id = f.id
  where f.customer_id is not null
  group by f.customer_id
) inv on inv.customer_id = c.id
left join (
  select customer_id, sum(remaining_cents)::bigint as credits_remaining_cents
  from public.customer_credit_balances group by customer_id
) cr on cr.customer_id = c.id;

revoke all on public.customer_accounts from public, anon;
grant select on public.customer_accounts to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Gardes
-- -----------------------------------------------------------------------------

create or replace function app.guard_customer_credit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_note public.invoices%rowtype;
begin
  select organization_id into v_org from public.customers where id = new.customer_id;
  if v_org is distinct from new.organization_id then
    raise exception 'Le crédit et la fiche client n''appartiennent pas à la même organisation.' using errcode = 'restrict_violation';
  end if;

  if new.credit_note_id is not null then
    select * into v_note from public.invoices where id = new.credit_note_id;
    if not found or v_note.document_type <> 'credit_note' or v_note.organization_id <> new.organization_id then
      raise exception 'Le crédit doit naître d''un avoir de la même organisation.' using errcode = 'restrict_violation';
    end if;
    if v_note.customer_id is distinct from new.customer_id then
      raise exception 'Le crédit d''un avoir appartient au client de cet avoir.' using errcode = 'restrict_violation';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
  end if;
  return new;
end;
$$;

revoke all on function app.guard_customer_credit() from public, anon, authenticated;

create trigger customer_credits_guard
  before insert or update on public.customer_credits
  for each row execute function app.guard_customer_credit();

-- Le crédit du client, verrouillé : son solde est la somme de ce qui reste
-- après imputations et remboursements, et deux consommations simultanées
-- passent l'une après l'autre.
create or replace function app.lock_credit_remaining(p_credit_id uuid, p_exclude_allocation uuid, p_exclude_refund uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credit public.customer_credits%rowtype;
  v_used   bigint;
begin
  select * into v_credit from public.customer_credits where id = p_credit_id for update;
  if not found then
    raise exception 'Crédit introuvable.' using errcode = 'foreign_key_violation';
  end if;

  select coalesce(sum(amount_cents), 0) into v_used
  from (
    select amount_cents from public.credit_allocations where credit_id = p_credit_id and (p_exclude_allocation is null or id <> p_exclude_allocation)
    union all
    select amount_cents from public.credit_refunds where credit_id = p_credit_id and (p_exclude_refund is null or id <> p_exclude_refund)
  ) u;

  return v_credit.amount_cents - v_used;
end;
$$;

revoke all on function app.lock_credit_remaining(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function app.guard_credit_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credit    public.customer_credits%rowtype;
  v_invoice   public.invoices%rowtype;
  v_remaining bigint;
  v_total     bigint;
  v_used      bigint;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Une imputation ne se modifie pas : supprimez-la et recommencez.' using errcode = 'restrict_violation';
  end if;

  v_remaining := app.lock_credit_remaining(new.credit_id, null, null);
  select * into v_credit from public.customer_credits where id = new.credit_id;
  new.organization_id := v_credit.organization_id;

  select * into v_invoice from public.invoices where id = new.invoice_id for update;
  if not found then
    raise exception 'Facture introuvable.' using errcode = 'foreign_key_violation';
  end if;
  if v_invoice.organization_id <> v_credit.organization_id then
    raise exception 'Le crédit et la facture n''appartiennent pas à la même organisation.' using errcode = 'restrict_violation';
  end if;
  if v_invoice.document_type <> 'invoice' then
    raise exception 'Un crédit ne s''impute que sur une facture, pas sur un avoir.' using errcode = 'restrict_violation';
  end if;
  if v_invoice.customer_id is null or v_invoice.customer_id <> v_credit.customer_id then
    raise exception 'Un crédit ne s''impute que sur une facture du MÊME client. Rattachez la facture à sa fiche client.' using errcode = 'restrict_violation';
  end if;
  if v_invoice.status not in ('issued', 'sent') then
    raise exception 'Facture % : une imputation ne se pose que sur une facture émise et non soldée.', v_invoice.reference using errcode = 'restrict_violation';
  end if;

  if new.amount_cents > v_remaining then
    raise exception 'Ce crédit ne dispose plus que de % c ; imputation de % c refusée.', v_remaining, new.amount_cents using errcode = 'check_violation';
  end if;

  select total_cents into v_total from public.invoice_totals where invoice_id = new.invoice_id;
  select coalesce(sum(amount_cents), 0) into v_used
  from (
    select amount_cents from public.invoice_payments where invoice_id = new.invoice_id
    union all
    select amount_cents from public.credit_allocations where invoice_id = new.invoice_id
  ) u;
  if v_used + new.amount_cents > v_total then
    raise exception 'Facture % : cette imputation dépasserait le reste dû (% c).', v_invoice.reference, v_total - v_used using errcode = 'check_violation';
  end if;

  new.created_by := coalesce(new.created_by, (select auth.uid()));
  return new;
end;
$$;

revoke all on function app.guard_credit_allocation() from public, anon, authenticated;

create trigger credit_allocations_guard
  before insert or update on public.credit_allocations
  for each row execute function app.guard_credit_allocation();

create or replace function app.guard_credit_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining bigint;
  v_org uuid;
begin
  if tg_op = 'UPDATE' and new.credit_id <> old.credit_id then
    raise exception 'Un remboursement ne change pas de crédit.' using errcode = 'restrict_violation';
  end if;

  v_remaining := app.lock_credit_remaining(new.credit_id, null, case when tg_op = 'UPDATE' then old.id else null end);
  select organization_id into v_org from public.customer_credits where id = new.credit_id;
  new.organization_id := v_org;

  if new.amount_cents > v_remaining then
    raise exception 'Ce crédit ne dispose plus que de % c ; remboursement de % c refusé.', v_remaining, new.amount_cents using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
  end if;
  return new;
end;
$$;

revoke all on function app.guard_credit_refund() from public, anon, authenticated;

create trigger credit_refunds_guard
  before insert or update on public.credit_refunds
  for each row execute function app.guard_credit_refund();

-- Le garde des règlements (20260928090000) compte désormais les imputations
-- dans le cumul : un règlement ne peut pas dépasser total − imputé.
create or replace function app.guard_invoice_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_total   bigint;
  v_cumul   bigint;
begin
  if tg_op = 'UPDATE' then
    if new.invoice_id <> old.invoice_id or new.organization_id <> old.organization_id then
      raise exception 'Un règlement ne change pas de facture.' using errcode = 'restrict_violation';
    end if;
  end if;

  select * into v_invoice from public.invoices where id = new.invoice_id for update;
  if not found then
    raise exception 'Facture introuvable.' using errcode = 'foreign_key_violation';
  end if;
  if v_invoice.organization_id <> new.organization_id then
    raise exception 'Le règlement et la facture n''appartiennent pas à la même organisation.' using errcode = 'restrict_violation';
  end if;
  if v_invoice.document_type <> 'invoice' then
    raise exception 'Avoir % : un avoir ne s''encaisse pas, il s''impute ou se rembourse.', v_invoice.reference using errcode = 'restrict_violation';
  end if;
  if v_invoice.status not in ('issued', 'sent', 'paid') then
    raise exception 'Facture % : un règlement ne s''enregistre que sur une facture émise.', v_invoice.reference using errcode = 'restrict_violation';
  end if;

  select total_cents into v_total from public.invoice_totals where invoice_id = new.invoice_id;
  select coalesce(sum(amount_cents), 0) into v_cumul
  from (
    select amount_cents from public.invoice_payments where invoice_id = new.invoice_id and (tg_op = 'INSERT' or id <> old.id)
    union all
    select amount_cents from public.credit_allocations where invoice_id = new.invoice_id
  ) u;

  if v_cumul + new.amount_cents > v_total then
    raise exception
      'Facture % : ce règlement dépasserait le total (reste dû % c, règlement % c). Un trop-perçu se porte au crédit du client (record_payment, p_accept_overpayment).',
      v_invoice.reference, v_total - v_cumul, new.amount_cents
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := (select auth.uid());
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Les statuts suivent
-- -----------------------------------------------------------------------------

-- Le statut d'une FACTURE suit règlements ET imputations (redéfinition de
-- 20260928090000 ; même fonction, attachée aussi aux imputations).
create or replace function app.sync_invoice_paid_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice_id uuid := coalesce(new.invoice_id, old.invoice_id);
  v_invoice    public.invoices%rowtype;
  v_total      bigint;
  v_cumul      bigint;
begin
  select * into v_invoice from public.invoices where id = v_invoice_id for update;
  if not found or v_invoice.document_type <> 'invoice' then
    return null;
  end if;

  select total_cents into v_total from public.invoice_totals where invoice_id = v_invoice_id;
  select coalesce(sum(amount_cents), 0) into v_cumul
  from (
    select amount_cents from public.invoice_payments where invoice_id = v_invoice_id
    union all
    select amount_cents from public.credit_allocations where invoice_id = v_invoice_id
  ) u;

  perform set_config('app.payment_sync', '1', true);
  if v_cumul >= v_total and v_invoice.status in ('issued', 'sent') then
    update public.invoices set status_before_payment = status, status = 'paid' where id = v_invoice_id;
  elsif v_cumul < v_total and v_invoice.status = 'paid' and v_invoice.status_before_payment is not null then
    update public.invoices set status = status_before_payment, status_before_payment = null where id = v_invoice_id;
  end if;
  perform set_config('app.payment_sync', '0', true);
  return null;
end;
$$;

create trigger credit_allocations_sync_invoice
  after insert or delete on public.credit_allocations
  for each row execute function app.sync_invoice_paid_status();

-- Le statut d'un AVOIR suit son crédit : consommé (imputé + remboursé) →
-- « réglé » ; un remboursement corrigé qui le fait redescendre → retour.
create or replace function app.sync_credit_note_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credit_id uuid := coalesce(new.credit_id, old.credit_id);
  v_credit    public.customer_credits%rowtype;
  v_note      public.invoices%rowtype;
  v_used      bigint;
begin
  select * into v_credit from public.customer_credits where id = v_credit_id for update;
  if not found or v_credit.credit_note_id is null then
    return null;
  end if;
  select * into v_note from public.invoices where id = v_credit.credit_note_id for update;

  select coalesce(sum(amount_cents), 0) into v_used
  from (
    select amount_cents from public.credit_allocations where credit_id = v_credit_id
    union all
    select amount_cents from public.credit_refunds where credit_id = v_credit_id
  ) u;

  perform set_config('app.payment_sync', '1', true);
  if v_used >= v_credit.amount_cents and v_note.status in ('issued', 'sent') then
    update public.invoices set status_before_payment = status, status = 'paid' where id = v_note.id;
  elsif v_used < v_credit.amount_cents and v_note.status = 'paid' and v_note.status_before_payment is not null then
    update public.invoices set status = status_before_payment, status_before_payment = null where id = v_note.id;
  end if;
  perform set_config('app.payment_sync', '0', true);
  return null;
end;
$$;

revoke all on function app.sync_credit_note_status() from public, anon, authenticated;

create trigger credit_allocations_sync_note
  after insert or delete on public.credit_allocations
  for each row execute function app.sync_credit_note_status();

create trigger credit_refunds_sync_note
  after insert or update or delete on public.credit_refunds
  for each row execute function app.sync_credit_note_status();

-- Le statut « payé » d'un AVOIR n'est plus un interrupteur non plus — quand il
-- a un crédit. Sans crédit (client non rattaché), tout continue comme avant.
-- Redéfinition du garde de 20260928090000.
create or replace function app.guard_invoice_payment_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_sync    boolean := coalesce(current_setting('app.payment_sync', true), '') = '1';
  v_managed boolean;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.document_type = 'invoice' then
    v_managed := true;
  else
    v_managed := exists (select 1 from public.customer_credits c where c.credit_note_id = old.id);
  end if;

  if not v_managed then
    return new;
  end if;

  if new.status = 'paid' and not v_sync then
    if new.document_type = 'invoice' then
      raise exception
        'Facture % : enregistrez un règlement (public.record_payment) — le statut « payée » suit les encaissements, il ne se pose plus à la main.',
        old.reference using errcode = 'restrict_violation';
    else
      raise exception
        'Avoir % : imputez-le (allocate_credit) ou remboursez-le (refund_credit) — son statut suit son crédit.',
        old.reference using errcode = 'restrict_violation';
    end if;
  end if;

  if old.status = 'paid' and not v_sync then
    raise exception 'Document % soldé : corrigez ses mouvements pour changer son statut.', old.reference using errcode = 'restrict_violation';
  end if;

  if new.status = 'cancelled' then
    if new.document_type = 'invoice'
       and (exists (select 1 from public.invoice_payments p where p.invoice_id = old.id)
            or exists (select 1 from public.credit_allocations a where a.invoice_id = old.id)) then
      raise exception 'Facture % : des règlements ou imputations sont enregistrés. Supprimez-les ou émettez un avoir avant d''annuler.', old.reference using errcode = 'restrict_violation';
    end if;
    if new.document_type = 'credit_note'
       and exists (select 1 from public.customer_credits c
                   join public.customer_credit_balances b on b.credit_id = c.id
                   where c.credit_note_id = old.id and b.remaining_cents < c.amount_cents) then
      raise exception 'Avoir % : son crédit a déjà été imputé ou remboursé. Corrigez ces mouvements avant d''annuler.', old.reference using errcode = 'restrict_violation';
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. L'avoir émis crée son crédit ; l'avoir annulé le retire
-- -----------------------------------------------------------------------------
create or replace function app.open_credit_for_credit_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total bigint;
begin
  if new.document_type <> 'credit_note' then
    return null;
  end if;

  -- Émission : de brouillon à émis (ou envoyé), avec un client rattaché.
  if old.status = 'draft' and new.status in ('issued', 'sent') and new.customer_id is not null then
    select total_cents into v_total from public.invoice_totals where invoice_id = new.id;
    if coalesce(v_total, 0) > 0 then
      insert into public.customer_credits (organization_id, customer_id, origin, credit_note_id, amount_cents, created_by)
      values (new.organization_id, new.customer_id, 'credit_note', new.id, v_total, (select auth.uid()))
      on conflict (credit_note_id) do nothing;
    end if;
  end if;

  -- Annulation : le crédit disparaît (le garde a refusé s'il était entamé).
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    delete from public.customer_credits where credit_note_id = new.id;
  end if;

  return null;
end;
$$;

revoke all on function app.open_credit_for_credit_note() from public, anon, authenticated;

create trigger invoices_open_credit
  after update of status on public.invoices
  for each row execute function app.open_credit_for_credit_note();

-- -----------------------------------------------------------------------------
-- 6. Journal
-- -----------------------------------------------------------------------------
create or replace function app.audit_customer_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record := coalesce(new, old);
  v_action text;
begin
  v_action := case tg_table_name
    when 'customer_credits'   then 'customer_credit.' || case tg_op when 'INSERT' then 'opened' when 'DELETE' then 'voided' else 'updated' end
    when 'credit_allocations' then 'credit_allocation.' || case tg_op when 'INSERT' then 'recorded' else 'deleted' end
    when 'credit_refunds'     then 'credit_refund.' || case tg_op when 'INSERT' then 'recorded' when 'DELETE' then 'deleted' else 'corrected' end
  end;

  perform app.write_audit_log(
    v_row.organization_id, v_action, tg_table_name::text, v_row.id,
    (to_jsonb(v_row) - 'organization_id' - 'created_at' - 'updated_at')
      || case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old) - 'organization_id' - 'created_at' - 'updated_at') else '{}'::jsonb end
  );
  return coalesce(new, old);
end;
$$;

revoke all on function app.audit_customer_account() from public, anon, authenticated;

create trigger customer_credits_audit after insert or update or delete on public.customer_credits
  for each row execute function app.audit_customer_account();
create trigger credit_allocations_audit after insert or delete on public.credit_allocations
  for each row execute function app.audit_customer_account();
create trigger credit_refunds_audit after insert or update or delete on public.credit_refunds
  for each row execute function app.audit_customer_account();

-- -----------------------------------------------------------------------------
-- 7. Droits
-- -----------------------------------------------------------------------------
alter table public.customer_credits enable row level security;
alter table public.credit_allocations enable row level security;
alter table public.credit_refunds enable row level security;

revoke all on public.customer_credits, public.credit_allocations, public.credit_refunds
  from public, anon, authenticated, service_role;

-- Un crédit naît d'un avoir (trigger) ou d'un trop-perçu (record_payment) :
-- jamais à la main. Lecture seule pour authenticated ; la note se corrige.
grant select on public.customer_credits to authenticated;
grant update (note) on public.customer_credits to authenticated;
grant select, insert, delete on public.credit_allocations to authenticated;
grant select, insert, delete on public.credit_refunds to authenticated;
grant update (amount_cents, paid_on, method, reference, note) on public.credit_refunds to authenticated;
grant all on public.customer_credits, public.credit_allocations, public.credit_refunds to service_role;

create policy customer_credits_select on public.customer_credits for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'invoicing'))
     and (select app.has_org_permission(organization_id, 'invoice.view')));
create policy customer_credits_update on public.customer_credits for update to authenticated
  using ((select app.has_org_permission(organization_id, 'invoice.manage')))
  with check ((select app.has_org_permission(organization_id, 'invoice.manage')));

create policy credit_allocations_select on public.credit_allocations for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'invoicing'))
     and (select app.has_org_permission(organization_id, 'invoice.view')));
create policy credit_allocations_insert on public.credit_allocations for insert to authenticated
  with check ((select app.can_use_pro_module(organization_id, 'invoicing'))
          and (select app.has_org_permission(organization_id, 'invoice.manage')));
create policy credit_allocations_delete on public.credit_allocations for delete to authenticated
  using ((select app.has_org_permission(organization_id, 'invoice.manage')));

create policy credit_refunds_select on public.credit_refunds for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'invoicing'))
     and (select app.has_org_permission(organization_id, 'invoice.view')));
create policy credit_refunds_insert on public.credit_refunds for insert to authenticated
  with check ((select app.can_use_pro_module(organization_id, 'invoicing'))
          and (select app.has_org_permission(organization_id, 'invoice.manage')));
create policy credit_refunds_update on public.credit_refunds for update to authenticated
  using ((select app.has_org_permission(organization_id, 'invoice.manage')))
  with check ((select app.has_org_permission(organization_id, 'invoice.manage')));
create policy credit_refunds_delete on public.credit_refunds for delete to authenticated
  using ((select app.has_org_permission(organization_id, 'invoice.manage')));

-- -----------------------------------------------------------------------------
-- 8. Les chemins : imputer, rembourser, encaisser avec trop-perçu
-- -----------------------------------------------------------------------------

/** Imputer un crédit sur une facture. Sans montant : le plus petit des deux restes. */
create or replace function public.allocate_credit(
  p_credit_id    uuid,
  p_invoice_id   uuid,
  p_amount_cents bigint default null,
  p_allocated_on date default current_date
)
returns public.credit_allocations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_credit  public.customer_credit_balances%rowtype;
  v_invoice public.invoice_balances%rowtype;
  v_amount  bigint;
  v_result  public.credit_allocations;
begin
  select * into v_credit from public.customer_credit_balances where credit_id = p_credit_id;
  if not found then raise exception 'Crédit introuvable.' using errcode = 'no_data_found'; end if;
  select * into v_invoice from public.invoice_balances where invoice_id = p_invoice_id;
  if not found then raise exception 'Facture introuvable.' using errcode = 'no_data_found'; end if;

  v_amount := coalesce(p_amount_cents, least(v_credit.remaining_cents, v_invoice.remaining_cents));
  if v_amount <= 0 then
    raise exception 'Rien à imputer : le crédit est consommé ou la facture est soldée.' using errcode = 'check_violation';
  end if;

  insert into public.credit_allocations (organization_id, credit_id, invoice_id, amount_cents, allocated_on)
  values (v_credit.organization_id, p_credit_id, p_invoice_id, v_amount, p_allocated_on)
  returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.allocate_credit(uuid, uuid, bigint, date) from public, anon;
grant execute on function public.allocate_credit(uuid, uuid, bigint, date) to authenticated, service_role;

/** Rembourser un crédit. Sans montant : tout ce qui reste. */
create or replace function public.refund_credit(
  p_credit_id    uuid,
  p_amount_cents bigint default null,
  p_paid_on      date default current_date,
  p_method       public.payment_method default 'transfer',
  p_reference    text default null,
  p_note         text default null
)
returns public.credit_refunds
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_credit public.customer_credit_balances%rowtype;
  v_amount bigint;
  v_result public.credit_refunds;
begin
  select * into v_credit from public.customer_credit_balances where credit_id = p_credit_id;
  if not found then raise exception 'Crédit introuvable.' using errcode = 'no_data_found'; end if;

  v_amount := coalesce(p_amount_cents, v_credit.remaining_cents);
  if v_amount <= 0 then
    raise exception 'Ce crédit est déjà consommé.' using errcode = 'check_violation';
  end if;

  insert into public.credit_refunds (organization_id, credit_id, amount_cents, paid_on, method, reference, note)
  values (v_credit.organization_id, p_credit_id, v_amount, p_paid_on, p_method, nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''))
  returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.refund_credit(uuid, bigint, date, public.payment_method, text, text) from public, anon;
grant execute on function public.refund_credit(uuid, bigint, date, public.payment_method, text, text) to authenticated, service_role;

/**
 * Encaisser — redéfinition de 20260928090000 avec le trop-perçu.
 *
 * Le paramètre s'ajoute : l'ancienne signature est retirée. Sans
 * `p_accept_overpayment`, un montant au-delà du reste dû est refusé comme
 * avant. Avec : la facture est soldée pour son reste dû, et l'excédent porté
 * au crédit du client — qui doit être rattaché.
 */
drop function if exists public.record_payment(uuid, bigint, date, public.payment_method, text, text);

create or replace function public.record_payment(
  p_invoice_id          uuid,
  p_amount_cents        bigint default null,
  p_paid_on             date default current_date,
  p_method              public.payment_method default 'other',
  p_reference           text default null,
  p_note                text default null,
  p_accept_overpayment  boolean default false
)
returns public.invoice_payments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_balance  public.invoice_balances%rowtype;
  v_invoice  public.invoices%rowtype;
  v_gap      bigint;
  v_amount   bigint;
  v_excess   bigint := 0;
  v_result   public.invoice_payments;
begin
  select * into v_balance from public.invoice_balances where invoice_id = p_invoice_id;
  if not found then
    raise exception 'Facture introuvable.' using errcode = 'no_data_found';
  end if;
  if v_balance.status not in ('issued', 'sent', 'paid') then
    raise exception 'Un règlement ne s''enregistre que sur une facture émise.' using errcode = 'restrict_violation';
  end if;

  -- Ce qui manque au livre : total − encaissé − imputé.
  v_gap := v_balance.total_cents - v_balance.paid_cents - v_balance.allocated_cents;
  v_amount := coalesce(p_amount_cents, v_gap);
  if v_amount <= 0 then
    raise exception 'Cette facture est déjà soldée.' using errcode = 'check_violation';
  end if;

  if v_amount > v_gap then
    if not p_accept_overpayment then
      raise exception
        'Ce règlement dépasse le reste dû de % c. Pour porter l''excédent au crédit du client, confirmez le trop-perçu.',
        v_amount - v_gap using errcode = 'check_violation';
    end if;
    select * into v_invoice from public.invoices where id = p_invoice_id;
    if v_invoice.customer_id is null then
      raise exception 'Un trop-perçu se porte au crédit d''une fiche client : rattachez la facture à son client avant.' using errcode = 'restrict_violation';
    end if;
    v_excess := v_amount - v_gap;
    v_amount := v_gap;
  end if;

  insert into public.invoice_payments (organization_id, invoice_id, amount_cents, paid_on, method, reference, note)
  values (v_balance.organization_id, p_invoice_id, v_amount, p_paid_on, p_method, nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''))
  returning * into v_result;

  if v_excess > 0 then
    -- Cette fonction est `security invoker` et `authenticated` n'écrit jamais
    -- dans `customer_credits` : l'excédent passe par une fonction dédiée,
    -- `security definer`, qui ne sait faire que cela.
    perform app.open_overpayment_credit(v_result.id, v_invoice.customer_id, v_excess);
  end if;

  return v_result;
end;
$$;

revoke all on function public.record_payment(uuid, bigint, date, public.payment_method, text, text, boolean) from public, anon;
grant execute on function public.record_payment(uuid, bigint, date, public.payment_method, text, text, boolean) to authenticated, service_role;

/**
 * Le seul chemin qui crée un crédit de trop-perçu. `security definer` parce
 * qu'`authenticated` n'écrit jamais dans `customer_credits` directement ; la
 * légitimité vient de `record_payment`, qui a déjà passé la RLS du règlement.
 */
create or replace function app.open_overpayment_credit(p_payment_id uuid, p_customer_id uuid, p_excess_cents bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.invoice_payments%rowtype;
begin
  select * into v_payment from public.invoice_payments where id = p_payment_id;
  if not found then
    raise exception 'Règlement introuvable.' using errcode = 'no_data_found';
  end if;
  if p_excess_cents <= 0 then
    return;
  end if;
  insert into public.customer_credits (organization_id, customer_id, origin, payment_id, amount_cents, note, created_by)
  values (v_payment.organization_id, p_customer_id, 'overpayment', p_payment_id, p_excess_cents,
          'Trop-perçu sur le règlement du ' || to_char(v_payment.paid_on, 'DD/MM/YYYY'), (select auth.uid()));
end;
$$;

revoke all on function app.open_overpayment_credit(uuid, uuid, bigint) from public, anon;
-- Appelée depuis record_payment, exécutée par la personne : elle doit pouvoir l'invoquer.
grant execute on function app.open_overpayment_credit(uuid, uuid, bigint) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9. Auto-vérification
-- -----------------------------------------------------------------------------
do $$
declare v int;
begin
  select count(*) into v from pg_policy p join pg_class c on c.oid = p.polrelid
  where c.relname in ('customer_credits', 'credit_allocations', 'credit_refunds');
  if v <> 9 then raise exception '% politique(s) RLS au lieu de 9.', v; end if;

  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'record_payment' and p.pronargs = 7) then
    raise exception 'record_payment n''a pas sa nouvelle signature.';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'record_payment' and p.pronargs = 6) then
    raise exception 'L''ancienne signature de record_payment est encore là.';
  end if;
end $$;

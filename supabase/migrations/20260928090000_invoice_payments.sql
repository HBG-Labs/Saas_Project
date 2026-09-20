-- =============================================================================
-- Règlements des factures de vente (D4 — Finance et paiements)
-- =============================================================================
--
-- CE QUE CETTE MIGRATION CHANGE
--
-- Jusqu'ici « payée » était un interrupteur : le client posait `status = 'paid'`
-- sans montant, sans date, sans mode de règlement, sans partiel. Le trigger
-- d'immutabilité l'annonçait lui-même : « les phases suivantes ajouteront ici le
-- règlement ».
--
-- Désormais :
--
--   - `invoice_payments` porte chaque encaissement : montant, date, mode,
--     référence libre, note, auteur. Une ligne par règlement, partiel ou total.
--
--   - `invoice_balances` CALCULE le reste dû, le retard et l'état
--     « partiellement réglée » depuis les règlements — rien de tout cela n'est
--     stocké, donc rien ne peut diverger.
--
--   - `status = 'paid'` ne se pose plus à la main : il SUIT les règlements.
--     Cumul = total → `paid`, avec mémoire du statut d'avant ; un règlement
--     corrigé qui fait redescendre le cumul rétablit ce statut. La fonction
--     `public.record_payment(...)` est le seul chemin ; le bouton « Marquer payée »
--     enregistre un règlement du reste dû.
--
--   - Toute saisie, correction ou suppression de règlement est journalisée dans
--     `audit_logs`, immuable, avec l'auteur, la date et les valeurs.
--
-- CE QU'ELLE NE FAIT PAS (arbitrage E)
--
-- Pas de rapprochement bancaire, pas de règlement des factures reçues, pas de
-- relance automatique, pas d'échéancier multi-échéances (la `due_date` unique
-- suffit), aucun paiement externe déclenché. Le statut reste l'enum existant :
-- « partiellement réglée » se déduit, il ne se stocke pas (arbitrage B).
--
-- LES FACTURES DÉJÀ `paid`
--
-- Aucun règlement historique n'est inventé. Une facture `paid` d'avant cette
-- migration reste `paid`, son reste dû vaut 0 (soldée, par définition), et la
-- vue la signale par `settled_without_ledger = true`. Son statut d'avant
-- (`status_before_payment`) est NULL : le trigger de synchronisation ne la
-- rétrograde JAMAIS — on peut y saisir après coup les règlements réels, jusqu'à
-- concurrence du total, sans qu'elle ne redevienne « envoyée » entre-temps.
--
-- CONCURRENCE
--
-- Deux encaissements simultanés sur la même facture ne peuvent pas dépasser le
-- total : le garde verrouille la ligne de facture (`for update`) avant de
-- calculer le cumul, ce qui sérialise les saisies concurrentes sur une même
-- facture. La transaction perdante voit le cumul déjà à jour et est refusée.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Le mode de règlement
-- -----------------------------------------------------------------------------
create type public.payment_method as enum
  ('transfer', 'check', 'card', 'cash', 'direct_debit', 'other');

revoke all on type public.payment_method from public, anon;
grant usage on type public.payment_method to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. La mémoire du statut d'avant « paid »
-- -----------------------------------------------------------------------------
-- Posée par le trigger de synchronisation quand le cumul atteint le total,
-- effacée quand il redescend. NULL sur une facture `paid` d'avant cette
-- migration, et c'est ce NULL qui la protège de toute rétrogradation.
alter table public.invoices
  add column status_before_payment public.invoice_status;

comment on column public.invoices.status_before_payment is
  'Statut (issued/sent) qu''avait la facture avant que ses règlements ne la soldent. NULL = paid posé avant le suivi des règlements, jamais rétrogradée.';

-- -----------------------------------------------------------------------------
-- 3. La table des règlements
-- -----------------------------------------------------------------------------
create table public.invoice_payments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  invoice_id       uuid not null references public.invoices (id) on delete cascade,
  amount_cents     bigint not null,
  paid_on          date not null default current_date,
  method           public.payment_method not null default 'other',
  reference        text,
  note             text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint invoice_payments_amount_positive check (amount_cents > 0),
  constraint invoice_payments_reference_length check (reference is null or length(reference) <= 120),
  constraint invoice_payments_note_length check (note is null or length(note) <= 500),
  -- Un règlement daté dans le futur n'est pas un encaissement, c'est une
  -- promesse : ça n'a pas sa place dans le livre.
  constraint invoice_payments_paid_on_not_future check (paid_on <= current_date)
);

comment on table public.invoice_payments is
  'Un encaissement sur une facture de vente. Le solde n''est jamais stocké : voir invoice_balances.';

create index invoice_payments_invoice_idx on public.invoice_payments (invoice_id);
create index invoice_payments_org_date_idx on public.invoice_payments (organization_id, paid_on desc);

create trigger invoice_payments_set_updated_at
  before update on public.invoice_payments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. L'immutabilité d'une facture émise laisse passer la mémoire de statut
-- -----------------------------------------------------------------------------
-- Redéfinition (nouvelle migration, la précédente reste intacte). Seule la
-- liste des colonnes modifiables change : `status_before_payment` s'y ajoute.
create or replace function app.enforce_invoice_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- `status` et `status_before_payment` vivent avec le règlement ; `updated_at`
  -- est posé par un autre trigger. Le contenu, lui, ne bouge plus.
  v_modifiables constant text[] := array['status', 'status_before_payment', 'updated_at'];
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

-- -----------------------------------------------------------------------------
-- 5. Le statut « paid » n'est plus un interrupteur
-- -----------------------------------------------------------------------------
-- Le trigger de synchronisation (§7) pose un drapeau de transaction avant de
-- toucher au statut ; sans ce drapeau, un passage à `paid`, ou un départ de
-- `paid`, est refusé. Les avoirs gardent l'interrupteur : leur `paid` signifie
-- « remboursé / imputé », et le remboursement n'est pas modélisé ici (voir la
-- note en fin de fichier).
create or replace function app.guard_invoice_payment_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_sync boolean := coalesce(current_setting('app.payment_sync', true), '') = '1';
begin
  if new.document_type <> 'invoice' or new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'paid' and not v_sync then
    raise exception
      'Facture % : enregistrez un règlement (public.record_payment) — le statut « payée » suit les encaissements, il ne se pose plus à la main.',
      old.reference
      using errcode = 'restrict_violation';
  end if;

  if old.status = 'paid' and not v_sync then
    raise exception
      'Facture % soldée : corrigez ou supprimez ses règlements pour changer son statut.',
      old.reference
      using errcode = 'restrict_violation';
  end if;

  -- Annuler une facture qui a encaissé de l'argent laisserait des règlements
  -- orphelins. Le chemin comptable est l'avoir, pas l'annulation.
  if new.status = 'cancelled'
     and exists (select 1 from public.invoice_payments p where p.invoice_id = old.id) then
    raise exception
      'Facture % : des règlements sont enregistrés. Supprimez-les ou émettez un avoir avant d''annuler.',
      old.reference
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

revoke all on function app.guard_invoice_payment_status() from public, anon, authenticated;

-- Nommé pour passer AVANT `invoices_immutable` (ordre alphabétique des
-- triggers d'un même événement) : un refus clair avant un refus générique.
create trigger invoices_guard_payment_status
  before update on public.invoices
  for each row execute function app.guard_invoice_payment_status();

-- -----------------------------------------------------------------------------
-- 6. Le garde d'un règlement : facture recevable, même organisation, pas de
--    trop-perçu, et sérialisation des saisies concurrentes
-- -----------------------------------------------------------------------------
-- `security definer` pour deux raisons : verrouiller la ligne de facture
-- (`for update` exige le droit UPDATE, que la RLS ne donne pas à tous ceux qui
-- peuvent régler) et lire le total sans dépendre des politiques du lecteur.
-- L'isolation entre organisations reste garantie par la politique d'insertion
-- (§9) ET par la vérification explicite ci-dessous.
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

  -- Le verrou. Deux transactions qui règlent la même facture passent ici l'une
  -- après l'autre ; la seconde calcule son cumul APRÈS le commit de la première.
  select * into v_invoice
  from public.invoices
  where id = new.invoice_id
  for update;

  if not found then
    raise exception 'Facture introuvable.' using errcode = 'foreign_key_violation';
  end if;

  if v_invoice.organization_id <> new.organization_id then
    raise exception 'Le règlement et la facture n''appartiennent pas à la même organisation.'
      using errcode = 'restrict_violation';
  end if;

  if v_invoice.document_type <> 'invoice' then
    raise exception 'Avoir % : un avoir ne s''encaisse pas, il s''impute ou se rembourse.',
      v_invoice.reference using errcode = 'restrict_violation';
  end if;

  if v_invoice.status not in ('issued', 'sent', 'paid') then
    raise exception 'Facture % : un règlement ne s''enregistre que sur une facture émise.',
      v_invoice.reference using errcode = 'restrict_violation';
  end if;

  select total_cents into v_total from public.invoice_totals where invoice_id = new.invoice_id;

  select coalesce(sum(amount_cents), 0) into v_cumul
  from public.invoice_payments
  where invoice_id = new.invoice_id
    and (tg_op = 'INSERT' or id <> old.id);

  if v_cumul + new.amount_cents > v_total then
    raise exception
      'Facture % : ce règlement dépasserait le total (reste dû % c, règlement % c). Un trop-perçu se traite par avoir.',
      v_invoice.reference, v_total - v_cumul, new.amount_cents
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := (select auth.uid());
  end if;

  return new;
end;
$$;

revoke all on function app.guard_invoice_payment() from public, anon, authenticated;

create trigger invoice_payments_guard
  before insert or update on public.invoice_payments
  for each row execute function app.guard_invoice_payment();

-- -----------------------------------------------------------------------------
-- 7. Le statut suit les règlements, dans les deux sens
-- -----------------------------------------------------------------------------
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
  from public.invoice_payments where invoice_id = v_invoice_id;

  -- Le drapeau autorise le garde du §5 à laisser passer, pour cette
  -- transaction seulement. Remis à zéro aussitôt après : un `set_config`
  -- local dure jusqu'à la fin de la transaction, et laisser le drapeau levé
  -- ouvrirait la porte à un `status = 'paid'` manuel dans la même transaction.
  perform set_config('app.payment_sync', '1', true);

  if v_cumul >= v_total and v_invoice.status in ('issued', 'sent') then
    update public.invoices
    set status_before_payment = status, status = 'paid'
    where id = v_invoice_id;

  elsif v_cumul < v_total and v_invoice.status = 'paid' and v_invoice.status_before_payment is not null then
    update public.invoices
    set status = status_before_payment, status_before_payment = null
    where id = v_invoice_id;
  end if;

  perform set_config('app.payment_sync', '0', true);
  return null;
end;
$$;

revoke all on function app.sync_invoice_paid_status() from public, anon, authenticated;

create trigger invoice_payments_sync_status
  after insert or update or delete on public.invoice_payments
  for each row execute function app.sync_invoice_paid_status();

-- -----------------------------------------------------------------------------
-- 8. Chaque mouvement du livre est journalisé, durablement
-- -----------------------------------------------------------------------------
-- `audit_logs` est immuable (trigger `reject_audit_mutation`). Un règlement
-- supprimé disparaît de la table, pas du journal : l'auteur, la date et les
-- valeurs y restent.
create or replace function app.audit_invoice_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avant jsonb;
  v_apres jsonb;
begin
  if tg_op = 'INSERT' then
    perform app.write_audit_log(
      new.organization_id, 'invoice_payment.recorded', 'invoice_payment', new.id,
      jsonb_build_object('invoice_id', new.invoice_id, 'amount_cents', new.amount_cents,
                         'paid_on', new.paid_on, 'method', new.method, 'reference', new.reference)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_avant := jsonb_build_object('amount_cents', old.amount_cents, 'paid_on', old.paid_on,
                                  'method', old.method, 'reference', old.reference, 'note', old.note);
    v_apres := jsonb_build_object('amount_cents', new.amount_cents, 'paid_on', new.paid_on,
                                  'method', new.method, 'reference', new.reference, 'note', new.note);
    if v_avant is distinct from v_apres then
      perform app.write_audit_log(
        new.organization_id, 'invoice_payment.corrected', 'invoice_payment', new.id,
        jsonb_build_object('invoice_id', new.invoice_id, 'before', v_avant, 'after', v_apres)
      );
    end if;
    return new;
  end if;

  perform app.write_audit_log(
    old.organization_id, 'invoice_payment.deleted', 'invoice_payment', old.id,
    jsonb_build_object('invoice_id', old.invoice_id, 'amount_cents', old.amount_cents,
                       'paid_on', old.paid_on, 'method', old.method, 'reference', old.reference)
  );
  return old;
end;
$$;

revoke all on function app.audit_invoice_payment() from public, anon, authenticated;

create trigger invoice_payments_audit
  after insert or update or delete on public.invoice_payments
  for each row execute function app.audit_invoice_payment();

-- -----------------------------------------------------------------------------
-- 9. Droits
-- -----------------------------------------------------------------------------
alter table public.invoice_payments enable row level security;

revoke all on public.invoice_payments from public, anon, authenticated, service_role;
grant select, insert, delete on public.invoice_payments to authenticated;
-- Une correction ne touche que les faits du règlement, jamais son rattachement.
grant update (amount_cents, paid_on, method, reference, note) on public.invoice_payments to authenticated;
grant all on public.invoice_payments to service_role;

-- Mêmes conditions que la facture qu'il règle : le module `invoicing` de la
-- formule, et la permission de voir ou de gérer les factures.
create policy invoice_payments_select
  on public.invoice_payments for select to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'invoicing'))
    and (select app.has_org_permission(organization_id, 'invoice.view'))
  );

create policy invoice_payments_insert
  on public.invoice_payments for insert to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'invoicing'))
    and (select app.has_org_permission(organization_id, 'invoice.manage'))
  );

create policy invoice_payments_update
  on public.invoice_payments for update to authenticated
  using ((select app.has_org_permission(organization_id, 'invoice.manage')))
  with check ((select app.has_org_permission(organization_id, 'invoice.manage')));

create policy invoice_payments_delete
  on public.invoice_payments for delete to authenticated
  using ((select app.has_org_permission(organization_id, 'invoice.manage')));

-- -----------------------------------------------------------------------------
-- 10. Le solde, calculé
-- -----------------------------------------------------------------------------
-- `security_invoker` : la vue lit `invoices` avec les droits de la personne,
-- donc la RLS des factures s'applique. Rien n'est stocké.
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
    when f.status in ('issued', 'sent') then greatest(t.total_cents - coalesce(p.paid_cents, 0), 0)
    else 0
  end                          as remaining_cents,
  coalesce(p.payment_count, 0) as payment_count,
  p.last_paid_on,
  -- Soldée par un « paid » d'avant le suivi des règlements, sans encaissement
  -- enregistré : à afficher comme telle, jamais à corriger d'office.
  (f.status = 'paid' and coalesce(p.paid_cents, 0) < t.total_cents)
                               as settled_without_ledger,
  (f.status in ('issued', 'sent')
     and coalesce(p.paid_cents, 0) > 0
     and coalesce(p.paid_cents, 0) < t.total_cents)
                               as partially_paid,
  (f.status in ('issued', 'sent')
     and t.total_cents - coalesce(p.paid_cents, 0) > 0
     and f.due_date is not null
     and f.due_date < current_date)
                               as overdue
from public.invoices f
join public.invoice_totals t on t.invoice_id = f.id
left join (
  select invoice_id,
         sum(amount_cents)::bigint as paid_cents,
         count(*)::int             as payment_count,
         max(paid_on)              as last_paid_on
  from public.invoice_payments
  group by invoice_id
) p on p.invoice_id = f.id
where f.document_type = 'invoice';

revoke all on public.invoice_balances from public, anon;
grant select on public.invoice_balances to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 11. Le seul chemin pour encaisser
-- -----------------------------------------------------------------------------
-- Dans `public`, comme `issue_invoice` et `create_credit_note_draft` : c'est le
-- seul schéma que PostgREST expose au client. `app` reste interne — gardes,
-- synchronisation, journal.
--
-- `security invoker` : l'insertion passe par la politique RLS de la personne,
-- comme si elle l'écrivait elle-même. La fonction n'ajoute qu'une commodité :
-- `p_amount_cents` NULL encaisse le reste dû — c'est « Marquer payée ».
create or replace function public.record_payment(
  p_invoice_id   uuid,
  p_amount_cents bigint default null,
  p_paid_on      date default current_date,
  p_method       public.payment_method default 'other',
  p_reference    text default null,
  p_note         text default null
)
returns public.invoice_payments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_balance public.invoice_balances%rowtype;
  v_amount  bigint;
  v_result  public.invoice_payments;
begin
  select * into v_balance from public.invoice_balances where invoice_id = p_invoice_id;
  if not found then
    raise exception 'Facture introuvable.' using errcode = 'no_data_found';
  end if;

  -- Le garde du §6 le refuserait aussi, mais après avoir calculé un montant
  -- nul sur un brouillon vide, et avec le mauvais message.
  if v_balance.status not in ('issued', 'sent', 'paid') then
    raise exception 'Un règlement ne s''enregistre que sur une facture émise.'
      using errcode = 'restrict_violation';
  end if;

  -- Sans montant : ce qui manque AU LIVRE (total − encaissé), et non le reste
  -- dû affiché. La différence compte pour une facture payée avant le suivi :
  -- son reste dû vaut 0 par définition, mais son livre est vide, et
  -- « Marquer payée » doit pouvoir le compléter.
  v_amount := coalesce(p_amount_cents, v_balance.total_cents - v_balance.paid_cents);
  if v_amount <= 0 then
    raise exception 'Cette facture est déjà soldée.' using errcode = 'check_violation';
  end if;

  insert into public.invoice_payments (organization_id, invoice_id, amount_cents, paid_on, method, reference, note)
  values (v_balance.organization_id, p_invoice_id, v_amount, p_paid_on, p_method, nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''))
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.record_payment(uuid, bigint, date, public.payment_method, text, text) from public, anon;
grant execute on function public.record_payment(uuid, bigint, date, public.payment_method, text, text) to authenticated, service_role;

-- =============================================================================
-- CE QUI RESTE À DÉCIDER — volontairement hors de cette migration
-- =============================================================================
--
-- - Le remboursement d'un avoir : un avoir « payé » signifie aujourd'hui
--   « remboursé ou imputé », à la main, sans montant. Modéliser le
--   remboursement (sortie d'argent) est une décision à part.
--
-- - L'imputation d'un avoir sur une facture : réduire le reste dû d'une
--   facture par un avoir, sans encaissement. C'est un second type de mouvement
--   dans le livre, pas un règlement.
--
-- - Un trop-perçu réel (le client a viré plus) : refusé ici, à traiter par
--   avoir — ou par une saisie plafonnée au reste dû et une note.
-- =============================================================================

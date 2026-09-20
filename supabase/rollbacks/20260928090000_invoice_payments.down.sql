-- Retour arrière de 20260928090000_invoice_payments.sql — À LA MAIN, JAMAIS PAR db push.
-- Ce dossier n'est pas lu par la CLI. Ne l'exécuter qu'après décision explicite :
-- il supprime les règlements saisis depuis l'application de la migration.
begin;
drop function if exists public.record_payment(uuid, bigint, date, public.payment_method, text, text);
drop view if exists public.invoice_balances;
drop trigger if exists invoices_guard_payment_status on public.invoices;
drop function if exists app.guard_invoice_payment_status();
drop table if exists public.invoice_payments;               -- emporte ses triggers
drop function if exists app.guard_invoice_payment();
drop function if exists app.sync_invoice_paid_status();
drop function if exists app.audit_invoice_payment();
alter table public.invoices drop column if exists status_before_payment;
drop type if exists public.payment_method;
-- L'immutabilité retrouve sa liste d'origine (20260903070000).
create or replace function app.enforce_invoice_immutable()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_modifiables constant text[] := array['status', 'updated_at'];
  v_avant jsonb; v_apres jsonb;
begin
  if old.status = 'draft' then return new; end if;
  v_avant := to_jsonb(old) - v_modifiables; v_apres := to_jsonb(new) - v_modifiables;
  if v_avant is distinct from v_apres then
    raise exception 'Facture % déjà émise : son contenu ne peut plus être modifié. Émettez un avoir.', old.reference using errcode = 'restrict_violation';
  end if;
  return new;
end; $$;
commit;

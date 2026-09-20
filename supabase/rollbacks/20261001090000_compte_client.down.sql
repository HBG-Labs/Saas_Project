-- Retour arrière de 20261001090000_compte_client.sql — À LA MAIN, JAMAIS PAR db push.
-- Supprime crédits, imputations et remboursements ; rétablit record_payment sans trop-perçu,
-- guard_invoice_payment / sync_invoice_paid_status / guard_invoice_payment_status et
-- invoice_balances tels que définis dans 20260928090000 (à réappliquer depuis ce fichier).
begin;
drop function if exists public.record_payment(uuid, bigint, date, public.payment_method, text, text, boolean);
drop function if exists app.open_overpayment_credit(uuid, uuid, bigint);
drop function if exists public.refund_credit(uuid, bigint, date, public.payment_method, text, text);
drop function if exists public.allocate_credit(uuid, uuid, bigint, date);
drop trigger if exists invoices_open_credit on public.invoices;
drop function if exists app.open_credit_for_credit_note();
drop view if exists public.customer_accounts;
drop view if exists public.invoice_balances;
drop view if exists public.customer_credit_balances;
drop table if exists public.credit_refunds;
drop table if exists public.credit_allocations;
drop table if exists public.customer_credits;
drop type if exists public.customer_credit_origin;
drop function if exists app.audit_customer_account();
drop function if exists app.sync_credit_note_status();
drop function if exists app.guard_credit_refund();
drop function if exists app.guard_credit_allocation();
drop function if exists app.lock_credit_remaining(uuid, uuid, uuid);
drop function if exists app.guard_customer_credit();
-- Puis : réappliquer les §4 (guard_invoice_payment), §5 (guard_invoice_payment_status),
-- §7 (sync_invoice_paid_status), §10 (invoice_balances) et §11 (record_payment) de 20260928090000.
commit;

-- =============================================================================
-- 22 — Le compte client : crédits, imputations, remboursements, trop-perçu
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. un avoir émis pour un client rattaché ouvre un crédit ; son statut
--      « réglé » ne se pose plus à la main ;
--   2. l'imputation réduit le reste dû de la facture du MÊME client, solde
--      la facture, et solde l'avoir quand le crédit est consommé ;
--   3. une imputation supprimée fait tout redescendre ;
--   4. le remboursement consomme le crédit, avec date, mode, référence ;
--   5. le trop-perçu est refusé sans accord, porté au crédit avec — et exige
--      une fiche client rattachée ;
--   6. un avoir sans client rattaché garde l'interrupteur d'avant ;
--   7. chacun selon ses droits ; l'encours par client dit vrai ; tout est journalisé.
--
-- Transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',   '00000000-0000-4000-8000-000000220001'),
  ('chef',     '00000000-0000-4000-8000-000000220002'),   -- team_leader : invoice.view seulement
  ('patron_b', '00000000-0000-4000-8000-000000220003');
select pg_temp.creer_comptes();

create temporary table t_ctx (org_id uuid, autre_org_id uuid, client uuid, autre_client uuid,
                              f1 uuid, avoir uuid, credit uuid, f2 uuid, f3 uuid, f4 uuid, f5 uuid);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id, autre_org_id)
values (pg_temp.organisation_abonnee('compte-a', 'Compte A', 'patron', 'pro'),
        pg_temp.organisation_abonnee('compte-b', 'Compte B', 'patron_b', 'pro'));
select pg_temp.ajouter_membre(org_id, 'chef', 'team_leader') from t_ctx;

-- Une facture complète et émise : 100,00 € HT + 20 % = 120,00 €, rattachée ou non.
create function pg_temp.facture_emise(p_org uuid, p_titre text, p_client uuid) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.invoices (organization_id, title) values (p_org, p_titre) returning id into v_id;
  update public.invoices set customer_id = p_client, customer_name = 'Client test', customer_type = 'individual',
    customer_address_line1 = '2 rue du Test', customer_postal_code = '97200', customer_city = 'Fort-de-France', customer_country = 'FR',
    service_date = current_date, operation_type = 'services', early_payment_terms = 'Escompte : néant.',
    late_payment_terms = 'Trois fois le taux légal.', vat_on_debits = false,
    due_date = current_date + 30, payment_terms = 'Paiement sous 30 jours.' where id = v_id;
  insert into public.invoice_items (invoice_id, organization_id, description, quantity, unit_price_cents, vat_rate)
  values (v_id, p_org, 'Prestation test', 1, 10000, 20);
  update public.invoices set status = 'issued' where id = v_id;
  return v_id;
end $$;

select pg_temp.login('patron'); set local role authenticated;
do $$ declare c uuid; begin
  insert into public.customers (organization_id, name, city, created_by)
  select org_id, 'SCI Les Alizés', 'Fort-de-France', pg_temp.uid('patron') from t_ctx returning id into c;
  update t_ctx set client = c;
  insert into public.customers (organization_id, name, city, created_by)
  select org_id, 'Autre client', 'Le Lamentin', pg_temp.uid('patron') from t_ctx returning id into c;
  update t_ctx set autre_client = c;
end $$;
update t_ctx set f1 = pg_temp.facture_emise(org_id, 'F1 - origine de l''avoir', client);
update t_ctx set f2 = pg_temp.facture_emise(org_id, 'F2 - recevra l''imputation', client);
update t_ctx set f3 = pg_temp.facture_emise(org_id, 'F3 - autre client', autre_client);
update t_ctx set f4 = pg_temp.facture_emise(org_id, 'F4 - trop-percu', client);
update t_ctx set f5 = pg_temp.facture_emise(org_id, 'F5 - sans client', null);
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — l''avoir emis ouvre un credit ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ declare v_draft public.invoices; v_note public.invoices; b public.customer_credit_balances; begin
  v_draft := public.create_full_credit_note_draft((select f1 from t_ctx), (select updated_at from public.invoices where id = (select f1 from t_ctx)), 'Prestation non due');
  perform pg_temp.ok((select count(*) = 0 from public.customer_credits), 'un brouillon d''avoir n''ouvre aucun credit');

  select * into v_note from public.issue_invoice(v_draft.id, v_draft.updated_at);
  update t_ctx set avoir = v_note.id;
  perform pg_temp.ok(v_note.status = 'issued', 'l''avoir est emis');

  select * into b from public.customer_credit_balances where credit_note_id = v_note.id;
  update t_ctx set credit = b.credit_id;
  perform pg_temp.ok(b.origin = 'credit_note' and b.amount_cents = 12000 and b.remaining_cents = 12000 and not b.settled,
    'un credit de 120,00 EUR est ouvert au client, entier');

  perform pg_temp.refuses(
    format($q$update public.invoices set status = 'paid' where id = %L$q$, v_note.id),
    'poser « rembourse / impute » a la main est refuse : le statut suit le credit');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — imputer ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ declare a public.credit_allocations; fb public.invoice_balances; cb public.customer_credit_balances; begin
  perform pg_temp.refuses(
    format($q$select public.allocate_credit(%L, %L, 1000)$q$, (select credit from t_ctx), (select f3 from t_ctx)),
    'imputer sur la facture d''un AUTRE client est refuse');
  perform pg_temp.refuses(
    format($q$select public.allocate_credit(%L, %L, 1000)$q$, (select credit from t_ctx), (select f5 from t_ctx)),
    'imputer sur une facture sans client rattache est refuse');
  perform pg_temp.refuses(
    format($q$select public.allocate_credit(%L, %L, 12001)$q$, (select credit from t_ctx), (select f2 from t_ctx)),
    'imputer plus que le credit est refuse');

  a := public.allocate_credit((select credit from t_ctx), (select f2 from t_ctx), 5000);
  select * into fb from public.invoice_balances where invoice_id = (select f2 from t_ctx);
  perform pg_temp.ok(fb.allocated_cents = 5000 and fb.remaining_cents = 7000 and fb.partially_paid,
    '50,00 EUR imputes : F2 doit encore 70,00, partiellement reglee');
  perform pg_temp.ok((select status = 'issued' from public.invoices where id = (select f2 from t_ctx)), 'F2 reste emise');

  -- Un reglement de plus que le reste du (70,00), imputation comprise : refuse.
  perform pg_temp.refuses(
    format($q$select public.record_payment(%L, 7001)$q$, (select f2 from t_ctx)),
    'un reglement compte les imputations dans le total');

  a := public.allocate_credit((select credit from t_ctx), (select f2 from t_ctx));
  perform pg_temp.ok(a.amount_cents = 7000, 'sans montant : le plus petit des deux restes, 70,00');
  select * into fb from public.invoice_balances where invoice_id = (select f2 from t_ctx);
  perform pg_temp.ok(fb.remaining_cents = 0 and fb.status = 'paid', 'F2 est soldee par imputation, sans un centime encaisse');
  perform pg_temp.ok((select status_before_payment = 'issued' from public.invoices where id = (select f2 from t_ctx)), 'et retient qu''elle etait emise');

  select * into cb from public.customer_credit_balances where credit_id = (select credit from t_ctx);
  perform pg_temp.ok(cb.remaining_cents = 0 and cb.settled, 'le credit est consomme');
  perform pg_temp.ok((select status = 'paid' from public.invoices where id = (select avoir from t_ctx)), 'l''avoir passe a « regle » de lui-meme');

  perform pg_temp.refuses(
    format($q$select public.allocate_credit(%L, %L)$q$, (select credit from t_ctx), (select f4 from t_ctx)),
    'un credit consomme ne s''impute plus');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — corriger une imputation ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ begin
  delete from public.credit_allocations where invoice_id = (select f2 from t_ctx) and amount_cents = 7000;
  perform pg_temp.ok((select status = 'issued' and status_before_payment is null from public.invoices where id = (select f2 from t_ctx)),
    'l''imputation retiree, F2 redevient emise');
  perform pg_temp.ok((select remaining_cents = 7000 from public.invoice_balances where invoice_id = (select f2 from t_ctx)),
    'et redoit 70,00');
  perform pg_temp.ok((select status = 'issued' from public.invoices where id = (select avoir from t_ctx)),
    'l''avoir redevient emis : son credit a de nouveau 70,00 de reste');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — rembourser ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ declare r public.credit_refunds; cb public.customer_credit_balances; begin
  perform pg_temp.refuses(
    format($q$select public.refund_credit(%L, 7001)$q$, (select credit from t_ctx)),
    'rembourser plus que le reste du credit est refuse');

  r := public.refund_credit((select credit from t_ctx), 3000, current_date, 'check', 'CHQ-77', 'Remboursement partiel');
  perform pg_temp.ok(r.amount_cents = 3000 and r.method = 'check' and r.reference = 'CHQ-77', 'un remboursement date, avec mode et reference');
  select * into cb from public.customer_credit_balances where credit_id = (select credit from t_ctx);
  perform pg_temp.ok(cb.refunded_cents = 3000 and cb.allocated_cents = 5000 and cb.remaining_cents = 4000,
    'le credit : 50,00 imputes, 30,00 rembourses, 40,00 restent');

  r := public.refund_credit((select credit from t_ctx));
  perform pg_temp.ok(r.amount_cents = 4000, 'sans montant : tout le reste');
  perform pg_temp.ok((select status = 'paid' from public.invoices where id = (select avoir from t_ctx)), 'le credit consomme, l''avoir est regle');

  update public.credit_refunds set amount_cents = 2000 where id = r.id;
  perform pg_temp.ok((select status = 'issued' from public.invoices where id = (select avoir from t_ctx)),
    'un remboursement corrige a la baisse rouvre l''avoir');
  perform pg_temp.refuses(
    format($q$update public.credit_refunds set amount_cents = 4001 where id = %L$q$, r.id),
    'et ne peut pas depasser le reste');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 5 — le trop-percu ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ declare p public.invoice_payments; cb public.customer_credit_balances; begin
  perform pg_temp.refuses(
    format($q$select public.record_payment(%L, 15000)$q$, (select f4 from t_ctx)),
    'un reglement au-dela du reste du est refuse sans accord explicite');

  perform pg_temp.refuses(
    format($q$select public.record_payment(%L, 15000, current_date, 'transfer', null, null, true)$q$, (select f5 from t_ctx)),
    'meme accepte, il exige une fiche client rattachee');

  p := public.record_payment((select f4 from t_ctx), 15000, current_date, 'transfer', 'VIR-150', null, true);
  perform pg_temp.ok(p.amount_cents = 12000, 'accepte : la facture encaisse son reste du, 120,00');
  perform pg_temp.ok((select status = 'paid' from public.invoices where id = (select f4 from t_ctx)), 'F4 est soldee');

  select * into cb from public.customer_credit_balances
  where customer_id = (select client from t_ctx) and origin = 'overpayment';
  perform pg_temp.ok(cb.amount_cents = 3000 and cb.remaining_cents = 3000, 'et 30,00 sont portes au credit du client');
  perform pg_temp.ok(
    (select payment_id = p.id and note like 'Trop-perçu%' from public.customer_credits where id = cb.credit_id),
    'le credit dit de quel reglement il vient');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 6 — l''avoir sans client rattache ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ declare v_draft public.invoices; v_note public.invoices; begin
  v_draft := public.create_full_credit_note_draft((select f5 from t_ctx), (select updated_at from public.invoices where id = (select f5 from t_ctx)), 'Erreur de facturation');
  select * into v_note from public.issue_invoice(v_draft.id, v_draft.updated_at);
  perform pg_temp.ok(not exists (select 1 from public.customer_credits where credit_note_id = v_note.id),
    'sans client rattache, aucun credit : hors du compte client');
  update public.invoices set status = 'paid' where id = v_note.id;
  perform pg_temp.ok((select status = 'paid' from public.invoices where id = v_note.id),
    'et l''interrupteur « rembourse / impute » fonctionne comme avant');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 7 — droits, encours, journal ==='; end $$;
-- =============================================================================

select pg_temp.login('chef'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) = 2 from public.customer_credits), 'invoice.view lit les credits');
  perform pg_temp.refuses(
    format($q$select public.allocate_credit(%L, %L, 100)$q$, (select credit from t_ctx), (select f2 from t_ctx)),
    'mais n''impute pas');
  perform pg_temp.refuses(
    format($q$select public.refund_credit(%L, 100)$q$, (select credit from t_ctx)),
    'ni ne rembourse');
end $$;
reset role;

select pg_temp.login('patron_b'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) = 0 from public.customer_credits), 'une autre organisation ne voit aucun credit');
  perform pg_temp.ok((select count(*) = 0 from public.customer_accounts where credits_remaining_cents > 0), 'ni aucun encours');
end $$;
reset role;

select pg_temp.login('patron'); set local role authenticated;
do $$ declare ca public.customer_accounts; begin
  select * into ca from public.customer_accounts where customer_id = (select client from t_ctx);
  -- Encours : F1 reste emise (120,00 — l'avoir la corrige, il ne la regle pas),
  -- F2 doit 70,00, F4 est soldee. Credits : avoir 120,00 − 50,00 imputes
  -- − 50,00 rembourses (30,00 + 40,00 corrige en 20,00) = 20,00 ; trop-percu 30,00.
  perform pg_temp.ok(ca.credits_remaining_cents = 5000, 'credits disponibles : 20,00 (avoir) + 30,00 (trop-percu)');
  perform pg_temp.ok(ca.outstanding_cents = 12000 + 7000, 'encours : F1 120,00 + F2 70,00');
  perform pg_temp.ok(ca.net_position_cents = 19000 - 5000, 'position nette : encours moins credits');
end $$;
reset role;

do $$ begin
  perform pg_temp.ok(
    (select count(*) >= 1 from public.audit_logs where action = 'customer_credit.opened' and organization_id = (select org_id from t_ctx)),
    'l''ouverture du credit est journalisee');
  perform pg_temp.ok(
    (select count(*) = 2 from public.audit_logs where action = 'credit_allocation.recorded'),
    'les deux imputations aussi');
  perform pg_temp.ok(
    (select count(*) = 1 from public.audit_logs where action = 'credit_allocation.deleted'),
    'et la suppression de l''une');
  perform pg_temp.ok(
    (select count(*) = 1 from public.audit_logs where action = 'credit_refund.corrected' and (metadata->'before'->>'amount_cents')::bigint = 4000),
    'la correction du remboursement, avec la valeur d''avant');
end $$;

do $$ begin
  raise notice '';
  raise notice ' TOUS LES TESTS PASSENT';
end $$;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;

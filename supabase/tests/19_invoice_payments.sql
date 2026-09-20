-- =============================================================================
-- 19 — Règlements des factures de vente : le livre ne ment pas
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. le reste dû est calculé, le partiel se déduit, le total solde ;
--   2. un trop-perçu est refusé, à la saisie comme à la correction ;
--   3. « payée » n'est plus un interrupteur : il suit les règlements dans les
--      deux sens, et retient le statut d'avant ;
--   4. les factures `paid` d'avant le suivi ne sont jamais rétrogradées ;
--   5. chacun n'agit que selon ses droits, et jamais hors de son organisation ;
--   6. chaque mouvement laisse une trace durable dans `audit_logs` ;
--   7. avoir, brouillon, facture annulée : pas de règlement.
--
-- Sur la concurrence : deux sessions ne peuvent pas cohabiter dans une
-- transaction annulée. La suite vérifie que le garde verrouille bien la ligne
-- de facture (`for update`) — c'est ce verrou qui sérialise deux encaissements
-- simultanés — et que la règle de cumul est appliquée sur l'état vu APRÈS le
-- verrou. L'entrelacement réel n'est pas rejoué ici ; il repose sur ce verrou.
--
-- Tout se passe dans une transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',      '00000000-0000-4000-8000-000000190001'),
  ('gestion',     '00000000-0000-4000-8000-000000190002'),   -- manager : invoice.manage
  ('chef',        '00000000-0000-4000-8000-000000190003'),   -- team_leader : invoice.view seulement
  ('technicien',  '00000000-0000-4000-8000-000000190004'),   -- ni l'un ni l'autre
  ('patron_b',    '00000000-0000-4000-8000-000000190005');   -- autre organisation
select pg_temp.creer_comptes();

-- -----------------------------------------------------------------------------
-- Fixture : deux entreprises abonnées, quatre rôles dans la première.
-- -----------------------------------------------------------------------------
create temporary table t_ctx (org_id uuid, autre_org_id uuid, inv uuid, inv_legacy uuid, avoir uuid, brouillon uuid);
-- `update` aussi : la fixture remplit ce contexte sous le role authenticated.
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id, autre_org_id)
values (pg_temp.organisation_abonnee('reglements-a', 'Reglements A', 'patron'),
        pg_temp.organisation_abonnee('reglements-b', 'Reglements B', 'patron_b'));

select pg_temp.ajouter_membre(org_id, 'gestion', 'manager') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'chef', 'team_leader') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'technicien', 'technician') from t_ctx;

-- Une facture complète : un article à 100,00 € HT, TVA 20 % → total 120,00 €.
create function pg_temp.facture_emise(p_org uuid, p_titre text) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.invoices (organization_id, title) values (p_org, p_titre) returning id into v_id;
  update public.invoices set customer_name = 'Client test', customer_type = 'individual',
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
update t_ctx set inv = pg_temp.facture_emise(org_id, 'A regler');
update t_ctx set inv_legacy = pg_temp.facture_emise(org_id, 'Payee avant le suivi');
do $$ declare v uuid; begin
  insert into public.invoices (organization_id, title) select org_id, 'Brouillon' from t_ctx returning id into v;
  update t_ctx set brouillon = v;
end $$;
reset role;

-- La facture « d'avant » : `paid` posé comme le faisait l'ancien bouton, sans
-- règlement. On lève le drapeau de synchronisation pour reproduire cet état —
-- exactement ce que la base contient pour les factures payées avant cette
-- migration (status_before_payment NULL).
select set_config('app.payment_sync', '1', true);
update public.invoices set status = 'paid' where id = (select inv_legacy from t_ctx);
select set_config('app.payment_sync', '0', true);

do $$ begin
  perform pg_temp.ok(
    (select status = 'paid' and status_before_payment is null from public.invoices where id = (select inv_legacy from t_ctx)),
    'fixture : une facture payee avant le suivi, sans memoire de statut');
  perform pg_temp.ok(
    (select total_cents = 12000 from public.invoice_totals where invoice_id = (select inv from t_ctx)),
    'fixture : la facture a regler totalise 120,00 EUR');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — partiel, puis solde ==='; end $$;
-- =============================================================================

select pg_temp.login('gestion'); set local role authenticated;
do $$ declare b public.invoice_balances; p public.invoice_payments; begin
  select * into b from public.invoice_balances where invoice_id = (select inv from t_ctx);
  perform pg_temp.ok(b.remaining_cents = 12000 and b.paid_cents = 0 and not b.partially_paid,
    'avant tout reglement : reste du = total, rien de regle');

  p := public.record_payment((select inv from t_ctx), 5000, current_date, 'transfer', 'VIR-001', null);
  perform pg_temp.ok(p.amount_cents = 5000 and p.created_by = pg_temp.uid('gestion'),
    'un reglement partiel de 50,00 EUR est enregistre, signe par son auteur');

  select * into b from public.invoice_balances where invoice_id = (select inv from t_ctx);
  perform pg_temp.ok(b.paid_cents = 5000 and b.remaining_cents = 7000 and b.partially_paid,
    'le reste du est recalcule : 70,00 EUR, facture partiellement reglee');
  perform pg_temp.ok((select status = 'issued' from public.invoices where id = (select inv from t_ctx)),
    'le statut reste « emise » tant que le total n''est pas atteint');

  -- Sans montant : le reste du. C'est le bouton « Marquer payee ».
  p := public.record_payment((select inv from t_ctx));
  perform pg_temp.ok(p.amount_cents = 7000, '« Marquer payee » enregistre exactement le reste du');

  select * into b from public.invoice_balances where invoice_id = (select inv from t_ctx);
  perform pg_temp.ok(b.remaining_cents = 0 and b.paid_cents = 12000 and not b.partially_paid and not b.settled_without_ledger,
    'soldee : reste du 0, et le livre porte l''integralite');
  perform pg_temp.ok(
    (select status = 'paid' and status_before_payment = 'issued' from public.invoices where id = (select inv from t_ctx)),
    'le statut passe a « payee » de lui-meme, en retenant qu''elle etait « emise »');

  perform pg_temp.refuses(
    format($q$select public.record_payment(%L)$q$, (select inv from t_ctx)),
    'un reglement de plus sur une facture soldee est refuse');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — le trop-percu ==='; end $$;
-- =============================================================================

select pg_temp.login('gestion'); set local role authenticated;
do $$ declare v_inv2 uuid; begin
  v_inv2 := pg_temp.facture_emise((select org_id from t_ctx), 'Trop-percu');
  perform public.record_payment(v_inv2, 10000);

  perform pg_temp.refuses(
    format($q$select public.record_payment(%L, 2001)$q$, v_inv2),
    'un reglement qui depasserait le total est refuse (reste 20,00, tente 20,01)');

  perform pg_temp.refuses(
    format($q$insert into public.invoice_payments (organization_id, invoice_id, amount_cents)
              values (%L, %L, 2001)$q$, (select org_id from t_ctx), v_inv2),
    'meme en ecriture directe, hors fonction');

  perform pg_temp.refuses(
    format($q$update public.invoice_payments set amount_cents = 12001 where invoice_id = %L$q$, v_inv2),
    'une correction qui ferait depasser le total est refusee aussi');

  perform pg_temp.refuses(
    format($q$insert into public.invoice_payments (organization_id, invoice_id, amount_cents)
              values (%L, %L, 0)$q$, (select org_id from t_ctx), v_inv2),
    'un reglement nul est refuse');

  perform pg_temp.refuses(
    format($q$insert into public.invoice_payments (organization_id, invoice_id, amount_cents, paid_on)
              values (%L, %L, 100, current_date + 1)$q$, (select org_id from t_ctx), v_inv2),
    'un reglement date de demain est refuse : une promesse n''est pas un encaissement');

  -- Exactement le reste du : accepte.
  perform public.record_payment(v_inv2, 2000);
  perform pg_temp.ok((select status = 'paid' from public.invoices where id = v_inv2),
    'exactement le reste du est accepte et solde la facture');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — « payee » n''est plus un interrupteur ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ declare v_inv3 uuid; begin
  v_inv3 := pg_temp.facture_emise((select org_id from t_ctx), 'Interrupteur');

  perform pg_temp.refuses(
    format($q$update public.invoices set status = 'paid' where id = %L$q$, v_inv3),
    'poser « payee » a la main sans reglement est refuse');

  update public.invoices set status = 'sent' where id = v_inv3;
  perform pg_temp.ok(true, 'les autres transitions (emise → envoyee) restent libres');

  perform public.record_payment(v_inv3, 12000, current_date, 'check', 'CHQ-42', 'Recu en main propre');
  perform pg_temp.ok(
    (select status = 'paid' and status_before_payment = 'sent' from public.invoices where id = v_inv3),
    'soldee depuis « envoyee », c''est « envoyee » qui est retenu');

  perform pg_temp.refuses(
    format($q$update public.invoices set status = 'sent' where id = %L$q$, v_inv3),
    'quitter « payee » a la main est refuse : ce sont les reglements qui decident');

  perform pg_temp.refuses(
    format($q$update public.invoices set status = 'cancelled' where id = %L$q$, v_inv3),
    'annuler une facture qui a encaisse est refuse : le chemin est l''avoir');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — corriger, supprimer : le statut suit ==='; end $$;
-- =============================================================================

select pg_temp.login('gestion'); set local role authenticated;
do $$ declare v_p uuid; begin
  -- La facture de la partie 1 est soldee par deux reglements (5000 + 7000).
  select id into v_p from public.invoice_payments
  where invoice_id = (select inv from t_ctx) and amount_cents = 7000;

  update public.invoice_payments set amount_cents = 6000, note = 'Erreur de saisie corrigee' where id = v_p;
  perform pg_temp.ok(
    (select status = 'issued' and status_before_payment is null from public.invoices where id = (select inv from t_ctx)),
    'un reglement reduit fait redescendre le cumul : la facture redevient « emise », la memoire s''efface');
  perform pg_temp.ok(
    (select remaining_cents = 1000 and partially_paid from public.invoice_balances where invoice_id = (select inv from t_ctx)),
    'le reste du est de nouveau juste : 10,00 EUR');

  delete from public.invoice_payments where id = v_p;
  perform pg_temp.ok(
    (select paid_cents = 5000 and remaining_cents = 7000 from public.invoice_balances where invoice_id = (select inv from t_ctx)),
    'un reglement supprime disparait du solde');

  perform pg_temp.refuses(
    format($q$update public.invoice_payments set invoice_id = %L where invoice_id = %L$q$,
           (select inv_legacy from t_ctx), (select inv from t_ctx)),
    'un reglement ne change pas de facture');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 5 — les factures payees avant le suivi ==='; end $$;
-- =============================================================================

select pg_temp.login('gestion'); set local role authenticated;
do $$ declare b public.invoice_balances; begin
  select * into b from public.invoice_balances where invoice_id = (select inv_legacy from t_ctx);
  perform pg_temp.ok(b.remaining_cents = 0 and b.paid_cents = 0 and b.settled_without_ledger,
    'soldee par definition (reste du 0), et signalee comme sans livre');

  -- On saisit apres coup un reglement partiel : elle ne doit PAS etre
  -- retrogradee — elle etait payee avant, elle le reste.
  perform public.record_payment((select inv_legacy from t_ctx), 4000, current_date - 10, 'cash');
  perform pg_temp.ok(
    (select status = 'paid' from public.invoices where id = (select inv_legacy from t_ctx)),
    'un reglement partiel saisi apres coup ne la retrograde pas');

  select * into b from public.invoice_balances where invoice_id = (select inv_legacy from t_ctx);
  perform pg_temp.ok(b.settled_without_ledger and b.paid_cents = 4000,
    'tant que le livre est incomplet, elle reste signalee');

  perform public.record_payment((select inv_legacy from t_ctx));
  select * into b from public.invoice_balances where invoice_id = (select inv_legacy from t_ctx);
  perform pg_temp.ok(not b.settled_without_ledger and b.paid_cents = 12000,
    'le livre complete, le signal s''eteint — sans qu''on ait rien invente');

  perform pg_temp.refuses(
    format($q$select public.record_payment(%L, 1)$q$, (select inv_legacy from t_ctx)),
    'et pas un centime de plus');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 6 — chacun selon ses droits, chacun chez soi ==='; end $$;
-- =============================================================================

select pg_temp.login('chef'); set local role authenticated;
do $$ begin
  perform pg_temp.ok(
    (select count(*) > 0 from public.invoice_payments where invoice_id = (select inv from t_ctx)),
    'invoice.view suffit pour LIRE les reglements');
  perform pg_temp.refuses(
    format($q$select public.record_payment(%L, 100)$q$, (select inv from t_ctx)),
    'mais pas pour en enregistrer un');
  perform pg_temp.refuses(
    format($q$insert into public.invoice_payments (organization_id, invoice_id, amount_cents) values (%L, %L, 100)$q$,
           (select org_id from t_ctx), (select inv from t_ctx)),
    'ni en ecriture directe');
  delete from public.invoice_payments where invoice_id = (select inv from t_ctx);
  perform pg_temp.ok(
    (select count(*) > 0 from public.invoice_payments where invoice_id = (select inv from t_ctx)),
    'ni pour en supprimer : le delete ne touche rien');
end $$;
reset role;

select pg_temp.login('technicien'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) = 0 from public.invoice_payments),
    'le technicien ne voit aucun reglement');
  perform pg_temp.ok((select count(*) = 0 from public.invoice_balances),
    'ni aucun solde');
end $$;
reset role;

select pg_temp.login('patron_b'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) = 0 from public.invoice_payments),
    'une autre organisation ne voit rien');
  perform pg_temp.refuses(
    format($q$insert into public.invoice_payments (organization_id, invoice_id, amount_cents) values (%L, %L, 100)$q$,
           (select org_id from t_ctx), (select inv from t_ctx)),
    'ne peut pas regler une facture qui n''est pas la sienne (RLS)');
  perform pg_temp.refuses(
    format($q$insert into public.invoice_payments (organization_id, invoice_id, amount_cents) values (%L, %L, 100)$q$,
           (select autre_org_id from t_ctx), (select inv from t_ctx)),
    'ni la rattacher a sa propre organisation (garde : organisations differentes)');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 7 — avoir, brouillon, annulee ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ declare v_annulee uuid; begin
  perform pg_temp.refuses(
    format($q$select public.record_payment(%L, 100)$q$, (select brouillon from t_ctx)),
    'un brouillon ne s''encaisse pas');

  v_annulee := pg_temp.facture_emise((select org_id from t_ctx), 'Annulee');
  update public.invoices set status = 'cancelled' where id = v_annulee;
  perform pg_temp.refuses(
    format($q$select public.record_payment(%L, 100)$q$, v_annulee),
    'une facture annulee ne s''encaisse pas');
  perform pg_temp.ok(
    (select count(*) = 0 from public.invoice_balances where invoice_id = v_annulee and remaining_cents > 0),
    'et son reste du est nul');
end $$;
reset role;

-- L'avoir, par le vrai chemin : un brouillon d'avoir total sur une facture emise.
select pg_temp.login('patron'); set local role authenticated;
do $$ declare v_src uuid; v_avoir public.invoices; begin
  v_src := pg_temp.facture_emise((select org_id from t_ctx), 'Source de l''avoir');
  v_avoir := public.create_full_credit_note_draft(
    v_src, (select updated_at from public.invoices where id = v_src), 'Prestation non due');
  update t_ctx set avoir = v_avoir.id;
  perform pg_temp.ok(v_avoir.document_type = 'credit_note', 'fixture : un avoir existe');

  perform pg_temp.refuses(
    format($q$insert into public.invoice_payments (organization_id, invoice_id, amount_cents) values (%L, %L, 100)$q$,
           (select org_id from t_ctx), (select avoir from t_ctx)),
    'un avoir ne s''encaisse pas : il s''impute ou se rembourse');
  perform pg_temp.ok(
    (select count(*) = 0 from public.invoice_balances where invoice_id = (select avoir from t_ctx)),
    'et il n''apparait pas dans les soldes');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 8 — la trace, durable ==='; end $$;
-- =============================================================================

do $$ begin
  perform pg_temp.ok(
    (select count(*) >= 1 from public.audit_logs
      where entity_type = 'invoice_payment' and action = 'invoice_payment.recorded'
        and organization_id = (select org_id from t_ctx) and user_id = pg_temp.uid('gestion')
        and (metadata->>'amount_cents')::bigint = 5000),
    'l''enregistrement est journalise avec son auteur et son montant');
  perform pg_temp.ok(
    (select count(*) = 1 from public.audit_logs
      where action = 'invoice_payment.corrected'
        and (metadata->'before'->>'amount_cents')::bigint = 7000
        and (metadata->'after'->>'amount_cents')::bigint = 6000),
    'la correction est journalisee avec les valeurs avant et apres');
  perform pg_temp.ok(
    (select count(*) = 1 from public.audit_logs
      where action = 'invoice_payment.deleted' and (metadata->>'amount_cents')::bigint = 6000),
    'la suppression est journalisee : le reglement a disparu de la table, pas du journal');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 9 — le verrou qui serialise les saisies concurrentes ==='; end $$;
-- =============================================================================

do $$ begin
  -- Deux sessions ne tiennent pas dans une transaction annulee. Ce qu'on peut
  -- prouver ici : le garde prend bien le verrou de ligne sur la facture AVANT
  -- de calculer le cumul. Sans ce `for update`, deux encaissements simultanes
  -- liraient le meme cumul et passeraient tous deux.
  perform pg_temp.ok(
    (select prosrc like '%for update%' and position('for update' in prosrc) < position('sum(amount_cents)' in prosrc)
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app' and p.proname = 'guard_invoice_payment'),
    'le garde verrouille la facture avant de sommer les reglements');
  perform pg_temp.ok(
    (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app' and p.proname = 'guard_invoice_payment'),
    'et il s''execute avec les droits necessaires au verrou (security definer)');
end $$;

do $$ begin
  raise notice '';
  raise notice ' TOUS LES TESTS PASSENT';
end $$;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;

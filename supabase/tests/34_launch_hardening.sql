-- =============================================================================
-- 34 — Verrous pré-lancement : transactions commerciales et isolation tenant
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron_a', '00000000-0000-4000-8000-000000340001'),
  ('patron_b', '00000000-0000-4000-8000-000000340002');
select pg_temp.creer_comptes();

create temporary table t_ctx (
  org_a uuid,
  org_b uuid,
  customer_id uuid,
  quote_id uuid,
  invoice_id uuid
);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_a, org_b) values (
  pg_temp.organisation_abonnee('launch-a', 'Launch A', 'patron_a', 'business'),
  pg_temp.organisation_abonnee('launch-b', 'Launch B', 'patron_b', 'business')
);

select pg_temp.login('patron_a');
set local role authenticated;

do $$
declare v_customer uuid;
begin
  select c.id into strict v_customer
  from public.create_customer_with_primary_site(
    (select org_a from t_ctx),
    '{"name":"Client atomique","customer_type":"company","country":"FR"}'::jsonb,
    '{"name":"Site principal","address_line1":"1 rue du Test","postal_code":"75001","city":"Paris","country":"FR","latitude":"48.8566","longitude":"2.3522"}'::jsonb
  ) c;
  update t_ctx set customer_id = v_customer;
end
$$;

select pg_temp.ok(
  (select count(*) from public.sites where customer_id = (select customer_id from t_ctx)) = 1,
  'client et site principal sont crees ensemble'
);

do $$
declare v_before bigint;
begin
  select count(*) into v_before from public.customers;
  begin
    perform public.create_customer_with_primary_site(
      (select org_a from t_ctx),
      '{"name":"Ne doit pas survivre","customer_type":"company"}'::jsonb,
      '{"name":"Site invalide","latitude":"pas-un-nombre"}'::jsonb
    );
    raise exception 'ECHEC : un site invalide a ete accepte' using errcode = 'assert_failure';
  exception
    when assert_failure then raise;
    when others then null;
  end;
  perform pg_temp.ok(
    (select count(*) from public.customers) = v_before,
    'une erreur de site annule aussi la creation du client'
  );
end
$$;

do $$
declare v_quote uuid;
begin
  select q.id into strict v_quote
  from public.create_quote_draft(
    (select org_a from t_ctx),
    jsonb_build_object(
      'title', 'Devis atomique',
      'customer_id', (select customer_id from t_ctx),
      'customer_name', 'Client atomique',
      'vat_rate', 20,
      'document_options', jsonb_build_object('mode', 'complete')
    ),
    '[{"description":"Diagnostic","unit":"Forfait","quantity":1,"unit_price_cents":15000},{"description":"Main-d oeuvre","unit":"Heure","quantity":2.5,"unit_price_cents":6500}]'::jsonb
  ) q;
  update t_ctx set quote_id = v_quote;
end
$$;

select pg_temp.ok(
  (select count(*) from public.quote_items where quote_id = (select quote_id from t_ctx)) = 2,
  'le devis et toutes ses lignes sont crees dans une transaction'
);

select pg_temp.refuses(
  format(
    'select public.create_quote_draft(%L::uuid, %L::jsonb, %L::jsonb)',
    (select org_b from t_ctx),
    '{"title":"Intrusion"}',
    '[{"description":"Ligne","unit":"u","quantity":1,"unit_price_cents":100}]'
  ),
  'le proprietaire A ne cree pas de devis dans entreprise B'
);

select pg_temp.refuses(
  format(
    'select public.create_quote_draft(%L::uuid, %L::jsonb, %L::jsonb)',
    (select org_a from t_ctx),
    '{"title":"Ligne invalide"}',
    '[{"description":"","unit":"u","quantity":1,"unit_price_cents":100}]'
  ),
  'une ligne commerciale sans designation est refusee'
);

update public.quotes set status = 'sent' where id = (select quote_id from t_ctx);
update public.quotes set status = 'accepted', client_responded_at = now()
where id = (select quote_id from t_ctx);

do $$
declare v_invoice uuid;
begin
  select i.id into strict v_invoice
  from public.create_invoice_draft(
    (select org_a from t_ctx),
    jsonb_build_object(
      'title', 'Facture issue du devis',
      'quote_id', (select quote_id from t_ctx),
      'customer_id', (select customer_id from t_ctx),
      'customer_name', 'Client atomique',
      'customer_type', 'company',
      'discount_rate', 0
    ),
    '[{"description":"Diagnostic","unit":"C62","quantity":1,"unit_price_cents":15000,"vat_rate":20,"vat_category":"S"}]'::jsonb
  ) i;
  update t_ctx set invoice_id = v_invoice;
end
$$;

select pg_temp.ok(
  (select count(*) from public.invoice_items where invoice_id = (select invoice_id from t_ctx)) = 1,
  'la facture et ses lignes sont crees ensemble'
);

select pg_temp.refuses(
  format(
    'select public.create_invoice_draft(%L::uuid, %L::jsonb, %L::jsonb)',
    (select org_a from t_ctx),
    jsonb_build_object('quote_id', (select quote_id from t_ctx))::text,
    '[{"description":"Doublon","unit":"C62","quantity":1,"unit_price_cents":15000,"vat_rate":20,"vat_category":"S"}]'
  ),
  'un devis ne produit jamais deux factures actives'
);

reset role;

do $$
begin
  raise notice '';
  raise notice '=============================================';
  raise notice ' TOUS LES TESTS PASSENT';
  raise notice '=============================================';
end
$$;

select 'TOUS LES TESTS PASSENT' as resultat;
rollback;

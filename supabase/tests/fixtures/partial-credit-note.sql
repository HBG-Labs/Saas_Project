-- Included in the transactional invoicing scenario, before its final ROLLBACK.
reset role;
select pg_temp.login('patron_a');
set local role authenticated;
do $$
declare v_org uuid; v_source public.invoices; v_credit public.invoices; v_second public.invoices;
  v_first public.invoice_items; v_other public.invoice_items; v_before jsonb;
  v_lines jsonb; v_counter integer; v_available numeric;
begin
  select id into v_org from public.organizations where slug = 'factu-a';
  insert into public.invoices (organization_id) values (v_org) returning * into v_source;
  perform pg_temp.complete_invoice(v_source.id);
  insert into public.invoice_items (invoice_id,organization_id,description,unit,quantity,unit_price_cents,vat_rate)
    values (v_source.id,v_org,'Matériel complémentaire - TEST','Unité',3,2500,8.5);
  select * into v_source from public.invoices where id=v_source.id;
  select * into v_source from public.issue_invoice(v_source.id,v_source.updated_at);
  select * into v_first from public.invoice_items where invoice_id=v_source.id order by position,id limit 1;
  select * into v_other from public.invoice_items where invoice_id=v_source.id and id<>v_first.id order by position,id limit 1;
  v_before := to_jsonb(v_source);
  reset role;
  select coalesce(sum(last_value),0) into v_counter from public.invoice_counters
    where organization_id=v_org and document_type='credit_note';
  set local role authenticated;

  v_lines := jsonb_build_array(jsonb_build_object('invoice_item_id',v_first.id,'quantity',0.5));
  select * into v_credit from public.create_credit_note_draft(
    v_source.id,v_source.updated_at,'Remise partielle - TEST','partial',v_lines);
  perform pg_temp.ok(v_credit.status='draft' and v_credit.credit_note_scope='partial'
    and v_credit.reference like 'BR-%','Avoir partiel créé en brouillon sans numéro');
  perform pg_temp.ok((select count(*)=1 and min(quantity)=0.5 and bool_and(source_invoice_item_id=v_first.id)
    from public.invoice_items where invoice_id=v_credit.id),'Seule la quantité sélectionnée est copiée et reliée à la ligne d''origine');
  perform pg_temp.ok((select total_cents > 0 and total_cents < (select total_cents from public.invoice_totals where invoice_id=v_source.id)
    from public.invoice_totals where invoice_id=v_credit.id),'Le total partiel est positif et inférieur à la facture');
  perform pg_temp.ok((select id from public.create_credit_note_draft(
    v_source.id,v_source.updated_at,'Double clic','partial',v_lines))=v_credit.id,
    'Un double clic retrouve le brouillon actif');
  delete from public.invoices where id=v_credit.id;
  perform pg_temp.refuses(format(
    'select public.create_credit_note_draft(%L,%L,%L,%L,%L::jsonb)',
    v_source.id,v_source.updated_at,'Mauvaise portée','full',v_lines::text),
    'Une sélection partielle ne peut pas être déclarée totale');
  perform pg_temp.refuses(format(
    'select public.create_credit_note_draft(%L,%L,%L,%L,%L::jsonb)',
    v_source.id,v_source.updated_at,'Quantité nulle','partial',
    jsonb_build_array(jsonb_build_object('invoice_item_id',v_first.id,'quantity',0))::text),
    'Une quantité nulle est refusée');
  perform pg_temp.refuses(format(
    'select public.create_credit_note_draft(%L,%L,%L,%L,%L::jsonb)',
    v_source.id,v_source.updated_at,'Trop de décimales','partial',
    jsonb_build_array(jsonb_build_object('invoice_item_id',v_first.id,'quantity',0.0001))::text),
    'Plus de trois décimales est refusé');
  perform pg_temp.refuses(format(
    'select public.create_credit_note_draft(%L,%L,%L,%L,%L::jsonb)',
    v_source.id,v_source.updated_at,'Ligne dupliquée','partial',
    jsonb_build_array(jsonb_build_object('invoice_item_id',v_first.id,'quantity',0.5),
      jsonb_build_object('invoice_item_id',v_first.id,'quantity',0.5))::text),
    'Une ligne dupliquée est refusée');
  perform pg_temp.refuses(format(
    'select public.create_credit_note_draft(%L,%L,%L,%L,%L::jsonb)',
    v_source.id,v_source.updated_at,'Ligne étrangère','partial',
    jsonb_build_array(jsonb_build_object('invoice_item_id',gen_random_uuid(),'quantity',1))::text),
    'Une ligne étrangère est refusée');

  select * into v_credit from public.create_credit_note_draft(
    v_source.id,v_source.updated_at,'Remise partielle - TEST','partial',v_lines);
  update public.invoice_items set unit_price_cents=unit_price_cents+1 where invoice_id=v_credit.id;
  select * into v_credit from public.invoices where id=v_credit.id;
  perform pg_temp.refuses(format('select public.issue_invoice(%L,%L)',v_credit.id,v_credit.updated_at),
    'Le prix d''origine ne peut pas être altéré');
  update public.invoice_items set unit_price_cents=unit_price_cents-1 where invoice_id=v_credit.id;
  select * into v_credit from public.invoices where id=v_credit.id;
  select * into v_credit from public.issue_invoice(v_credit.id,v_credit.updated_at);
  perform pg_temp.ok(v_credit.reference like 'AV-%' and v_credit.status='issued',
    'Le premier avoir partiel reçoit un numéro AV à l''émission');
  select available_quantity into v_available from public.get_creditable_invoice_lines(v_source.id)
    where invoice_item_id=v_first.id;
  perform pg_temp.ok(v_available=v_first.quantity-0.5,'La quantité disponible diminue après émission');

  perform pg_temp.refuses(format(
    'select public.create_credit_note_draft(%L,%L,%L,%L,%L::jsonb)',
    v_source.id,v_source.updated_at,'Dépassement','partial',
    jsonb_build_array(jsonb_build_object('invoice_item_id',v_first.id,'quantity',v_first.quantity))::text),
    'Le cumul ne peut pas dépasser la quantité d''origine');
  perform pg_temp.refuses(format('select public.create_full_credit_note_draft(%L,%L,%L)',
    v_source.id,v_source.updated_at,'Total après partiel'),
    'Un avoir total ne peut pas suivre un avoir partiel');

  v_lines := jsonb_build_array(
    jsonb_build_object('invoice_item_id',v_first.id,'quantity',v_first.quantity-0.5),
    jsonb_build_object('invoice_item_id',v_other.id,'quantity',v_other.quantity));
  select * into v_second from public.create_credit_note_draft(
    v_source.id,v_source.updated_at,'Solde de la correction - TEST','partial',v_lines);
  select * into v_second from public.issue_invoice(v_second.id,v_second.updated_at);
  perform pg_temp.ok(v_second.id<>v_credit.id and v_second.reference<>v_credit.reference,
    'Un second avoir partiel distinct peut solder la facture');
  perform pg_temp.ok(not exists(select 1 from public.get_creditable_invoice_lines(v_source.id)
    where available_quantity<>0),'Toutes les quantités sont épuisées exactement');
  perform pg_temp.refuses(format(
    'select public.create_credit_note_draft(%L,%L,%L,%L,%L::jsonb)',
    v_source.id,v_source.updated_at,'Troisième avoir','partial',
    jsonb_build_array(jsonb_build_object('invoice_item_id',v_first.id,'quantity',0.001))::text),
    'Aucun avoir supplémentaire ne peut dépasser le solde nul');
  perform pg_temp.ok((select to_jsonb(i) from public.invoices i where id=v_source.id)=v_before,
    'Les avoirs partiels ne modifient jamais la facture d''origine');
  reset role;
  perform pg_temp.ok((select coalesce(sum(last_value),0) from public.invoice_counters
    where organization_id=v_org and document_type='credit_note')=v_counter+2,
    'Deux numéros seulement sont consommés pour les deux émissions réussies');
  set local role authenticated;

  perform pg_temp.login('patron_b');
  perform pg_temp.ok(not exists(select 1 from public.get_creditable_invoice_lines(v_source.id)),
    'Les lignes créditables d''une autre organisation sont invisibles');
  perform pg_temp.refuses(format(
    'select public.create_credit_note_draft(%L,%L,%L,%L,%L::jsonb)',
    v_source.id,v_source.updated_at,'Autre organisation','partial',v_lines::text),
    'Une autre organisation ne peut pas créer l''avoir');
  perform pg_temp.login('technicien');
  perform pg_temp.refuses(format(
    'select public.create_credit_note_draft(%L,%L,%L,%L,%L::jsonb)',
    v_source.id,v_source.updated_at,'Sans permission','partial',v_lines::text),
    'Un technicien sans permission ne peut pas créer l''avoir');
  reset role;
end $$;

-- Appended to suite 06 before its final ROLLBACK, never run on its own.
select pg_temp.login('patron_a');
set local role authenticated;
do $$
declare v_org uuid; v_invoice public.invoices;
begin
  select id into v_org from public.organizations where slug = 'factu-a';
  update public.organizations set name = 'Atelier Démonstration - FICTIF',
    legal_name = 'Atelier Démonstration SARL - FICTIF', vat_regime = 'reel_normal',
    vat_number = 'FR12123456789', iban = 'FR7612345987650123456789014', bic = 'AGRIFRPP'
    where id = v_org;
  insert into public.invoices (id, organization_id)
    values ('00000000-0000-4000-8000-00000000f101', v_org) returning * into v_invoice;
  perform pg_temp.ok(v_invoice.status = 'draft' and v_invoice.issued_at is null, 'Le parcours commence sur un vrai brouillon');
  select * into v_invoice from public.save_invoice_draft(v_invoice.id, v_invoice.updated_at,
    jsonb_build_object(
      'title', 'Essai complet Factur-X',
      'notes', 'DOCUMENT DE TEST - DONNEES FICTIVES - NE PAS COMPTABILISER.',
      'customer_name', 'Client Démonstration - FICTIF',
      'customer_legal_name', 'Client Démonstration SAS - FICTIF',
      'customer_type', 'company', 'customer_registration_number', '987 654 321 00012',
      'customer_vat_number', 'fr 12 987654321',
      'customer_address_line1', '2 rue des Essais', 'customer_postal_code', '97200',
      'customer_city', 'Fort-de-France', 'customer_country', 'FR',
      'service_date', current_date, 'due_date', current_date + 30, 'operation_type', 'services',
      'early_payment_terms', 'Escompte pour paiement anticipé : néant.',
      'late_payment_terms', 'Pénalités de retard : trois fois le taux légal.',
      'payment_terms', 'Paiement sous 30 jours.', 'payment_method', 'Virement', 'vat_on_debits', false
    ), '[
      {"description":"Installation et contrôle - TEST", "unit":"h", "quantity":2, "unit_price_cents":12345, "vat_rate":20, "vat_category":"S"},
      {"description":"Maintenance - TEST", "unit":"u", "quantity":1, "unit_price_cents":8900, "vat_rate":8.5, "vat_category":"S"}
    ]'::jsonb);
  perform pg_temp.ok(v_invoice.status = 'draft', 'L’enregistrement ne déclenche aucune émission');
  perform public.issue_invoice(v_invoice.id, v_invoice.updated_at);
  perform pg_temp.ok((select status = 'issued' and issued_at is not null and reference like 'FAC-%'
    from public.invoices where id = v_invoice.id), 'L’émission attribue numéro et instantané');
  perform pg_temp.ok((select total_cents = 39285 from public.invoice_totals where invoice_id = v_invoice.id), 'Le total multi-taux est calculé par la base');
end $$;

select 'TOUS LES TESTS PASSENT' as resultat,
  to_jsonb(i) || jsonb_build_object(
    'items', (select jsonb_agg(to_jsonb(l) order by l.position, l.id) from public.invoice_items l where l.invoice_id = i.id),
    'totals', (select to_jsonb(t) from public.invoice_totals t where t.invoice_id = i.id),
    'vatBreakdown', '[]'::jsonb
  ) as fixture
from public.invoices i where i.id = '00000000-0000-4000-8000-00000000f101';
reset role;

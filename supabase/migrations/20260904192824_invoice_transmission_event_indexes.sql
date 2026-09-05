-- Les lectures de chronologie utilisent transmission_id. Ces deux index
-- couvrent séparément les autres clés étrangères afin que la vérification ou
-- la suppression d'une facture/organisation ne parcoure pas tout le journal.
create index invoice_transmission_events_invoice_idx
  on public.invoice_transmission_events(invoice_id);

create index invoice_transmission_events_organization_idx
  on public.invoice_transmission_events(organization_id);

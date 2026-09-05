-- Un rejet fonctionnel de la plateforme doit conserver sa raison, au même
-- titre qu'un échec technique. La contrainte initiale autorisait le message
-- uniquement pour `failed`, ce qui empêchait le passage `submitted` ->
-- `rejected` après l'insertion réussie de l'événement fournisseur.
alter table public.invoice_transmissions
  drop constraint invoice_transmissions_no_current_error_after_recovery;

alter table public.invoice_transmissions
  add constraint invoice_transmissions_no_current_error_after_recovery
  check (
    status in ('failed', 'rejected')
    or (last_error_code is null and last_error_message is null)
  );

-- Répare les transmissions déjà concernées sans modifier le journal immuable.
with latest_rejection as (
  select distinct on (transmission_id)
    transmission_id,
    provider_status_code,
    message
  from public.invoice_transmission_events
  where normalized_status = 'rejected'
  order by transmission_id, occurred_at desc, recorded_at desc
)
update public.invoice_transmissions as transmission
set
  status = 'rejected',
  last_error_code = rejection.provider_status_code,
  last_error_message = coalesce(nullif(btrim(rejection.message), ''), 'Facture rejetée par la plateforme.')
from latest_rejection as rejection
where transmission.id = rejection.transmission_id
  and transmission.status in ('queued', 'submitting', 'submitted', 'delivered', 'failed');

-- Etend le battement de coeur de l'ordonnanceur SUPER PDP (deja en place pour
-- l'emission, cf. 20260906165517_transmission_scheduler.sql) aux statistiques
-- de reception, ajoutee par 20260926090000_einvoicing_reception.sql. Migration
-- separee : 20260926090000 est deja appliquee, donc immuable.

alter table public.einvoicing_worker_runs
  add column received integer not null default 0 check (received >= 0),
  add column received_updated integer not null default 0 check (received_updated >= 0);

comment on column public.einvoicing_worker_runs.received is
  'Nombre de factures reçues nouvellement ingérées lors de cette exécution (direction=in).';
comment on column public.einvoicing_worker_runs.received_updated is
  'Nombre de factures reçues déjà connues dont les événements ont été resynchronisés lors de cette exécution.';

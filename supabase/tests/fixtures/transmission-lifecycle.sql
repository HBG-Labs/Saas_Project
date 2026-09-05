
-- =============================================================================
do $$ begin raise notice ''; raise notice '=== TRANSMISSION ÉLECTRONIQUE — CYCLE ET RLS ==='; end $$;
-- =============================================================================

reset role;
insert into t_ref(k, v)
select 'transmission_facture_a', i.id
from public.invoices i
join public.organizations o on o.id = i.organization_id
where o.slug = 'factu-a' and i.status in ('issued', 'sent', 'paid')
order by i.issued_at nulls last
limit 1
on conflict (k) do update set v = excluded.v;

insert into t_ref(k, v)
select 'transmission_facture_b', i.id
from public.invoices i
join public.organizations o on o.id = i.organization_id
where o.slug = 'factu-b'
limit 1
on conflict (k) do update set v = excluded.v;

grant select on pg_temp.t_ref to service_role;
set local role service_role;
create temporary table t_transmission_id(id uuid primary key);
with inserted as (
  insert into public.invoice_transmissions(invoice_id, organization_id, provider_code)
  select i.id, gen_random_uuid(), 'sandbox-pa'
  from public.invoices i
  where i.id = (select v from pg_temp.t_ref where k = 'transmission_facture_a')
  returning id
)
insert into t_transmission_id select id from inserted;

insert into public.invoice_transmission_events(
  transmission_id, invoice_id, organization_id, source, event_type,
  normalized_status, provider_event_id, occurred_at
)
select id, gen_random_uuid(), gen_random_uuid(), 'application', 'queued', 'queued', 'evt-1', now()
from t_transmission_id;

select pg_temp.ok(
  (select t.organization_id = i.organization_id
   from public.invoice_transmissions t join public.invoices i on i.id = t.invoice_id),
  'L’organisation de la transmission est imposée depuis la facture'
);
select pg_temp.ok(
  (select e.invoice_id = t.invoice_id and e.organization_id = t.organization_id
   from public.invoice_transmission_events e
   join public.invoice_transmissions t on t.id = e.transmission_id),
  'Les relations de l’événement sont imposées depuis la transmission'
);

update public.invoice_transmissions
set status = 'submitting', attempt_count = 1, last_attempt_at = now()
where id = (select id from t_transmission_id);
update public.invoice_transmissions
set status = 'submitted', provider_submission_id = 'sandbox-42'
where id = (select id from t_transmission_id);
update public.invoice_transmissions
set status = 'delivered'
where id = (select id from t_transmission_id);
update public.invoice_transmissions
set status = 'accepted'
where id = (select id from t_transmission_id);

select pg_temp.ok(
  (select submitted_at is not null and delivered_at is not null and completed_at is not null
   from public.invoice_transmissions where id = (select id from t_transmission_id)),
  'Les jalons temporels sont posés par le cycle de transmission'
);
select pg_temp.refuses($sql$
  update public.invoice_transmissions set status = 'queued'
  where id = (select id from t_transmission_id)
$sql$, 'Un état terminal ne revient pas en file d’attente');
select pg_temp.refuses($sql$
  update public.invoice_transmissions set provider_submission_id = 'autre'
  where id = (select id from t_transmission_id)
$sql$, 'L’identifiant de plateforme ne peut pas être remplacé');
select pg_temp.refuses($sql$
  update public.invoice_transmission_events set message = 'réécrit'
$sql$, 'Un événement ne peut pas être réécrit');
select pg_temp.refuses($sql$
  delete from public.invoice_transmission_events
$sql$, 'Un événement ne peut pas être supprimé');
select pg_temp.refuses($sql$
  insert into public.invoice_transmission_events(
    transmission_id, invoice_id, organization_id, source, event_type,
    provider_event_id, occurred_at
  )
  select id, invoice_id, organization_id, 'provider', 'duplicate', 'evt-1', now()
  from public.invoice_transmissions
$sql$, 'Un même événement de plateforme est traité une seule fois');
select pg_temp.refuses(format($sql$
  insert into public.invoice_transmissions(invoice_id, organization_id, provider_code)
  values (%L, gen_random_uuid(), 'sandbox-pa')
$sql$, (select v from pg_temp.t_ref where k = 'transmission_facture_b')),
  'Un brouillon ne peut pas entrer dans le circuit de transmission');
reset role;

select pg_temp.login('patron_a');
set local role authenticated;
select pg_temp.ok((select count(*) from public.invoice_transmissions) = 1,
  'Le propriétaire voit la transmission de son entreprise');
select pg_temp.ok((select count(*) from public.invoice_transmission_events) = 1,
  'Le propriétaire voit la chronologie de son entreprise');
select pg_temp.refuses($sql$
  insert into public.invoice_transmissions(invoice_id, organization_id, provider_code)
  select i.id, i.organization_id, 'faux' from public.invoices i limit 1
$sql$, 'Le navigateur ne peut pas créer une fausse transmission');
select pg_temp.refuses($sql$
  update public.invoice_transmissions set status = 'accepted'
$sql$, 'Le navigateur ne peut pas simuler une acceptation');

select pg_temp.login('patron_b');
select pg_temp.ok((select count(*) from public.invoice_transmissions) = 0,
  'Une autre organisation ne voit aucune transmission');
select pg_temp.ok((select count(*) from public.invoice_transmission_events) = 0,
  'Une autre organisation ne voit aucun événement');

select pg_temp.login('technicien');
select pg_temp.ok((select count(*) from public.invoice_transmissions) = 0,
  'Un technicien sans invoice.view ne voit aucune transmission');
reset role;

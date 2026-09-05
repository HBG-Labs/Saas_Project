
-- =============================================================================
do $$ begin raise notice ''; raise notice '=== SUPER PDP — CONNEXION ET DROITS ==='; end $$;
-- =============================================================================

reset role;
set local role service_role;

insert into public.einvoicing_provider_connections (
  organization_id,
  provider_code,
  status,
  provider_company_id,
  provider_environment,
  company_verification_status,
  access_token_ciphertext,
  refresh_token_ciphertext,
  access_token_expires_at,
  token_type,
  connected_at
)
select
  id,
  'superpdp',
  'connected',
  '42',
  'sandbox',
  'verified',
  'v1.iv.access',
  'v1.iv.refresh',
  now() + interval '30 minutes',
  'Bearer',
  now()
from public.organizations
where slug = 'factu-a';

select pg_temp.refuses($sql$
  update public.einvoicing_provider_connections set provider_code = 'autre'
$sql$, 'Le fournisseur d’une connexion existante est immuable');

select pg_temp.refuses($sql$
  insert into public.einvoicing_provider_connections (
    organization_id, status, company_verification_status,
    access_token_ciphertext, refresh_token_ciphertext, access_token_expires_at
  )
  select id, 'connected', 'needs_review', 'a', 'b', now() + interval '1 hour'
  from public.organizations where slug = 'factu-b'
$sql$, 'Une connexion non verifiee ne peut pas etre annoncee connectee');

reset role;
grant insert, update on pg_temp.t_ref to authenticated;
select pg_temp.login('patron_a');
set local role authenticated;
select pg_temp.ok(
  (select count(*) from public.einvoicing_provider_connections
   where organization_id = (select id from public.organizations where slug = 'factu-a')) = 1,
  'Le proprietaire voit les metadonnees de connexion de son entreprise'
);
select pg_temp.refuses($sql$
  select access_token_ciphertext from public.einvoicing_provider_connections
$sql$, 'Le navigateur ne peut jamais lire le jeton d’acces chiffre');
select pg_temp.refuses($sql$
  select refresh_token_ciphertext from public.einvoicing_provider_connections
$sql$, 'Le navigateur ne peut jamais lire le jeton de renouvellement chiffre');
select pg_temp.refuses($sql$
  insert into public.einvoicing_oauth_states (
    state_sha256, organization_id, user_id, return_url, expires_at
  ) values (
    repeat('a', 64),
    (select id from public.organizations where slug = 'factu-a'),
    pg_temp.uid('patron_a'),
    'https://example.test/organisation/facturation-electronique',
    now() + interval '10 minutes'
  )
$sql$, 'Le navigateur ne peut pas fabriquer un etat OAuth');
select pg_temp.ok(
  public.can_manage_einvoicing_connection(
    (select id from public.organizations where slug = 'factu-a')
  ),
  'Le proprietaire abonne peut gerer le raccordement'
);

do $$
declare
  v_org uuid;
  v_invoice public.invoices;
begin
  select id into v_org from public.organizations where slug = 'factu-a';
  insert into public.invoices (organization_id, title)
  values (v_org, 'Facture B2B a transmettre') returning * into v_invoice;
  perform pg_temp.complete_invoice(v_invoice.id);
  update public.invoices
  set customer_type = 'company', customer_registration_number = '73282932000074'
  where id = v_invoice.id
  returning * into v_invoice;
  perform public.issue_invoice(v_invoice.id, v_invoice.updated_at);
  insert into pg_temp.t_ref(k, v) values ('superpdp_invoice', v_invoice.id)
  on conflict (k) do update set v = excluded.v;
end
$$;

select pg_temp.ok(
  public.can_transmit_invoice((select v from pg_temp.t_ref where k = 'superpdp_invoice')),
  'Le proprietaire peut transmettre une facture B2B emise'
);

select pg_temp.login('technicien');
select pg_temp.ok(
  not public.can_manage_einvoicing_connection(
    (select id from public.organizations where slug = 'factu-a')
  ),
  'Un technicien ne peut pas gerer le raccordement'
);
select pg_temp.ok(
  not public.can_transmit_invoice((select v from pg_temp.t_ref where k = 'superpdp_invoice')),
  'Un technicien ne peut pas transmettre une facture'
);

select pg_temp.login('patron_b');
select pg_temp.ok((select count(*) from public.einvoicing_provider_connections) = 0,
  'Une autre entreprise ne voit pas la connexion');
select pg_temp.ok(
  not public.can_manage_einvoicing_connection(
    (select id from public.organizations where slug = 'factu-a')
  ),
  'Le proprietaire voisin ne peut pas gerer la connexion'
);

reset role;
set local role service_role;
update public.einvoicing_provider_connections
set status = 'disconnected',
    access_token_ciphertext = null,
    refresh_token_ciphertext = null,
    access_token_expires_at = null,
    token_type = null,
    connected_at = null
where organization_id = (select id from public.organizations where slug = 'factu-a');
select pg_temp.ok(
  (select status = 'disconnected' and access_token_ciphertext is null
   from public.einvoicing_provider_connections
   where organization_id = (select id from public.organizations where slug = 'factu-a')),
  'La deconnexion efface les jetons conserves'
);
reset role;

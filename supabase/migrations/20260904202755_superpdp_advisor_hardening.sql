-- Explicitly index the foreign keys used when cleaning up OAuth states and
-- when auditing the user who connected an organization.
create index if not exists einvoicing_oauth_states_organization_idx
  on public.einvoicing_oauth_states (organization_id);

create index if not exists einvoicing_oauth_states_user_idx
  on public.einvoicing_oauth_states (user_id);

create index if not exists einvoicing_provider_connections_connected_by_idx
  on public.einvoicing_provider_connections (connected_by)
  where connected_by is not null;

-- The OAuth state table is deliberately closed to browsers. These policies
-- make that deny-by-default rule explicit; service_role bypasses RLS.
create policy einvoicing_oauth_states_deny_browser_access
on public.einvoicing_oauth_states
for all
to anon, authenticated
using (false)
with check (false);

-- These permission helpers do not need elevated database privileges. Keeping
-- caller privileges active also lets invoice RLS participate in the decision.
create or replace function public.can_manage_einvoicing_connection(p_organization_id uuid)
  returns boolean
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select
      app.can_use_pro_module(p_organization_id, 'invoicing')
      and app.has_org_permission(p_organization_id, 'organization.update')
  $$;

create or replace function public.can_transmit_invoice(p_invoice_id uuid)
  returns boolean
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select exists (
      select 1
      from public.invoices i
      where i.id = p_invoice_id
        and i.status in ('issued', 'sent', 'paid')
        and i.customer_type = 'company'
        and app.can_use_pro_module(i.organization_id, 'invoicing')
        and app.has_org_permission(i.organization_id, 'invoice.manage')
    )
  $$;

revoke all on function public.can_manage_einvoicing_connection(uuid) from public, anon;
revoke all on function public.can_transmit_invoice(uuid) from public, anon;
grant execute on function public.can_manage_einvoicing_connection(uuid) to authenticated, service_role;
grant execute on function public.can_transmit_invoice(uuid) to authenticated, service_role;

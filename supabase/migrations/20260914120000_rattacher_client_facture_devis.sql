-- =============================================================================
-- Rattacher une facture ou un devis à une fiche client, après coup
-- =============================================================================
--
-- Les premières factures et devis ont été créés avec un nom de client en texte
-- libre, sans fiche. Sans `customer_id`, aucun espace client ne peut les
-- montrer. Ce rattachement est un LIEN, pas un contenu : le document émis
-- (nom, adresse, montants, numéro) ne change pas d'un caractère. Il est donc
-- permis même sur une facture émise — mais une seule fois : un document déjà
-- rattaché ne change pas de client, sauf s'il est encore brouillon.
--
-- Deux fonctions, mêmes règles : permission `*.manage`, client de la même
-- organisation, journalisation.
-- =============================================================================

create or replace function public.link_invoice_customer(p_invoice_id uuid, p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_customer_org uuid;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if v_invoice.id is null or not app.has_org_permission(v_invoice.organization_id, 'invoice.manage') then
    raise exception 'Facture inaccessible.' using errcode = '42501';
  end if;
  select organization_id into v_customer_org from public.customers where id = p_customer_id;
  if v_customer_org is null or v_customer_org <> v_invoice.organization_id then
    raise exception 'Client introuvable dans votre organisation.' using errcode = '23503';
  end if;
  if v_invoice.customer_id is not null and v_invoice.status <> 'draft' then
    raise exception 'Une facture émise ne change pas de client.' using errcode = '23514';
  end if;

  update public.invoices set customer_id = p_customer_id where id = v_invoice.id;

  perform app.write_audit_log(
    v_invoice.organization_id, 'invoice.customer_linked', 'invoice', v_invoice.id,
    jsonb_build_object('customer_id', p_customer_id, 'previous_customer_id', v_invoice.customer_id, 'reference', v_invoice.reference)
  );
end;
$$;

revoke all on function public.link_invoice_customer(uuid, uuid) from public, anon;
grant execute on function public.link_invoice_customer(uuid, uuid) to authenticated;

create or replace function public.link_quote_customer(p_quote_id uuid, p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes%rowtype;
  v_customer_org uuid;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if v_quote.id is null or not app.has_org_permission(v_quote.organization_id, 'quote.manage') then
    raise exception 'Devis inaccessible.' using errcode = '42501';
  end if;
  select organization_id into v_customer_org from public.customers where id = p_customer_id;
  if v_customer_org is null or v_customer_org <> v_quote.organization_id then
    raise exception 'Client introuvable dans votre organisation.' using errcode = '23503';
  end if;
  if v_quote.customer_id is not null and v_quote.status <> 'draft' then
    raise exception 'Un devis envoyé ne change pas de client.' using errcode = '23514';
  end if;

  update public.quotes set customer_id = p_customer_id where id = v_quote.id;

  perform app.write_audit_log(
    v_quote.organization_id, 'quote.customer_linked', 'quote', v_quote.id,
    jsonb_build_object('customer_id', p_customer_id, 'previous_customer_id', v_quote.customer_id, 'reference', v_quote.reference)
  );
end;
$$;

revoke all on function public.link_quote_customer(uuid, uuid) from public, anon;
grant execute on function public.link_quote_customer(uuid, uuid) to authenticated;

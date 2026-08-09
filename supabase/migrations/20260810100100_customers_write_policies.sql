-- =============================================================================
-- Correctif de sécurité — écriture sur les contacts et les sites
-- =============================================================================
--
-- LA FAILLE
--
-- Les policies `customer_contacts_write` et `sites_write` étaient déclarées
-- `for all`, avec la permission dans le `using` et la seule visibilité du client
-- dans le `with check` :
--
--   using      (has_org_permission(organization_id, 'customer.update'))
--   with check (customer_id in (select id from customers))
--
-- Or PostgreSQL n'évalue PAS le `using` d'une policy à l'INSERT — seul le
-- `with check` s'applique. La permission n'était donc jamais consultée lors
-- d'une création, et il suffisait de VOIR un client pour lui ajouter des
-- contacts et des sites.
--
-- Le technicien voit précisément le client de sa mission : c'est voulu, il a
-- besoin de l'adresse et des codes d'accès. Il pouvait par conséquent écrire
-- dans la fiche d'un client de son entreprise sans posséder la moindre
-- permission « customer.* ». Vérifié sur la base : `has_org_permission` renvoyait
-- false et l'insertion réussissait quand même.
--
-- LE CORRECTIF
--
-- Une policy par commande, et surtout une condition qui ne dépend pas de
-- `organization_id` porté par la ligne. Cette colonne est écrasée par le trigger
-- `enforce_customer_child_org`, et faire reposer un contrôle de sécurité sur
-- l'ordre relatif des triggers et de RLS serait fragile — un détail
-- d'implémentation ne doit pas décider d'un droit d'accès.
--
-- La permission est donc évaluée sur l'organisation DU CLIENT PARENT, lue depuis
-- `customers` — donc elle-même filtrée par `customers_select`. Deux conditions
-- se cumulent ainsi naturellement : voir le client, ET détenir `customer.update`
-- dans son organisation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- customer_contacts
-- -----------------------------------------------------------------------------
drop policy if exists "customer_contacts_write" on public.customer_contacts;

drop policy if exists "customer_contacts_insert" on public.customer_contacts;
create policy "customer_contacts_insert"
  on public.customer_contacts for insert
  to authenticated
  with check (
    customer_id in (
      select c.id
      from public.customers c
      where (select app.has_org_permission(c.organization_id, 'customer.update'))
    )
  );

drop policy if exists "customer_contacts_update" on public.customer_contacts;
create policy "customer_contacts_update"
  on public.customer_contacts for update
  to authenticated
  using (
    customer_id in (
      select c.id
      from public.customers c
      where (select app.has_org_permission(c.organization_id, 'customer.update'))
    )
  )
  -- Répété dans le `with check` : sans lui, on pourrait déplacer un contact vers
  -- un client sur lequel on n'a aucun droit.
  with check (
    customer_id in (
      select c.id
      from public.customers c
      where (select app.has_org_permission(c.organization_id, 'customer.update'))
    )
  );

drop policy if exists "customer_contacts_delete" on public.customer_contacts;
create policy "customer_contacts_delete"
  on public.customer_contacts for delete
  to authenticated
  using (
    customer_id in (
      select c.id
      from public.customers c
      where (select app.has_org_permission(c.organization_id, 'customer.update'))
    )
  );

-- -----------------------------------------------------------------------------
-- sites
-- -----------------------------------------------------------------------------
drop policy if exists "sites_write" on public.sites;

drop policy if exists "sites_insert" on public.sites;
create policy "sites_insert"
  on public.sites for insert
  to authenticated
  with check (
    customer_id in (
      select c.id
      from public.customers c
      where (select app.has_org_permission(c.organization_id, 'customer.update'))
    )
  );

drop policy if exists "sites_update" on public.sites;
create policy "sites_update"
  on public.sites for update
  to authenticated
  using (
    customer_id in (
      select c.id
      from public.customers c
      where (select app.has_org_permission(c.organization_id, 'customer.update'))
    )
  )
  with check (
    customer_id in (
      select c.id
      from public.customers c
      where (select app.has_org_permission(c.organization_id, 'customer.update'))
    )
  );

drop policy if exists "sites_delete" on public.sites;
create policy "sites_delete"
  on public.sites for delete
  to authenticated
  using (
    customer_id in (
      select c.id
      from public.customers c
      where (select app.has_org_permission(c.organization_id, 'customer.update'))
    )
  );

-- Note : la lecture reste inchangée. Le technicien doit continuer à atteindre le
-- site de sa mission — adresse et consignes d'accès — sans que cela lui ouvre le
-- moindre droit d'écriture.

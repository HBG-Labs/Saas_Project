-- =============================================================================
-- Facture émise : autoriser UN rattachement à une fiche client, rien d'autre
-- =============================================================================
--
-- `enforce_invoice_immutable` fige la ligne entière d'une facture émise, moins
-- `status` et `updated_at` — et ce document disait : « rendre une colonne
-- modifiable devient un acte délibéré ». Le voici.
--
-- `customer_id` est un LIEN vers une fiche, pas un contenu du document : le
-- nom, l'adresse, les montants et le numéro sont recopiés dans la facture au
-- moment de l'émission (`customer_name`, `customer_address_*`…) et restent
-- figés. Poser ce lien après coup ne change pas ce que le client a reçu ; il
-- permet seulement à son espace client de retrouver la facture.
--
-- L'autorisation est étroite : de NULL vers une valeur, une seule fois. Une
-- facture émise déjà rattachée ne change pas de client — c'est
-- `link_invoice_customer` qui rattache, et il vérifie l'organisation.
-- =============================================================================

create or replace function app.enforce_invoice_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_modifiables constant text[] := array['status', 'updated_at'];
  v_avant jsonb;
  v_apres jsonb;
begin
  if old.status = 'draft' then
    return new;
  end if;

  v_avant := to_jsonb(old) - v_modifiables;
  v_apres := to_jsonb(new) - v_modifiables;

  -- Rattachement d'une facture sans fiche : la seule autre évolution admise.
  if old.customer_id is null and new.customer_id is not null then
    v_avant := v_avant - 'customer_id';
    v_apres := v_apres - 'customer_id';
  end if;

  if v_avant is distinct from v_apres then
    raise exception
      'Facture % déjà émise : son contenu ne peut plus être modifié. Émettez un avoir.',
      old.reference
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

-- Contrôle : une facture émise reste figée sur tout le reste.
do $$
begin
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where c.relname = 'invoices' and t.tgname = 'invoices_immutable' and not t.tgisinternal
  ) then
    raise exception 'Le trigger invoices_immutable a disparu.';
  end if;
end
$$;

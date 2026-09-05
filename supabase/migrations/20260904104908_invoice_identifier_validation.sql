-- Validate the invoice snapshot at issuance, including calls made outside the UI.
-- Drafts remain editable and existing issued documents remain immutable.
create function app.validate_invoice_identifiers()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_party record;
  v_registration text;
  v_vat text;
begin
  if old.status <> 'draft' or new.status = 'draft' then return new; end if;
  for v_party in
    select * from (values
      ('votre entreprise', new.seller_country, new.seller_registration_number, new.seller_vat_number, true),
      ('ce client', new.customer_country, new.customer_registration_number, new.customer_vat_number,
        new.customer_type in ('company', 'public_body'))
    ) as parties(label, country, registration, vat, professional)
  loop
    if upper(btrim(v_party.country)) = 'FR' and v_party.professional then
      v_registration := regexp_replace(coalesce(v_party.registration, ''), '[\s  ]', '', 'g');
      v_vat := upper(regexp_replace(coalesce(v_party.vat, ''), '[\s  ]', '', 'g'));
      if v_registration !~ '^([0-9]{9}|[0-9]{14})$' then
        raise exception 'Identifiant invalide pour % : indiquez un SIREN de 9 chiffres ou un SIRET de 14 chiffres.', v_party.label
          using errcode = '23514';
      end if;
      -- Missing VAT remains governed by the existing tax-regime checks.
      if v_vat <> '' and v_vat !~ '^FR[A-Z0-9]{2}[0-9]{9}$' then
        raise exception 'Numéro de TVA invalide pour % : format FR, clé de 2 caractères et SIREN de 9 chiffres.', v_party.label
          using errcode = '23514';
      end if;
    end if;
  end loop;
  return new;
end;
$$;

-- Runs after the seller snapshot trigger (alphabetical PostgreSQL trigger order).
create trigger invoices_validate_identifiers before update on public.invoices
for each row execute function app.validate_invoice_identifiers();
revoke all on function app.validate_invoice_identifiers() from public, anon, authenticated;

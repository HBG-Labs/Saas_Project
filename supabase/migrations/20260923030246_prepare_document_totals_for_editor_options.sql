-- Compatibility bridge for projects where the legacy totals views already
-- exist. PostgreSQL does not let CREATE OR REPLACE VIEW rename existing
-- columns, while 20261007090000 expands both views by inserting the gross and
-- discount columns before the former subtotal columns.
--
-- Renaming the three legacy columns makes the leading column signature match
-- the expanded view. The following migration immediately replaces the view
-- definitions and appends vat_cents and total_cents again. No table data is
-- changed or deleted.
do $$
begin
  if to_regclass('public.quote_totals') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'quote_totals'
         and column_name = 'subtotal_cents'
     )
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'quote_totals'
         and column_name = 'gross_subtotal_cents'
     ) then
    execute 'alter view public.quote_totals rename column subtotal_cents to gross_subtotal_cents';
    execute 'alter view public.quote_totals rename column vat_cents to discount_cents';
    execute 'alter view public.quote_totals rename column total_cents to subtotal_cents';
  end if;

  if to_regclass('public.invoice_totals') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'invoice_totals'
         and column_name = 'subtotal_cents'
     )
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'invoice_totals'
         and column_name = 'gross_subtotal_cents'
     ) then
    execute 'alter view public.invoice_totals rename column subtotal_cents to gross_subtotal_cents';
    execute 'alter view public.invoice_totals rename column vat_cents to discount_cents';
    execute 'alter view public.invoice_totals rename column total_cents to subtotal_cents';
  end if;
end;
$$;

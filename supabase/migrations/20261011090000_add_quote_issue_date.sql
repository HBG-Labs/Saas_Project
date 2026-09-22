-- La date choisie dans l'editeur doit survivre a l'enregistrement du devis.
-- Les devis historiques reprennent leur date de creation, qui etait jusque-la
-- la seule date affichee sur le document.
alter table public.quotes
  add column issue_date date;

update public.quotes
set issue_date = created_at::date
where issue_date is null;

alter table public.quotes
  alter column issue_date set default current_date,
  alter column issue_date set not null;

comment on column public.quotes.issue_date is
  'Date d emission choisie sur le devis, independante de la date technique de creation.';

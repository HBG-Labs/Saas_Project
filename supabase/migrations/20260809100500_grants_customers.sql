-- =============================================================================
-- Privilèges des tables Clients et contrôle général de RLS
-- =============================================================================
--
-- Première des trois barrières : les privilèges. RLS ne filtre que ce que le
-- rôle a déjà le droit d'atteindre — sans grant, la requête est refusée en
-- 42501 avant même l'évaluation des policies. C'est ce qui rend le catalogue
-- lisible par un visiteur anonyme et les tables métier totalement inatteignables
-- pour lui.
-- =============================================================================

do $$
declare
  v_table text;
begin
  foreach v_table in array array['customers', 'customer_contacts', 'sites'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', v_table);
  end loop;
end
$$;

-- `anon` n'est jamais mentionné : un visiteur non connecté n'a aucune raison
-- d'approcher le fichier client d'une entreprise.
grant select, insert, update, delete on public.customers         to authenticated;
grant select, insert, update, delete on public.customer_contacts to authenticated;
grant select, insert, update, delete on public.sites             to authenticated;

-- -----------------------------------------------------------------------------
-- Contrôle d'installation
-- -----------------------------------------------------------------------------
--
-- Rejoue la vérification de 20260808100900_grants.sql sur le schéma complété.
-- Une table de `public` sans RLS est lisible par quiconque possède la clé
-- publiable — laquelle est, par construction, embarquée dans le bundle du
-- navigateur. L'échec doit donc être bruyant et immédiat.
do $$
declare
  v_unprotected text[];
begin
  select array_agg(c.relname order by c.relname)
  into v_unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if v_unprotected is not null then
    raise exception 'Tables sans RLS dans public : %', array_to_string(v_unprotected, ', ');
  end if;

  raise notice 'RLS active sur toutes les tables de public.';
end
$$;

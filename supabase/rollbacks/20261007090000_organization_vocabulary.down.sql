-- Retour arrière de 20261007090000_organization_vocabulary.sql — À LA MAIN, JAMAIS PAR db push.
-- PERTE DE DONNÉES : les dictionnaires de toutes les organisations.
begin;
drop function if exists public.suggest_organization_vocabulary(uuid);
drop trigger if exists organization_vocabulary_guard on public.organization_vocabulary;
drop function if exists app.guard_organization_vocabulary();
drop table if exists public.organization_vocabulary;
commit;

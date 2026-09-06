-- =============================================================================
-- Sortir pg_net du schema public
-- =============================================================================
--
-- `20260906165517` l'a installe avec un simple `create extension pg_net`, sans
-- schema : l'extension s'est donc DECLAREE dans `public`, ce que le conseiller
-- Supabase signale. Ses objets, eux, vivent bien dans `net` — c'est l'extension
-- qui cree ce schema — et `net.http_post` resout correctement. La portee est
-- donc cosmetique : rien n'est reellement expose dans `public`.
--
-- ATTENTION, cette migration est la seule du lot a comporter un risque reel.
-- `pg_net` n'est pas relocalisable : il faut le supprimer puis le recreer. La
-- suppression emporte `net.http_request_queue` et `net._http_response`, donc
-- toute requete en vol. La fenetre est etroite — l'ordonnanceur n'emet qu'un
-- appel toutes les quinze minutes, qui dure moins de deux secondes — mais elle
-- existe. A appliquer de preference hors d'un quart d'heure rond.
--
-- La migration s'execute dans une transaction : si la recreation echoue, la
-- suppression est annulee et l'extension reste en place.

drop extension if exists pg_net;
-- Le schema survit parfois a la suppression de l'extension, et empeche alors
-- sa recreation. La documentation Supabase le retire explicitement.
drop schema if exists net cascade;

create extension pg_net with schema extensions;

-- Controle : sans lui, une mauvaise resolution ne se verrait qu'au premier
-- reveil de l'ordonnanceur, sous la forme d'un echec silencieux.
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'net' and p.proname = 'http_post'
  ) then
    raise exception 'net.http_post est introuvable apres recreation de pg_net.';
  end if;

  if (select n.nspname from pg_namespace n
      join pg_extension e on e.extnamespace = n.oid
      where e.extname = 'pg_net') = 'public' then
    raise exception 'pg_net est toujours declare dans public.';
  end if;
end
$$;

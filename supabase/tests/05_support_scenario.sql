-- =============================================================================
-- SUITE DE TESTS — demandes d'assistance
-- =============================================================================
-- CE QUE CE FICHIER PROTÈGE
--
-- Le formulaire d'assistance a passé des semaines à simuler un envoi : neuf
-- cents millisecondes, puis « message envoyé », et rien de transmis. Le défaut
-- n'était visible d'aucun écran — il fallait attendre qu'un client s'étonne du
-- silence.
--
-- Deux règles portent désormais la correction, et aucune des deux ne produit
-- d'erreur visible si elle se relâche :
--
--   • ÉCRIRE EST OUVERT À TOUS, y compris à un visiteur non connecté. Refermer
--     cette porte couperait le seul moyen de contact d'un prospect, sans que
--     rien ne le signale — le formulaire s'afficherait comme d'habitude.
--   • LIRE N'EST OUVERT À PERSONNE. Une policy de lecture ajoutée « pour plus
--     tard » exposerait les demandes de tous les clients à tous les clients.
--
--   npm run test:sql
--
-- Le script se termine par `rollback` : il ne laisse AUCUNE donnée derrière lui.
-- =============================================================================

begin;

set local search_path = pg_temp, public;

create function pg_temp.ok(p_condition boolean, p_label text) returns void
language plpgsql as $$
begin
  -- `is not true` et non `not p_condition` : en SQL, `not null` vaut `null`, et
  -- un `if null then` ne s'exécute pas. La version naïve laisse donc PASSER en
  -- silence toute assertion dont l'expression vaut NULL.
  if p_condition is not true then
    raise exception 'ECHEC : % (condition %)', p_label, coalesce(p_condition::text, 'NULL')
      using errcode = 'assert_failure';
  end if;
  raise notice '  OK  %', p_label;
end;
$$;

create function pg_temp.refuses(p_sql text, p_label text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ECHEC : % (l''instruction a ete ACCEPTEE)', p_label
    using errcode = 'assert_failure';
exception
  when assert_failure then raise;
  when others then raise notice '  OK  % (refuse : %)', p_label, left(sqlerrm, 70);
end;
$$;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 1 — Un visiteur anonyme peut ecrire ==='; end $$;
-- =============================================================================

set local role anon;

insert into public.support_requests (name, email, message)
values ('Prospect Anonyme', 'prospect@exemple.fr', 'Votre offre couvre-t-elle la fibre ?');

reset role;

do $$
begin
  perform pg_temp.ok(
    (select count(*) from public.support_requests where email = 'prospect@exemple.fr') = 1,
    'Un visiteur non connecte depose sa demande');

  perform pg_temp.ok(
    (select user_id is null from public.support_requests where email = 'prospect@exemple.fr'),
    'Elle n''est rattachee a aucun compte');
end
$$;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 2 — Personne ne peut lire ==='; end $$;
-- =============================================================================
--
-- L'absence de policy SELECT est le coeur du dispositif. On l'eprouve depuis
-- les deux roles clients : sans cela, une policy ajoutee un jour « pour un
-- ecran d'administration » ouvrirait les demandes de tous a tous.

set local role anon;
do $$
begin
  perform pg_temp.ok(
    (select count(*) from public.support_requests) = 0,
    'Un anonyme ne lit AUCUNE demande, pas meme la sienne');
end
$$;
reset role;

set local role authenticated;
do $$
begin
  perform pg_temp.ok(
    (select count(*) from public.support_requests) = 0,
    'Un compte connecte ne lit aucune demande non plus');
end
$$;
reset role;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 3 — On n''usurpe pas une identite ==='; end $$;
-- =============================================================================

set local role anon;
do $$
begin
  -- `user_id` doit etre le sien, ou nul. Un anonyme n'ayant pas d'identite, il
  -- ne peut deposer qu'anonymement.
  perform pg_temp.refuses($sql$
    insert into public.support_requests (user_id, name, email, message)
    values ('00000000-0000-4000-8000-0000000000ff', 'Faussaire', 'faux@exemple.fr', 'Bonjour')
  $sql$, 'Un anonyme ne peut pas signer au nom d''un compte');
end
$$;
reset role;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 4 — Le plafond par adresse ==='; end $$;
-- =============================================================================
--
-- Cinq demandes par heure et par adresse. On eprouve les DEUX cotes du seuil :
-- une assertion qui ne verifierait que le refus passerait aussi sur une
-- fonction qui refuse tout.

do $$
declare i integer;
begin
  for i in 1..4 loop
    insert into public.support_requests (name, email, message)
    values ('Insistant', 'insistant@exemple.fr', 'Message ' || i::text);
  end loop;

  perform pg_temp.ok(
    (select count(*) from public.support_requests where email = 'insistant@exemple.fr') = 4,
    'Quatre demandes de la meme adresse passent');

  -- La cinquieme aussi : le seuil est a cinq, elle l'atteint sans le depasser.
  insert into public.support_requests (name, email, message)
  values ('Insistant', 'insistant@exemple.fr', 'Message 5');

  perform pg_temp.ok(
    (select count(*) from public.support_requests where email = 'insistant@exemple.fr') = 5,
    'La cinquieme passe encore');

  -- La sixieme est refusee, et le message doit etre exploitable par celui qui
  -- le lit : il porte l'adresse de repli.
  perform pg_temp.refuses($sql$
    insert into public.support_requests (name, email, message)
    values ('Insistant', 'insistant@exemple.fr', 'Message 6')
  $sql$, 'La sixieme est refusee');

  -- La casse ne contourne pas le plafond : compter par `lower(email)` est ce
  -- qui empeche de le franchir en variant les majuscules.
  perform pg_temp.refuses($sql$
    insert into public.support_requests (name, email, message)
    values ('Insistant', 'INSISTANT@exemple.fr', 'Message 7')
  $sql$, 'Changer la casse de l''adresse ne contourne pas le plafond');

  -- Une AUTRE adresse n'est pas genee : le plafond vise la repetition, pas le
  -- service.
  insert into public.support_requests (name, email, message)
  values ('Quelqu''un d''autre', 'autre@exemple.fr', 'Bonjour');

  perform pg_temp.ok(
    (select count(*) from public.support_requests where email = 'autre@exemple.fr') = 1,
    'Une autre adresse passe malgre le plafond du voisin');
end
$$;

-- =============================================================================
do $$
begin
  raise notice '';
  raise notice '=============================================';
  raise notice ' TOUS LES TESTS PASSENT';
  raise notice '=============================================';
end
$$;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;

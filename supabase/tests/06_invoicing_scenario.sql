-- =============================================================================
-- SUITE DE TESTS — factures
-- =============================================================================
-- CE QUE CE FICHIER PROTÈGE
--
-- Une facture fausse ne lève aucune erreur. Elle part chez le client, elle est
-- comptabilisée, et ce sont un contrôle fiscal ou un litige qui la signalent —
-- pas un test. Quatre familles de défauts se paient particulièrement cher :
--
--   • un numéro réattribué ou manquant dans la série ;
--   • un document émis qu'on peut encore modifier ;
--   • une TVA arrondie ligne à ligne, qui dérive de quelques centimes ;
--   • une facture visible par une autre entreprise.
--
-- POURQUOI DU SQL ET NON DES TESTS TYPESCRIPT
--
-- Tout ce qui est vérifié ici — RLS, triggers, contraintes, arrondis — s'exécute
-- DANS PostgreSQL. Un test passant par le client JS mesurerait surtout la bonne
-- foi du client. On endosse donc l'identité d'un utilisateur au niveau de la
-- session, exactement comme le fait PostgREST, et on constate ce que la base
-- accorde ou refuse.
--
--   npm run test:sql
--
-- Le script se termine par `rollback` : il ne laisse AUCUNE donnée derrière lui.
-- =============================================================================

begin;

set local search_path = pg_temp, public;

-- -----------------------------------------------------------------------------
-- Utilitaires — même dispositif que les suites 01 à 05
-- -----------------------------------------------------------------------------
create temporary table t_ids (k text primary key, v uuid);

insert into t_ids (k, v) values
  ('patron_a',   '00000000-0000-4000-8000-00000000f001'),
  ('technicien', '00000000-0000-4000-8000-00000000f002'),
  ('patron_b',   '00000000-0000-4000-8000-00000000f003');

grant select on t_ids to authenticated;

-- Identifiants capturés HORS contexte RLS, pour pouvoir les présenter ensuite
-- depuis une session qui n'a pas le droit de les lire.
--
-- Sans ce détour, un test d'étanchéité se trompe de cible : une sous-requête
-- cherchant la facture du voisin s'exécute sous la RLS de l'appelant, ne trouve
-- rien, et rend NULL. L'insertion passe alors — non parce que la garde est
-- absente, mais parce qu'on ne lui a rien donné à refuser. Le premier jet de
-- cette suite est tombé exactement là.
create temporary table t_ref (k text primary key, v uuid);
grant select on t_ref to authenticated;

create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

create function pg_temp.login(p_key text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(p_key), 'email', p_key || '@test.local',
                      'role', 'authenticated')::text, true);
end;
$$;

create function pg_temp.ok(p_condition boolean, p_label text) returns void
language plpgsql as $$
begin
  -- `is not true` et non `not p_condition` : `not null` vaut `null`, et un
  -- `if null then` ne s'exécute pas — l'assertion passerait en silence.
  if p_condition is not true then
    raise exception 'ECHEC : % (condition %)', p_label,
      coalesce(p_condition::text, 'NULL')
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
  when others then raise notice '  OK  % (refuse : %)', p_label, left(sqlerrm, 60);
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select '00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated',
       k || '@test.local', '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte',
       now(), '{"provider":"email","providers":["email"]}'::jsonb,
       json_build_object('display_name', k)::jsonb, now(), now()
from pg_temp.t_ids;

-- Deux entreprises distinctes, chacune abonnée : `invoicing` est ouverte dès
-- Starter, et sans abonnement `app.can_use_pro_module` refuserait tout.
select pg_temp.login('patron_a');
set local role authenticated;
insert into public.organizations (slug, name, created_by, industry)
values ('factu-a', 'Facturation A', pg_temp.uid('patron_a'), 'fiber_telecom');
reset role;

select pg_temp.login('patron_b');
set local role authenticated;
insert into public.organizations (slug, name, created_by, industry)
values ('factu-b', 'Facturation B', pg_temp.uid('patron_b'), 'hvac');
reset role;

delete from public.subscriptions
where organization_id in (select id from public.organizations where slug in ('factu-a', 'factu-b'));

insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select id, 'pro', 'active', now() + interval '30 days'
from public.organizations where slug in ('factu-a', 'factu-b');

insert into public.organization_members (organization_id, user_id, role, status)
select id, pg_temp.uid('technicien'), 'technician', 'active'
from public.organizations where slug = 'factu-a';

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — La numerotation ne se reattribue jamais ==='; end $$;
-- =============================================================================

select pg_temp.login('patron_a');
set local role authenticated;

do $$
declare
  v_org  uuid;
  v_an   text := extract(year from now())::text;
  v_f1   text;
  v_f2   text;
  v_f3   text;
  v_id2  uuid;
begin
  select id into v_org from public.organizations where slug = 'factu-a';

  insert into public.invoices (organization_id) values (v_org) returning reference into v_f1;
  insert into public.invoices (organization_id) values (v_org)
    returning reference, id into v_f2, v_id2;
  insert into public.invoices (organization_id) values (v_org) returning reference into v_f3;

  perform pg_temp.ok(v_f1 = 'FAC-' || v_an || '-00001', 'La premiere facture porte le numero 1');
  perform pg_temp.ok(v_f2 = 'FAC-' || v_an || '-00002', 'La deuxieme suit');
  perform pg_temp.ok(v_f3 = 'FAC-' || v_an || '-00003', 'La troisieme aussi');

  -- LE DEFAUT DES DEVIS, ECRIT NOIR SUR BLANC : leur trigger fait `max() + 1`,
  -- donc supprimer le dernier fait REGRESSER le compteur et reattribue un
  -- numero deja utilise. Le compteur des factures, lui, ne redescend pas.
  delete from public.invoices where id = v_id2;

  insert into public.invoices (organization_id) values (v_org) returning reference into v_f3;
  perform pg_temp.ok(v_f3 = 'FAC-' || v_an || '-00004',
    'Supprimer un brouillon ne rend PAS son numero');

  -- Les avoirs ont leur propre serie : les meler aux factures rendrait la serie
  -- des factures discontinue.
  insert into public.invoices (organization_id, document_type)
  values (v_org, 'credit_note') returning reference into v_f1;
  perform pg_temp.ok(v_f1 = 'AV-' || v_an || '-00001', 'Les avoirs ont leur propre serie');
end
$$;

-- Chaque entreprise a sa propre serie, remise a 1.
select pg_temp.login('patron_b');
set local role authenticated;

do $$
declare v_org uuid; v_ref text;
begin
  select id into v_org from public.organizations where slug = 'factu-b';
  insert into public.invoices (organization_id) values (v_org) returning reference into v_ref;
  perform pg_temp.ok(v_ref = 'FAC-' || extract(year from now())::text || '-00001',
    'La serie repart a 1 dans une autre entreprise');
end
$$;

reset role;

-- On note l'identifiant de la facture de B pendant qu'on peut encore la voir.
insert into t_ref (k, v)
select 'facture_b', i.id
from public.invoices i
join public.organizations o on o.id = i.organization_id
where o.slug = 'factu-b'
limit 1;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 2 — La TVA s''arrondit par TAUX, pas par ligne ==='; end $$;
-- =============================================================================

select pg_temp.login('patron_a');
set local role authenticated;

do $$
declare
  v_org uuid;
  v_inv uuid;
  v_sous integer;
  v_tva  integer;
  v_tot  integer;
  v_lignes integer;
begin
  select id into v_org from public.organizations where slug = 'factu-a';

  insert into public.invoices (organization_id, title)
  values (v_org, 'Deux taux') returning id into v_inv;

  -- Trois lignes a 8,5 % dont l'arrondi ligne a ligne differe de l'arrondi du
  -- groupe : 333 centimes a 8,5 % font 28,305 c. Arrondis separement puis
  -- sommes -> 28 x 3 = 84. Arrondi sur la base groupee -> round(999 x 0,085)
  -- = round(84,915) = 85. UN CENTIME d'ecart, et c'est le second qui est juste.
  insert into public.invoice_items
    (invoice_id, organization_id, description, quantity, unit_price_cents, vat_rate, position)
  values
    (v_inv, v_org, 'Main d''oeuvre 1', 1, 333, 8.5, 0),
    (v_inv, v_org, 'Main d''oeuvre 2', 1, 333, 8.5, 1),
    (v_inv, v_org, 'Main d''oeuvre 3', 1, 333, 8.5, 2),
    (v_inv, v_org, 'Fournitures',      1, 1000, 20,  3);

  select subtotal_cents, vat_cents, total_cents
    into v_sous, v_tva, v_tot
  from public.invoice_totals where invoice_id = v_inv;

  perform pg_temp.ok(v_sous = 1999, 'Base HT = 999 + 1000 centimes');
  perform pg_temp.ok(v_tva = 85 + 200,
    'TVA = round(999 x 8,5%) + round(1000 x 20%) = 85 + 200, et non 84 + 200');
  perform pg_temp.ok(v_tot = 1999 + 285, 'Le TTC decoule des deux');

  select count(*) into v_lignes
  from public.invoice_vat_breakdown where invoice_id = v_inv;
  perform pg_temp.ok(v_lignes = 2, 'La ventilation compte une ligne par taux');

  perform pg_temp.ok(
    (select base_cents from public.invoice_vat_breakdown
      where invoice_id = v_inv and vat_rate = 8.5) = 999,
    'La base du taux reduit est bien groupee');
end
$$;

-- Une facture sans ligne vaut zero, elle ne disparait pas de la liste.
do $$
declare v_org uuid; v_inv uuid; v_tot integer;
begin
  select id into v_org from public.organizations where slug = 'factu-a';
  insert into public.invoices (organization_id) values (v_org) returning id into v_inv;
  select total_cents into v_tot from public.invoice_totals where invoice_id = v_inv;
  perform pg_temp.ok(v_tot = 0, 'Une facture sans ligne totalise zero, sans disparaitre');
end
$$;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 3 — Une facture emise est figee ==='; end $$;
-- =============================================================================

do $$
declare v_org uuid; v_inv uuid;
begin
  select id into v_org from public.organizations where slug = 'factu-a';

  insert into public.invoices (organization_id, title) values (v_org, 'A figer')
  returning id into v_inv;

  insert into public.invoice_items
    (invoice_id, organization_id, description, quantity, unit_price_cents, vat_rate)
  values (v_inv, v_org, 'Prestation', 1, 10000, 20);

  -- Tant qu'elle est brouillon, tout est permis.
  update public.invoices set title = 'Encore modifiable' where id = v_inv;
  perform pg_temp.ok(true, 'Un brouillon se modifie librement');

  -- Un document qui quitte l'etat de brouillon SANS date d'emission est refuse :
  -- sans elle, ni l'echeance, ni l'exercice comptable ne veulent dire quoi que
  -- ce soit.
  perform pg_temp.refuses(
    format($sql$ update public.invoices set status = 'issued' where id = %L $sql$, v_inv),
    'Emettre sans date d''emission est refuse'
  );

  update public.invoices set status = 'issued', issued_at = now() where id = v_inv;
  perform pg_temp.ok(true, 'L''emission avec date passe');

  perform pg_temp.refuses(
    format($sql$ update public.invoices set title = 'Retouche' where id = %L $sql$, v_inv),
    'Le contenu d''une facture emise ne se modifie plus'
  );

  perform pg_temp.refuses(
    format($sql$ update public.invoices set reference = 'FAC-1900-00001' where id = %L $sql$, v_inv),
    'Son numero non plus'
  );

  perform pg_temp.refuses(
    format($sql$ delete from public.invoices where id = %L $sql$, v_inv),
    'Elle ne se supprime pas'
  );

  -- LE PIEGE QUE CE TEST FERME : sans trigger sur les lignes, on changerait les
  -- montants d'un document emis sans jamais toucher au document lui-meme.
  perform pg_temp.refuses(
    format($sql$ update public.invoice_items set unit_price_cents = 1
                 where invoice_id = %L $sql$, v_inv),
    'Ses lignes non plus'
  );

  perform pg_temp.refuses(
    format($sql$ delete from public.invoice_items where invoice_id = %L $sql$, v_inv),
    'Et elles ne se suppriment pas'
  );

  perform pg_temp.refuses(
    format($sql$ insert into public.invoice_items
                 (invoice_id, organization_id, description, quantity, unit_price_cents, vat_rate)
                 values (%L, %L, 'Ligne ajoutee apres coup', 1, 5000, 20) $sql$, v_inv, v_org),
    'On ne lui ajoute pas de ligne apres coup'
  );

  -- Ce qui DOIT rester possible : faire vivre le document.
  update public.invoices set status = 'sent' where id = v_inv;
  update public.invoices set status = 'paid' where id = v_inv;
  perform pg_temp.ok(
    (select status from public.invoices where id = v_inv) = 'paid',
    'Le statut, lui, continue d''evoluer');
end
$$;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 4 — Etancheite entre entreprises et entre roles ==='; end $$;
-- =============================================================================

do $$
declare v_a uuid; v_b uuid; v_vue integer;
begin
  select id into v_a from public.organizations where slug = 'factu-a';
  select id into v_b from public.organizations where slug = 'factu-b';

  -- Le patron A voit les siennes, et seulement les siennes.
  select count(*) into v_vue from public.invoices where organization_id = v_b;
  perform pg_temp.ok(v_vue = 0, 'Le patron A ne voit aucune facture de l''entreprise B');

  select count(*) into v_vue from public.invoices where organization_id = v_a;
  perform pg_temp.ok(v_vue > 0, 'Mais il voit bien les siennes');

  -- Ecrire chez le voisin est refuse par la policy, pas seulement invisible.
  perform pg_temp.refuses(
    format($sql$ insert into public.invoices (organization_id) values (%L) $sql$, v_b),
    'Il ne peut pas creer de facture chez B'
  );

  -- L'identifiant vient de `t_ref`, capture hors RLS : le presenter revient a
  -- supposer un appelant qui l'aurait obtenu par un autre canal. C'est bien la
  -- garde de coherence qu'on eprouve ici, et non l'invisibilite.
  perform pg_temp.refuses(
    format($sql$ insert into public.invoices (organization_id, document_type, corrects_invoice_id)
                 values (%L, 'credit_note', %L) $sql$,
           v_a, (select v from pg_temp.t_ref where k = 'facture_b')),
    'Un avoir ne peut pas corriger la facture d''une autre entreprise'
  );
end
$$;

-- Le technicien est membre de A, et ne doit RIEN voir de la facturation : le
-- chiffre d'affaires ne le regarde pas, exactement comme le fichier client.
select pg_temp.login('technicien');
set local role authenticated;

do $$
declare v_a uuid; v_vue integer;
begin
  select id into v_a from public.organizations where slug = 'factu-a';

  select count(*) into v_vue from public.invoices;
  perform pg_temp.ok(v_vue = 0, 'Le technicien ne voit aucune facture');

  select count(*) into v_vue from public.invoice_items;
  perform pg_temp.ok(v_vue = 0, 'Ni aucune ligne de facture');

  perform pg_temp.refuses(
    format($sql$ insert into public.invoices (organization_id) values (%L) $sql$, v_a),
    'Et il ne peut pas en creer'
  );
end
$$;

-- Le compteur n'est accessible a personne : seul le trigger y ecrit, et il est
-- `security definer`.
--
-- Le refus vient des PRIVILEGES, pas de la RLS : `revoke all` sans `grant`
-- rejette la lecture avec « permission denied » au lieu de rendre zero ligne.
-- C'est plus fort qu'une policy vide — une policy oubliee laisse lire, un
-- privilege absent non. Le premier jet de ce test attendait un comptage a zero
-- et se trompait donc de garantie, en plus d'echouer.
do $$
begin
  perform pg_temp.refuses(
    'select count(*) from public.invoice_counters',
    'Le compteur de numerotation n''est lisible par personne'
  );
  perform pg_temp.refuses(
    'update public.invoice_counters set last_value = 0',
    'Et personne ne peut le remettre a zero pour rejouer un numero'
  );
end
$$;

reset role;

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

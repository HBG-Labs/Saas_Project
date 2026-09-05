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

update public.organizations set legal_form = 'SARL', share_capital_cents = 100000, registration_number = '12345678900012', vat_regime = 'reel_normal',
  vat_number = 'FR12345678901', address_line1 = '1 rue du Test', postal_code = '97200', city = 'Fort-de-France', country = 'FR'
where slug in ('factu-a','factu-b');

create function pg_temp.complete_invoice(p_id uuid) returns void language plpgsql as $$
begin
  update public.invoices set customer_name = 'Client test', customer_type = 'individual',
    customer_address_line1 = '2 rue du Test', customer_postal_code = '97200', customer_city = 'Fort-de-France', customer_country = 'FR',
    service_date = current_date, operation_type = 'services', early_payment_terms = 'Escompte : néant.', late_payment_terms = 'Trois fois le taux légal.', vat_on_debits = false,
    due_date = current_date + 30, payment_terms = 'Paiement sous 30 jours.' where id = p_id;
  insert into public.invoice_items(invoice_id, organization_id, description, quantity, unit_price_cents, vat_rate)
    select id, organization_id, 'Prestation test', 1, 10000, 20 from public.invoices
    where id = p_id and not exists (select 1 from public.invoice_items where invoice_id = p_id);
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — La numerotation ne se reattribue jamais ==='; end $$;
-- =============================================================================

select pg_temp.login('patron_a');
set local role authenticated;

do $$
declare v_org uuid; v_one public.invoices; v_two public.invoices;
begin
  select id into v_org from public.organizations where slug = 'factu-a';
  insert into public.invoices (organization_id) values (v_org) returning * into v_one;
  insert into public.invoices (organization_id) values (v_org) returning * into v_two;
  perform pg_temp.ok(v_one.reference like 'BR-%' and v_two.reference like 'BR-%', 'Les brouillons ont une reference provisoire');
  perform pg_temp.ok(v_one.reference <> v_two.reference, 'Les references provisoires sont uniques');
  delete from public.invoices where id = v_two.id;
  perform pg_temp.ok(v_one.issued_at is null, 'La date emission reste absente du brouillon');
end $$;
select pg_temp.login('patron_b');
set local role authenticated;
insert into public.invoices (organization_id) select id from public.organizations where slug = 'factu-b';

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
    'Une facture incomplete ne peut pas etre emise par ecriture directe'
  );

  perform pg_temp.complete_invoice(v_inv);
  update public.invoices set status = 'issued' where id = v_inv;
  perform pg_temp.ok(true, 'Une facture complete est emise avec la date du serveur');

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
do $$ begin raise notice ''; raise notice '=== PARTIE 4 — L''emetteur est fige a l''emission ==='; end $$;
-- =============================================================================

do $$
declare
  v_org uuid;
  v_inv uuid;
  v_nom text;
  v_iban text;
begin
  select id into v_org from public.organizations where slug = 'factu-a';

  update public.organizations
     set legal_name = 'Facturation A SARL',
         registration_number = '12345678900012',
         legal_form = 'SARL',
         iban = 'FR7630001007941234567890185',
         vat_regime = 'reel_normal',
         city = 'Fort-de-France'
   where id = v_org;

  insert into public.invoices (organization_id, title) values (v_org, 'Instantane emetteur')
  returning id into v_inv;

  -- Un brouillon ne porte AUCUN instantane : rien n'est fige tant que rien
  -- n'est emis.
  perform pg_temp.ok(
    (select seller_name from public.invoices where id = v_inv) is null,
    'Un brouillon ne porte pas encore d''instantane de l''emetteur');

  perform pg_temp.complete_invoice(v_inv);
  update public.invoices set status = 'issued' where id = v_inv;

  select seller_name, seller_iban into v_nom, v_iban
  from public.invoices where id = v_inv;

  perform pg_temp.ok(v_nom = 'Facturation A', 'L''emission recopie le nom de l''entreprise');
  perform pg_temp.ok(v_iban = 'FR7630001007941234567890185', 'Et ses coordonnees bancaires');
  perform pg_temp.ok(
    (select seller_legal_form from public.invoices where id = v_inv) = 'SARL',
    'Et sa forme juridique');
  perform pg_temp.ok(
    (select seller_registration_number from public.invoices where id = v_inv) = '12345678900012',
    'Et son SIRET');

  -- LE TEST QUI JUSTIFIE TOUT L'INSTANTANE : l'entreprise demenage, change de
  -- banque et de raison sociale. La facture deja emise ne doit pas bouger d'un
  -- caractere — sans quoi elle mentirait retroactivement.
  update public.organizations
     set legal_name = 'Facturation A SAS',
         iban = 'FR7630004000031234567890143',
         city = 'Le Lamentin'
   where id = v_org;

  perform pg_temp.ok(
    (select seller_iban from public.invoices where id = v_inv) = 'FR7630001007941234567890185',
    'Changer de banque ne reecrit PAS les factures deja emises');
  perform pg_temp.ok(
    (select seller_city from public.invoices where id = v_inv) = 'Fort-de-France',
    'Demenager non plus');

  -- Et l'instantane lui-meme est gele par l'immuabilite, comme le reste.
  perform pg_temp.refuses(
    format($sql$ update public.invoices set seller_iban = 'FR001' where id = %L $sql$, v_inv),
    'L''instantane de l''emetteur ne se retouche pas'
  );

  -- Reemettre ne doit pas ecraser l'instantane d'origine.
  update public.invoices set status = 'sent' where id = v_inv;
  perform pg_temp.ok(
    (select seller_legal_name from public.invoices where id = v_inv) = 'Facturation A SARL',
    'Faire evoluer le statut ne rejoue pas le gel');
end
$$;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 5 — Etancheite entre entreprises et entre roles ==='; end $$;
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


select pg_temp.login('patron_a');
set local role authenticated;
do $$
declare v_org uuid; v_one public.invoices; v_two public.invoices; v_before integer; v_lines jsonb; v_title text; v_previous timestamptz;
begin
  select id into v_org from public.organizations where slug = 'factu-a';
  select count(*) into v_before from public.invoices where organization_id = v_org and status <> 'draft' and document_type = 'invoice';
  insert into public.invoices(organization_id, title) values(v_org, 'Original') returning * into v_one;
  perform pg_temp.complete_invoice(v_one.id);
  select * into v_one from public.invoices where id = v_one.id;
  v_previous := v_one.updated_at;
  update public.invoice_items set description = 'Prestation corrigée' where invoice_id = v_one.id;
  perform pg_temp.refuses(format('select public.issue_invoice(%L, %L)', v_one.id, v_previous), 'Une modification de ligne seule invalide la version ouverte');
  select * into v_one from public.invoices where id = v_one.id;
  v_lines := '[{"description":"Nouvelle prestation","unit":"u","quantity":2,"unit_price_cents":1234,"vat_rate":20,"vat_category":"S"}]'::jsonb;
  perform pg_temp.refuses(format('select public.save_invoice_draft(%L, %L, %L, %L)', v_one.id, '2000-01-01', '{}', v_lines), 'Une version perimee du brouillon est refusee');
  perform pg_temp.refuses(format('select public.save_invoice_draft(%L, %L, %L, %L)', v_one.id, v_one.updated_at, '{"title":"Perdu"}', '[{"description":"Erreur","unit":"u","quantity":-1,"unit_price_cents":10,"vat_rate":20}]'), 'Un echec sur les lignes annule aussi le changement de titre');
  select title into v_title from public.invoices where id = v_one.id;
  perform pg_temp.ok(v_title = 'Original', 'Le titre initial est conserve apres echec');
  perform pg_temp.ok((select count(*) from public.invoice_items where invoice_id = v_one.id) = 1, 'Les lignes initiales sont conservees apres echec');
  v_previous := v_one.updated_at;
  select * into v_one from public.save_invoice_draft(v_one.id, v_one.updated_at, '{"title":"Corrige"}', v_lines);
  perform pg_temp.ok(v_one.updated_at > v_previous, 'La version avance lors de l enregistrement');
  perform pg_temp.refuses(format('select public.save_invoice_draft(%L, %L, %L, %L)', v_one.id, v_previous, '{}', v_lines), 'Un deuxieme enregistrement avec la meme version est refuse');
  perform pg_temp.ok(v_one.title = 'Corrige', 'Le brouillon et ses lignes sont enregistres');
  perform pg_temp.ok((select total_cents from public.invoice_totals where invoice_id = v_one.id) = 2962, 'Les totaux sont recalcules apres correction');
  perform pg_temp.refuses(format('select public.save_invoice_draft(%L, %L, %L, %L)', v_one.id, v_one.updated_at, '{"status":"issued"}', v_lines), 'L editeur ne contourne pas emission');
  select * into v_one from public.issue_invoice(v_one.id, v_one.updated_at);
  perform pg_temp.ok(v_one.reference = 'FAC-' || extract(year from current_date)::text || '-' || lpad((v_before + 1)::text,5,'0'), 'Les brouillons supprimes et emissions refusees ne consomment aucun numero');
  perform pg_temp.refuses(format('select public.issue_invoice(%L, %L)', v_one.id, v_one.updated_at), 'Un second clic ne reemet pas la facture');
  perform pg_temp.refuses(format('update public.invoices set status = ''draft'' where id = %L', v_one.id), 'Impossible de rouvrir une facture emise');
  insert into public.invoices(organization_id) values(v_org) returning * into v_two;
  perform pg_temp.refuses(format('update public.invoice_items set invoice_id = %L where invoice_id = %L', v_two.id, v_one.id), 'Impossible de deplacer une ligne emise vers un brouillon');
  perform pg_temp.complete_invoice(v_two.id);
  select * into v_two from public.invoices where id = v_two.id;
  select * into v_two from public.issue_invoice(v_two.id, v_two.updated_at);
  perform pg_temp.ok(v_two.reference = 'FAC-' || extract(year from current_date)::text || '-' || lpad((v_before + 2)::text,5,'0'), 'La facture suivante recoit le numero consecutif');
  perform pg_temp.refuses(format('select public.issue_invoice(%L, now())', (select v from pg_temp.t_ref where k = 'facture_b')), 'Emission chez un autre tenant refusee');
  perform pg_temp.refuses(format('select public.save_invoice_draft(%L, now(), ''{}'', ''[]'')', (select v from pg_temp.t_ref where k = 'facture_b')), 'Edition chez un autre tenant refusee');
end $$;
reset role;


select pg_temp.login('patron_a');
set local role authenticated;
do $$
declare v_org uuid; v public.invoices; v_lines jsonb;
begin
  select id into v_org from public.organizations where slug = 'factu-a';
  insert into public.invoices(organization_id) values (v_org) returning * into v;
  perform pg_temp.complete_invoice(v.id);
  update public.invoices set service_date = null where id = v.id;
  perform pg_temp.refuses(format('update public.invoices set status = ''issued'' where id = %L', v.id), 'La date de prestation manquante bloque aussi une emission directe');
  select * into v from public.invoices where id = v.id;
  v_lines := '[{"description":"Prestation","unit":"h","quantity":1,"unit_price_cents":1000,"vat_rate":20,"vat_category":"S"}]'::jsonb;
  select * into v from public.save_invoice_draft(v.id, v.updated_at,
    jsonb_build_object('service_date', current_date, 'operation_type', 'mixed', 'early_payment_terms', 'Escompte : néant', 'late_payment_terms', 'Taux applicable', 'vat_on_debits', false, 'buyer_reference', 'SERVICE-42', 'purchase_order_reference', 'BC-42', 'delivery_address_line1', '3 rue du Chantier', 'delivery_city', 'Le Marin', 'delivery_postal_code', '97290', 'delivery_country', 'FR'), v_lines);
  perform pg_temp.ok(v.buyer_reference = 'SERVICE-42' and v.operation_type = 'mixed' and v.delivery_city = 'Le Marin' and v.vat_on_debits = false, 'Les champs structures sont sauvegardes dans la transaction du brouillon');
  select * into v from public.issue_invoice(v.id, v.updated_at);
  perform pg_temp.refuses(format('update public.invoices set service_date = current_date - 1 where id = %L', v.id), 'La date de prestation est figee apres emission');
  perform pg_temp.refuses(format('update public.invoices set delivery_city = ''Autre'' where id = %L', v.id), 'L adresse de livraison est figee apres emission');
  perform pg_temp.refuses(format('update public.invoices set vat_on_debits = true where id = %L', v.id), 'Le choix de TVA est fige apres emission');
end $$;
reset role;

-- Documents conservés : même accès que la facture, aucune écriture cliente.
reset role;
insert into t_ref (k, v)
select 'document_facture', i.id from public.invoices i
join public.organizations o on o.id = i.organization_id
where o.slug = 'factu-a' and i.status in ('issued','sent','paid') and i.document_type = 'invoice'
limit 1;

grant select on pg_temp.t_ref to service_role;
set local role service_role;
insert into public.invoice_electronic_documents
  (invoice_id, organization_id, profile, generator_version, object_path, xml_sha256, pdf_sha256, byte_size)
select i.id, i.organization_id, 'EN 16931', 'test',
  i.organization_id::text || '/' || i.id::text || '/factur-x.pdf', repeat('a',64), repeat('b',64), 123
from public.invoices i where i.id = (select v from pg_temp.t_ref where k = 'document_facture');
reset role;

select pg_temp.refuses($sql$ update public.invoice_electronic_documents set byte_size = 124 $sql$,
  'Même un accès privilégié ne remplace pas un document conservé');
select pg_temp.refuses($sql$ delete from public.invoice_electronic_documents $sql$,
  'Un document conservé ne peut pas être supprimé');
select pg_temp.refuses($sql$
  insert into public.invoice_electronic_documents
    (invoice_id, organization_id, profile, generator_version, object_path, xml_sha256, pdf_sha256, byte_size)
  select i.id, i.organization_id, 'EN 16931', 'test', i.organization_id::text || '/' || i.id::text || '/factur-x.pdf', repeat('a',64), repeat('b',64), 123
  from public.invoices i where i.id = (select v from pg_temp.t_ref where k = 'facture_b')
$sql$, 'Un brouillon ne reçoit aucun document définitif');

select pg_temp.login('patron_a'); set local role authenticated;
select pg_temp.ok((select count(*) from public.invoice_electronic_documents) = 1, 'Le propriétaire voit le document de son entreprise');
select pg_temp.refuses($sql$ insert into public.invoice_electronic_documents select * from public.invoice_electronic_documents $sql$, 'Le navigateur ne peut pas enregistrer de faux document');
select pg_temp.refuses($sql$ update public.invoice_electronic_documents set byte_size = 124 $sql$, 'Le navigateur ne remplace pas un document');
select pg_temp.login('patron_b');
select pg_temp.ok((select count(*) from public.invoice_electronic_documents) = 0, 'Aucun document de A visible par B');
select pg_temp.login('technicien');
select pg_temp.ok((select count(*) from public.invoice_electronic_documents) = 0, 'Un technicien sans accès aux factures ne voit pas leur document');
reset role;
select pg_temp.ok((select public is false from storage.buckets where id = 'invoice-electronic-documents'), 'Le stockage des PDF est privé');
-- Identifiants : même garde pour RPC et UPDATE direct, sans perdre de numéro.
create function pg_temp.refuse_identifier(p_id uuid, p_message text, p_direct boolean default false)
returns void language plpgsql as $$
declare v_invoice public.invoices;
begin
  select * into strict v_invoice from public.invoices where id = p_id;
  begin
    if p_direct then
      update public.invoices set status = 'issued' where id = p_id;
    else
      perform public.issue_invoice(p_id, v_invoice.updated_at);
    end if;
    raise exception 'Une émission avec identifiant invalide a réussi' using errcode = 'assert_failure';
  exception when check_violation then
    perform pg_temp.ok(position(p_message in sqlerrm) > 0, 'Refus pour le bon identifiant : ' || sqlerrm);
  end;
  perform pg_temp.ok((select status = 'draft' and issued_at is null and reference = v_invoice.reference
    and updated_at = v_invoice.updated_at from public.invoices where id = p_id),
    'Un refus conserve le brouillon, sa référence et sa version');
end $$;

select pg_temp.login('patron_a');
do $$
declare v_org uuid; v_invoice public.invoices; v_counter_before bigint; v_counter_after bigint;
begin
  select id into v_org from public.organizations where slug = 'factu-a';
  select coalesce(sum(last_value), 0) into v_counter_before from public.invoice_counters where organization_id = v_org;
  set local role authenticated;
  insert into public.invoices (organization_id) values (v_org) returning * into v_invoice;
  perform pg_temp.complete_invoice(v_invoice.id);
  update public.invoices set customer_type = 'company', customer_registration_number = '109198440054594',
    customer_vat_number = null where id = v_invoice.id;
  perform pg_temp.refuse_identifier(v_invoice.id, 'Identifiant invalide pour ce client');
  perform pg_temp.refuse_identifier(v_invoice.id, 'Identifiant invalide pour ce client', true);
  update public.invoices set customer_type = 'public_body' where id = v_invoice.id;
  perform pg_temp.refuse_identifier(v_invoice.id, 'Identifiant invalide pour ce client');
  update public.invoices set customer_registration_number = '123 456 789', customer_vat_number = '0919191951' where id = v_invoice.id;
  perform pg_temp.refuse_identifier(v_invoice.id, 'Numéro de TVA invalide pour ce client');
  update public.invoices set customer_vat_number = null where id = v_invoice.id;
  update public.organizations set vat_number = 'TVA-invalide' where id = v_org;
  perform pg_temp.refuse_identifier(v_invoice.id, 'Numéro de TVA invalide pour votre entreprise');
  update public.organizations set vat_number = 'FR12345678901' where id = v_org;
  reset role;
  select coalesce(sum(last_value), 0) into v_counter_after from public.invoice_counters where organization_id = v_org;
  perform pg_temp.ok(v_counter_after = v_counter_before, 'Les émissions refusées ne consomment aucun numéro');

  set local role authenticated;
  select * into v_invoice from public.invoices where id = v_invoice.id;
  perform public.issue_invoice(v_invoice.id, v_invoice.updated_at);
  perform pg_temp.ok((select status = 'issued' and customer_vat_number is null from public.invoices where id = v_invoice.id),
    'Le même brouillon corrigé est émis, sans imposer une TVA client absente');

  insert into public.invoices (organization_id) values (v_org) returning * into v_invoice;
  perform pg_temp.complete_invoice(v_invoice.id);
  update public.invoices set customer_type = 'company', customer_country = 'BE',
    customer_registration_number = '0123.456.789', customer_vat_number = 'BE0123456789' where id = v_invoice.id;
  select * into v_invoice from public.invoices where id = v_invoice.id;
  perform public.issue_invoice(v_invoice.id, v_invoice.updated_at);
  perform pg_temp.ok((select status = 'issued' from public.invoices where id = v_invoice.id), 'Les identifiants étrangers ne subissent pas le format français');

  insert into public.invoices (organization_id) values (v_org) returning * into v_invoice;
  perform pg_temp.complete_invoice(v_invoice.id);
  update public.invoices set customer_type = 'company', customer_registration_number = '123 456 789',
    customer_vat_number = 'fr 12 345678901' where id = v_invoice.id;
  select * into v_invoice from public.invoices where id = v_invoice.id;
  perform public.issue_invoice(v_invoice.id, v_invoice.updated_at);
  perform pg_temp.ok((select status = 'issued' from public.invoices where id = v_invoice.id), 'Espaces de présentation et TVA en minuscules acceptés');
  reset role;
end $$;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;

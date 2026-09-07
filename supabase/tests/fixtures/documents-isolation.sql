-- =============================================================================
-- Bibliotheque documentaire — cloisonnement entre organisations
-- =============================================================================
--
-- S'insere dans `01_multitenant_scenario.sql`, dont il reprend les identites
-- (`a_owner`, `a_tech1`, `b_owner`) et les aides (`pg_temp.login`,
-- `pg_temp.ok`, `pg_temp.refuses`).
--
-- Ce qui est verifie ici ne peut pas l'etre ailleurs : la RLS s'execute DANS
-- PostgreSQL. Un test passant par le client mesurerait la bonne foi du client.

do $$ begin raise notice ''; raise notice '=== BIBLIOTHEQUE DOCUMENTAIRE — CLOISONNEMENT ==='; end $$;

-- Les ecritures qui suivent rejouent le webhook de paiement : elles passent
-- AU-DESSUS de la RLS, comme les sections 1.2 et 2.0 du scenario.
reset role;

-- La cle `documents` n'existe que sur les formules payantes. Sans abonnement,
-- les deux organisations seraient en `free` et TOUT serait refuse — y compris a
-- leur proprietaire, ce qui ne prouverait rien du cloisonnement.
--
-- La formule est REPOSEE, pas supposee. La premiere version de cette fixture
-- n'inserait qu'a defaut d'abonnement actif, tenant pour acquis que A etait
-- restee sur la formule posee 1700 lignes plus haut. Elle ne l'est pas : la
-- section 3.4 fait varier son abonnement pour verifier le retour a Gratuit, et
-- A arrive ici en `free`. Une fixture qui depend de l'etat laisse par des tests
-- sans rapport ne mesure plus ce qu'elle croit mesurer.
--
-- L'index partiel `subscriptions_active_org_idx` n'admet qu'un abonnement actif
-- par organisation : la suppression prealable n'est pas une precaution de style.
--
-- `business` et non `pro`, alors que la bibliotheque ouvre des Pro : la derniere
-- assertion lit `audit_logs`, dont la CONSULTATION est une fonctionnalite
-- `audit_log` incluse a partir de Business. Sous Pro, la trace d'audit est bien
-- ecrite mais invisible a son proprietaire, et l'assertion echouerait en
-- accusant le declencheur d'audit — alors que c'est la formule qui la masque.
delete from public.subscriptions
where organization_id in (
  select id from public.organizations where slug in ('fibre-atlantique', 'reseaux-du-sud')
);

insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select id, 'business', 'active', now() + interval '30 days'
from public.organizations
where slug in ('fibre-atlantique', 'reseaux-du-sud');

-- -----------------------------------------------------------------------------
-- Table de references
-- -----------------------------------------------------------------------------
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POURQUOI LES IDENTIFIANTS NE PEUVENT PAS ETRE LUS SOUS `authenticated`
--
-- La premiere version de cette fixture ouvrait ses blocs par :
--
--     select id into v_org_a from public.organizations where slug = '...';
--     select id into v_org_b from public.organizations where slug = '...';
--
-- executes sous `authenticated`. Or c'est precisement ce que la RLS interdit :
-- l'organisation B n'est PAS visible depuis A. `v_org_b` valait donc NULL, et
-- toutes les assertions qui en dependaient portaient sur NULL — `pg_temp.ok`
-- les rattrapait, mais bien plus loin, et le premier symptome etait un refus
-- RLS incomprehensible a l'insertion.
--
-- Le cloisonnement doit etre EPROUVE, pas subi par la fixture elle-meme : les
-- identifiants sont donc resolus ici, hors RLS, et relus ensuite. Meme montage
-- que `t_ref` dans `transmission-lifecycle.sql`.
-- ─────────────────────────────────────────────────────────────────────────────

create temporary table t_doc_ref (k text primary key, v uuid);

insert into t_doc_ref(k, v)
select 'org_a', id from public.organizations where slug = 'fibre-atlantique';

insert into t_doc_ref(k, v)
select 'org_b', id from public.organizations where slug = 'reseaux-du-sud';

-- Les blocs suivants y ECRIVENT aussi : les identifiants des lignes creees sous
-- une identite doivent rester lisibles depuis une autre.
grant select, insert on pg_temp.t_doc_ref to authenticated;

-- A partir d'ici, on rejoue ce que voit un utilisateur authentifie.
set local role authenticated;

do $$
declare
  v_org_a  uuid;
  v_org_b  uuid;
  v_doc_a  uuid;
  v_doc_b  uuid;
  v_dos_a  uuid;
  v_dos_b  uuid;
  v_compte integer;
begin
  select v into v_org_a from pg_temp.t_doc_ref where k = 'org_a';
  select v into v_org_b from pg_temp.t_doc_ref where k = 'org_b';
  perform pg_temp.ok(v_org_a is not null and v_org_b is not null,
    'Les deux organisations du scenario sont resolues');

  -- ---------------------------------------------------------------- depot A
  perform pg_temp.login('a_owner');

  -- Preconditions de la policy, verifiees UNE PAR UNE avant de l'exercer.
  -- Sans elles, un refus RLS ne dit pas lequel des trois termes a manque, et
  -- l'echec se lit « new row violates row-level security policy » — vrai, mais
  -- inexploitable.
  perform pg_temp.ok(app.org_has_feature(v_org_a, 'documents'),
    'La formule de A (' || coalesce(app.org_effective_plan(v_org_a), 'NULL')
      || ') inclut la bibliotheque documentaire');
  perform pg_temp.ok(app.is_org_member(v_org_a),
    'Le proprietaire de A est reconnu membre actif');
  perform pg_temp.ok(app.has_org_permission(v_org_a, 'document.manage'),
    'Le proprietaire de A porte document.manage');

  insert into public.document_folders (organization_id, name, created_by)
  values (v_org_a, 'Procedures', pg_temp.uid('a_owner'))
  returning id into v_dos_a;
  perform pg_temp.ok(v_dos_a is not null, 'A cree un dossier dans sa bibliotheque');

  insert into public.organization_documents
    (organization_id, folder_id, uploaded_by, name, storage_path, mime_type, file_size)
  values
    (v_org_a, v_dos_a, pg_temp.uid('a_owner'), 'Notice fibre',
     v_org_a::text || '/11111111-1111-4111-8111-111111111111-notice.pdf',
     'application/pdf', 12345)
  returning id into v_doc_a;
  perform pg_temp.ok(v_doc_a is not null, 'A depose un document');

  insert into pg_temp.t_doc_ref(k, v) values ('doc_a', v_doc_a), ('dos_a', v_dos_a);

  -- ---------------------------------------------------------------- depot B
  perform pg_temp.login('b_owner');

  insert into public.document_folders (organization_id, name, created_by)
  values (v_org_b, 'Plans', pg_temp.uid('b_owner'))
  returning id into v_dos_b;

  insert into public.organization_documents
    (organization_id, folder_id, uploaded_by, name, storage_path, mime_type, file_size)
  values
    (v_org_b, v_dos_b, pg_temp.uid('b_owner'), 'Plan de masse',
     v_org_b::text || '/22222222-2222-4222-8222-222222222222-plan.pdf',
     'application/pdf', 6789)
  returning id into v_doc_b;
  perform pg_temp.ok(v_doc_b is not null, 'B depose un document dans SA bibliotheque');

  insert into pg_temp.t_doc_ref(k, v) values ('doc_b', v_doc_b), ('dos_b', v_dos_b);

  -- ------------------------------------------------- B ne voit rien de chez A
  select count(*) into v_compte from public.organization_documents where id = v_doc_a;
  perform pg_temp.ok(v_compte = 0, 'B ne LIT pas le document de A');

  select count(*) into v_compte from public.document_folders where id = v_dos_a;
  perform pg_temp.ok(v_compte = 0, 'B ne LIT pas le dossier de A');

  update public.organization_documents set name = 'Detourne' where id = v_doc_a;
  perform pg_temp.ok(
    (select name from public.organization_documents where id = v_doc_a) is null,
    'B ne RENOMME pas le document de A (aucune ligne visible a mettre a jour)'
  );

  delete from public.organization_documents where id = v_doc_a;
  perform pg_temp.ok(
    (select count(*) from public.organization_documents) = 1,
    'B ne SUPPRIME pas le document de A'
  );

  -- ------------------------------------------------- A ne voit rien de chez B
  perform pg_temp.login('a_owner');

  select count(*) into v_compte from public.organization_documents where id = v_doc_b;
  perform pg_temp.ok(v_compte = 0, 'A ne LIT pas le document de B');

  perform pg_temp.ok(
    (select count(*) from public.organization_documents) = 1,
    'A ne voit QUE son propre document'
  );

  -- Le document de A a survecu aux tentatives de B.
  perform pg_temp.ok(
    (select name from public.organization_documents where id = v_doc_a) = 'Notice fibre',
    'Le document de A est intact apres les tentatives de B'
  );

  -- ------------------------------------------------------------ role restreint
  perform pg_temp.login('a_tech1');

  perform pg_temp.ok(
    (select count(*) from public.organization_documents where id = v_doc_a) = 1,
    'Un technicien de A LIT la bibliotheque de son organisation'
  );

  -- --------------------------------------------------------------- audit
  perform pg_temp.login('a_owner');
  perform pg_temp.ok(
    exists (
      select 1 from public.audit_logs
      where organization_id = v_org_a
        and action = 'document.uploaded'
        and entity_id = v_doc_a
    ),
    'Le depot a laisse une trace d''audit'
  );
end
$$;

-- ----------------------------------------------------------------- refus
-- Ces instructions DOIVENT echouer. `pg_temp.refuses` echoue si elles passent.

do $$
declare
  v_org_a uuid;
  v_org_b uuid;
  v_doc_a uuid;
  v_dos_b uuid;
begin
  select v into v_org_a from pg_temp.t_doc_ref where k = 'org_a';
  select v into v_org_b from pg_temp.t_doc_ref where k = 'org_b';
  select v into v_doc_a from pg_temp.t_doc_ref where k = 'doc_a';
  select v into v_dos_b from pg_temp.t_doc_ref where k = 'dos_b';

  -- Un identifiant NULL ferait passer les refus pour les mauvaises raisons :
  -- « update ... where id = null » ne touche rien et ne leve rien.
  perform pg_temp.ok(v_doc_a is not null and v_dos_b is not null,
    'Les references necessaires aux refus sont resolues');

  perform pg_temp.login('a_tech1');
  perform pg_temp.refuses(
    format(
      'insert into public.organization_documents (organization_id, uploaded_by, name, storage_path) '
      'values (%L, %L, %L, %L)',
      v_org_a, pg_temp.uid('a_tech1'), 'Depot interdit',
      v_org_a::text || '/33333333-3333-4333-8333-333333333333-x.pdf'
    ),
    'Un technicien ne DEPOSE pas (document.manage absent)'
  );

  perform pg_temp.login('b_owner');
  perform pg_temp.refuses(
    format(
      'insert into public.organization_documents (organization_id, uploaded_by, name, storage_path) '
      'values (%L, %L, %L, %L)',
      v_org_a, pg_temp.uid('b_owner'), 'Depot chez A',
      v_org_a::text || '/44444444-4444-4444-8444-444444444444-x.pdf'
    ),
    'B ne DEPOSE pas dans la bibliotheque de A'
  );

  perform pg_temp.login('a_owner');
  perform pg_temp.refuses(
    format(
      'insert into public.organization_documents (organization_id, uploaded_by, name, storage_path) '
      'values (%L, %L, %L, %L)',
      v_org_a, pg_temp.uid('a_owner'), 'Chemin menteur',
      v_org_b::text || '/55555555-5555-4555-8555-555555555555-x.pdf'
    ),
    'Un chemin dont le premier segment designe une AUTRE organisation est refuse'
  );

  perform pg_temp.refuses(
    format('update public.organization_documents set organization_id = %L where id = %L',
           v_org_b, v_doc_a),
    'L''organisation d''un document ne se change pas'
  );

  perform pg_temp.refuses(
    format('update public.organization_documents set storage_path = %L where id = %L',
           v_org_a::text || '/autre.pdf', v_doc_a),
    'Le chemin Storage d''un document ne se change pas'
  );

  perform pg_temp.refuses(
    format('update public.organization_documents set folder_id = %L where id = %L',
           v_dos_b, v_doc_a),
    'Un document ne se range pas dans le dossier d''une autre organisation'
  );
end
$$;

-- =============================================================================
-- Arborescence : ce que la hierarchie doit refuser
-- =============================================================================
--
-- Ces cas ne peuvent pas etre couverts par un test d'interface. Le client ne
-- PROPOSE pas de deplacer un dossier dans son propre sous-dossier -- mais
-- « ne pas proposer » n'est pas « refuser », et une requete forgee ne passe pas
-- par le client.

do $$
declare
  v_org_a  uuid;
  v_dos_a  uuid;
  v_dos_b  uuid;
  v_enfant uuid;
  v_petit  uuid;
begin
  select v into v_org_a from pg_temp.t_doc_ref where k = 'org_a';
  select v into v_dos_a from pg_temp.t_doc_ref where k = 'dos_a';
  select v into v_dos_b from pg_temp.t_doc_ref where k = 'dos_b';

  perform pg_temp.login('a_owner');

  -- La hierarchie fonctionne : deux niveaux sous un dossier existant.
  insert into public.document_folders (organization_id, parent_folder_id, name, created_by)
  values (v_org_a, v_dos_a, 'Orange', pg_temp.uid('a_owner'))
  returning id into v_enfant;
  perform pg_temp.ok(v_enfant is not null, 'A cree un sous-dossier');

  insert into public.document_folders (organization_id, parent_folder_id, name, created_by)
  values (v_org_a, v_enfant, 'Plans 2026', pg_temp.uid('a_owner'))
  returning id into v_petit;
  perform pg_temp.ok(v_petit is not null, 'A cree un sous-sous-dossier');

  perform pg_temp.ok(
    (select parent_folder_id from public.document_folders where id = v_petit) = v_enfant,
    'Le troisieme niveau est bien rattache au deuxieme'
  );

  -- Un dossier ne descend pas de lui-meme.
  perform pg_temp.refuses(
    format('update public.document_folders set parent_folder_id = %L where id = %L',
           v_dos_a, v_dos_a),
    'Un dossier ne peut pas etre son propre parent'
  );

  -- Ni de l'un de ses descendants : c'est le cycle que l'interface ne propose
  -- pas, et que la base doit interdire quand meme.
  perform pg_temp.refuses(
    format('update public.document_folders set parent_folder_id = %L where id = %L',
           v_petit, v_dos_a),
    'Un dossier ne se deplace pas dans son propre sous-sous-dossier'
  );

  -- Ni d'un dossier appartenant a une autre organisation.
  perform pg_temp.refuses(
    format('update public.document_folders set parent_folder_id = %L where id = %L',
           v_dos_b, v_enfant),
    'Le parent d''un dossier ne peut pas venir d''une autre organisation'
  );

  -- L'organisation d'un dossier est gelee, comme celle d'un document.
  perform pg_temp.refuses(
    format('update public.document_folders set organization_id = %L where id = %L',
           (select v from pg_temp.t_doc_ref where k = 'org_b'), v_enfant),
    'L''organisation d''un dossier ne se change pas'
  );

  -- Deplacer reste possible quand rien ne s'y oppose.
  update public.document_folders set parent_folder_id = null where id = v_petit;
  perform pg_temp.ok(
    (select parent_folder_id from public.document_folders where id = v_petit) is null,
    'Un dossier remonte a la racine sans difficulte'
  );

  perform pg_temp.ok(
    exists (
      select 1 from public.audit_logs
      where organization_id = v_org_a
        and action = 'folder.created'
        and entity_id = v_enfant
    ),
    'La creation d''un dossier laisse une trace d''audit'
  );

  perform pg_temp.ok(
    exists (
      select 1 from public.audit_logs
      where organization_id = v_org_a
        and action = 'folder.moved'
        and entity_id = v_petit
    ),
    'Le deplacement d''un dossier laisse une trace d''audit'
  );
end
$$;

-- Un technicien lit l'arborescence mais n'y touche pas.
do $$
declare
  v_org_a uuid;
begin
  select v into v_org_a from pg_temp.t_doc_ref where k = 'org_a';

  perform pg_temp.login('a_tech1');

  perform pg_temp.ok(
    (select count(*) from public.document_folders where organization_id = v_org_a) >= 3,
    'Un technicien LIT les dossiers de son organisation'
  );

  perform pg_temp.refuses(
    format(
      'insert into public.document_folders (organization_id, name) values (%L, %L)',
      v_org_a, 'Dossier interdit'
    ),
    'Un technicien ne CREE pas de dossier (document.manage absent)'
  );
end
$$;

do $$ begin raise notice '=== BIBLIOTHEQUE : cloisonnement et arborescence verifies ==='; end $$;

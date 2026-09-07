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

-- L'insertion d'abonnement doit passer AU-DESSUS de la RLS.
reset role;

-- La cle `documents` n'existe que sur les formules payantes. Sans abonnement,
-- les deux organisations seraient en `free` et TOUT serait refuse — y compris a
-- leur proprietaire, ce qui ne prouverait rien du cloisonnement.
insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select o.id, 'pro', 'active', now() + interval '30 days'
from public.organizations o
where o.slug in ('fibre-atlantique', 'reseaux-du-sud')
  and not exists (
    select 1 from public.subscriptions s
    where s.organization_id = o.id and s.status in ('trialing', 'active', 'past_due')
  );

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
  select id into v_org_a from public.organizations where slug = 'fibre-atlantique';
  select id into v_org_b from public.organizations where slug = 'reseaux-du-sud';

  -- ---------------------------------------------------------------- depot A
  perform pg_temp.login('a_owner');

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
  select id into v_org_a from public.organizations where slug = 'fibre-atlantique';
  select id into v_org_b from public.organizations where slug = 'reseaux-du-sud';
  select id into v_doc_a from public.organization_documents where organization_id = v_org_a limit 1;
  select id into v_dos_b from public.document_folders where organization_id = v_org_b limit 1;

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

do $$ begin raise notice '=== BIBLIOTHEQUE : cloisonnement verifie ==='; end $$;

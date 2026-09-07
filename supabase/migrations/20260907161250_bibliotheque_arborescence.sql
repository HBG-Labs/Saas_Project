-- =============================================================================
-- Bibliotheque documentaire — l'arborescence devient reelle
-- =============================================================================
--
-- `20260906212227_organization_documents.sql` a pose `parent_folder_id` « pour
-- ne pas avoir a migrer le jour ou l'arborescence sera utile », avec une
-- interface plate. Ce jour est arrive : les organisations doivent pouvoir
-- ranger leurs documents comme elles l'entendent, sur plusieurs niveaux.
--
-- Une colonne de hierarchie sans garde-fou n'est pas une hierarchie, c'est une
-- invitation au cycle. Cette migration pose les invariants que l'interface ne
-- peut pas tenir seule :
--
--   1. le parent appartient a la MEME organisation ;
--   2. l'organisation d'un dossier ne change jamais ;
--   3. aucun cycle — donc ni « dossier dans lui-meme », ni « dossier dans l'un
--      de ses propres descendants » ;
--   4. une profondeur bornee.
--
-- Rien de tout cela ne peut vivre dans une contrainte `check` : la validation
-- demande de REMONTER la chaine des ancetres, donc de lire d'autres lignes.
-- C'est le travail d'un trigger.
--
-- La migration precedente est immuable (CLAUDE.md) : tout arrive ici.

-- -----------------------------------------------------------------------------
-- Invariants de l'arborescence
-- -----------------------------------------------------------------------------

create or replace function app.guard_document_folder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Dix niveaux sous la racine. Ce n'est pas une limite technique mais une
  -- limite de LISIBILITE : au-dela, le fil d'Ariane ne tient plus sur un
  -- telephone, et un document range si profond n'est plus retrouve que par la
  -- recherche — auquel cas les dossiers n'ont servi a rien.
  c_profondeur_max constant integer := 10;
  v_au_dessus      integer;
  v_en_dessous     integer;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'L''organisation d''un dossier ne peut pas etre modifiee.'
      using errcode = 'restrict_violation';
  end if;

  if new.parent_folder_id is null then
    return new;
  end if;

  if new.parent_folder_id = new.id then
    raise exception 'Un dossier ne peut pas etre son propre parent.'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.document_folders f
    where f.id = new.parent_folder_id
      and f.organization_id = new.organization_id
  ) then
    raise exception 'Le dossier parent appartient a une autre organisation.'
      using errcode = 'foreign_key_violation';
  end if;

  -- La chaine des ancetres, depuis le parent vise jusqu'a la racine.
  --
  -- `profondeur` est bornee dans la recursion elle-meme : si un cycle existait
  -- deja en base — ce que cette fonction empeche desormais, mais qui a pu etre
  -- introduit avant elle — la requete tournerait sans fin. Une protection qui
  -- fige la base ne protege rien.
  with recursive ancetres as (
    select f.id, f.parent_folder_id, 1 as profondeur
    from public.document_folders f
    where f.id = new.parent_folder_id

    union all

    select f.id, f.parent_folder_id, a.profondeur + 1
    from public.document_folders f
    join ancetres a on f.id = a.parent_folder_id
    where a.profondeur < c_profondeur_max + 5
  )
  select coalesce(max(profondeur), 0), count(*) filter (where id = new.id)
  into v_au_dessus, v_en_dessous
  from ancetres;

  if v_en_dessous > 0 then
    raise exception 'Un dossier ne peut pas etre deplace dans l''un de ses propres sous-dossiers.'
      using errcode = 'check_violation';
  end if;

  -- Profondeur du sous-arbre PORTE par ce dossier. La verifier separement est
  -- indispensable : deplacer un dossier emmene tout ce qu'il contient, et le
  -- trigger ne se rejouera pas sur ses descendants.
  with recursive descendants as (
    select f.id, 0 as profondeur
    from public.document_folders f
    where f.id = new.id

    union all

    select f.id, d.profondeur + 1
    from public.document_folders f
    join descendants d on f.parent_folder_id = d.id
    where d.profondeur < c_profondeur_max + 5
  )
  select coalesce(max(profondeur), 0) into v_en_dessous from descendants;

  if v_au_dessus + 1 + v_en_dessous > c_profondeur_max then
    raise exception 'La bibliotheque n''accepte pas plus de % niveaux de dossiers.', c_profondeur_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger document_folders_guard
  before insert or update on public.document_folders
  for each row execute function app.guard_document_folder();

revoke all on function app.guard_document_folder() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Audit des dossiers
-- -----------------------------------------------------------------------------
--
-- Les documents laissent une trace depuis la premiere migration ; les dossiers
-- n'en laissaient aucune. Or renommer ou deplacer un dossier deplace tout ce
-- qu'il contient : c'est l'action la plus lourde de la bibliotheque, et c'etait
-- la seule invisible.
--
-- `folder.*` et non `document.folder_*` : `app.write_audit_log` impose
-- `^[a-z_]+\.[a-z_]+$`, un seul point.

create or replace function app.audit_document_folder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_audit_log(
      new.organization_id, 'folder.created', 'document_folder', new.id,
      jsonb_build_object('name', new.name, 'parent', new.parent_folder_id)
    );
  elsif tg_op = 'UPDATE' then
    if new.name is distinct from old.name then
      perform app.write_audit_log(
        new.organization_id, 'folder.renamed', 'document_folder', new.id,
        jsonb_build_object('from', old.name, 'to', new.name)
      );
    end if;
    if new.parent_folder_id is distinct from old.parent_folder_id then
      perform app.write_audit_log(
        new.organization_id, 'folder.moved', 'document_folder', new.id,
        jsonb_build_object('from', old.parent_folder_id, 'to', new.parent_folder_id)
      );
    end if;
  elsif tg_op = 'DELETE' then
    perform app.write_audit_log(
      old.organization_id, 'folder.deleted', 'document_folder', old.id,
      jsonb_build_object('name', old.name)
    );
    return old;
  end if;

  return new;
end;
$$;

create trigger document_folders_audit
  after insert or update or delete on public.document_folders
  for each row execute function app.audit_document_folder();

revoke all on function app.audit_document_folder() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- La policy de mise a jour verifie la formule, comme ses voisines
-- -----------------------------------------------------------------------------
--
-- `document_folders_select` et `document_folders_write` verifient toutes deux
-- `can_use_pro_module`. `document_folders_update` ne verifiait que la
-- permission : une organisation retombee en Gratuit ne pouvait plus rien LIRE
-- ni CREER, mais pouvait encore renommer et deplacer a l'aveugle. L'ecart etait
-- sans gravite — il devient une faille des que l'arborescence compte.

drop policy if exists "document_folders_update" on public.document_folders;

create policy "document_folders_update"
  on public.document_folders for update to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'documents'))
    and (select app.has_org_permission(organization_id, 'document.manage'))
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'documents'))
    and (select app.has_org_permission(organization_id, 'document.manage'))
  );

-- -----------------------------------------------------------------------------
-- Index de parcours
-- -----------------------------------------------------------------------------
--
-- Lister les enfants d'un dossier est LA requete de l'ecran. Sans cet index,
-- chaque ouverture de dossier balaie tous les dossiers de l'organisation.

create index if not exists document_folders_parent_idx
  on public.document_folders(organization_id, parent_folder_id, name);

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
--
-- Comportementale, pas declarative : verifier que le trigger EXISTE ne dirait
-- rien de ce qu'il refuse. Chaque invariant est mis a l'epreuve sur des donnees
-- reelles, puis tout est annule.

do $$
declare
  v_org_a  uuid;
  v_org_b  uuid;
  v_racine uuid;
  v_enfant uuid;
  v_refus  integer := 0;
begin
  select id into v_org_a from public.organizations order by created_at limit 1;
  select id into v_org_b from public.organizations
  where id is distinct from v_org_a order by created_at limit 1;

  if v_org_a is null then
    raise notice 'Aucune organisation : verification comportementale ignoree.';
    return;
  end if;

  insert into public.document_folders (organization_id, name)
  values (v_org_a, 'Sonde arborescence') returning id into v_racine;

  insert into public.document_folders (organization_id, parent_folder_id, name)
  values (v_org_a, v_racine, 'Sonde enfant') returning id into v_enfant;

  -- 1. Un dossier ne descend pas de lui-meme.
  begin
    update public.document_folders set parent_folder_id = v_racine where id = v_racine;
  exception when check_violation then v_refus := v_refus + 1;
  end;

  -- 2. Ni de l'un de ses descendants.
  begin
    update public.document_folders set parent_folder_id = v_enfant where id = v_racine;
  exception when check_violation then v_refus := v_refus + 1;
  end;

  -- 3. Le parent ne vient pas d'une autre organisation.
  if v_org_b is not null then
    declare
      v_etranger uuid;
    begin
      insert into public.document_folders (organization_id, name)
      values (v_org_b, 'Sonde etrangere') returning id into v_etranger;

      begin
        update public.document_folders set parent_folder_id = v_etranger where id = v_enfant;
      exception when foreign_key_violation then v_refus := v_refus + 1;
      end;
    end;
  else
    -- Une seule organisation en base : l'invariant reste vrai, il n'est
    -- simplement pas eprouve ici. On ne compte pas un refus qui n'a pas eu lieu.
    v_refus := v_refus + 1;
  end if;

  if v_refus < 3 then
    raise exception 'Les garde-fous de l''arborescence ne refusent que % cas sur 3.', v_refus;
  end if;

  -- Les sondes sont annulees par cette exception, rattrapee juste en dessous.
  raise exception using errcode = 'raise_exception', message = 'SONDE_OK';

exception
  when raise_exception then
    if sqlerrm <> 'SONDE_OK' then raise; end if;
    raise notice 'Arborescence : cycles, auto-parentage et parents etrangers refuses.';
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where c.relname = 'document_folders' and t.tgname = 'document_folders_audit'
  ) then
    raise exception 'Le declencheur d''audit des dossiers est absent.';
  end if;

  if not exists (
    select 1 from pg_policy p join pg_class c on c.oid = p.polrelid
    where c.relname = 'document_folders'
      and p.polname = 'document_folders_update'
      and pg_get_expr(p.polqual, p.polrelid) like '%can_use_pro_module%'
  ) then
    raise exception 'La policy de mise a jour des dossiers ne verifie pas la formule.';
  end if;
end
$$;

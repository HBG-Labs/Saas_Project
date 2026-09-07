-- =============================================================================
-- Le garde-fou du plan ne doit pas bloquer sa propre synchronisation
-- =============================================================================
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CE QUI S'EST PASSE
--
-- `20260906182132_observabilite_et_garde_plan.sql` a pose
-- `app.protect_organization_plan` : `organizations.plan_code` est un CACHE de
-- l'abonnement, et l'application n'a rien a y ecrire. La regle est juste.
--
-- Sa mise en oeuvre ne l'est pas. Elle refuse toute modification de `plan_code`
-- des lors qu'une identite utilisateur est presente :
--
--     if new.plan_code is distinct from old.plan_code
--        and (select auth.uid()) is not null then ...
--
-- Or ce n'est jamais l'application qui ecrit cette colonne : c'est
-- `app.sync_organization_plan`, declencheur sur `subscriptions`, qui la
-- recalcule. `auth.uid()` lit un parametre de session, que `SECURITY DEFINER`
-- ne remet pas a zero -- l'identite de l'appelant reste donc visible A
-- L'INTERIEUR de la synchronisation. Le garde-fou bloque le seul ecrivain
-- legitime des que l'abonnement change dans une session portant un JWT.
--
-- En production, le webhook de paiement ecrit avec la cle de service, sans JWT :
-- rien ne s'est casse pour les clients, et la sonde confirme que la creation
-- d'organisation passe toujours (`app.start_organization_trial` ne pose plus
-- d'essai, donc n'ecrit plus de plan). Mais QUATRE des six scenarios de
-- `supabase/tests/` sont devenus injouables : ils rejouent l'ecriture du
-- webhook apres avoir endosse une identite de test. Une regle de securite qui
-- rend la suite de tests inexecutable finit par etre desactivee.
--
-- Et la faille de conception, elle, demeure : le jour ou un parcours produit
-- fera changer un abonnement sous l'identite de l'utilisateur -- une resiliation
-- depuis l'application, par exemple -- il echouerait en 42501.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- LA CORRECTION
--
-- La synchronisation s'annonce. Elle pose un indicateur LOCAL A LA TRANSACTION
-- le temps de son `update`, et le garde-fou laisse passer cet update-la.
--
-- Cet indicateur n'est pas une porte derobee : `set_config` n'est pas exposee
-- par PostgREST, un client ne peut donc pas la positionner lui-meme. Le seul
-- moyen de l'allumer est de passer par `app.sync_organization_plan`, c'est-a-
-- dire d'ecrire dans `subscriptions` -- table sur laquelle `authenticated` n'a
-- aucune policy d'ecriture. Le chemin reste ferme.
--
-- `true` en troisieme argument de `set_config` : la valeur meurt avec la
-- transaction. Une valeur de session survivrait a la requete et desarmerait le
-- garde-fou pour tout ce qui suit sur la meme connexion -- or PostgREST
-- reutilise ses connexions.

create or replace function app.sync_organization_plan()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := coalesce(new.organization_id, old.organization_id);
begin
  if v_org is not null then
    perform set_config('app.plan_sync', 'on', true);

    update public.organizations
    set plan_code = app.org_plan_code(v_org)
    where id = v_org;

    -- Refermee immediatement : la fenetre ne couvre que l'update ci-dessus,
    -- pas le reste de la transaction appelante.
    perform set_config('app.plan_sync', 'off', true);
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create or replace function app.protect_organization_plan()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.plan_code is distinct from old.plan_code
     and (select auth.uid()) is not null
     and coalesce(current_setting('app.plan_sync', true), 'off') <> 'on' then
    raise exception 'La formule d''une organisation ne se modifie pas depuis l''application.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
--
-- Les deux moities de la regle sont verifiees, pas seulement celle qu'on vient
-- d'ouvrir : une migration qui prouverait « la synchronisation passe » sans
-- prouver « l'application est toujours refusee » aurait pu simplement supprimer
-- le garde-fou.

do $$
declare
  v_uid    uuid;
  v_org    uuid;
  v_plan   text;
  v_refuse boolean := false;
begin
  select id into v_uid from auth.users order by created_at limit 1;
  select id into v_org from public.organizations order by created_at limit 1;

  if v_uid is null or v_org is null then
    raise notice 'Base sans utilisateur ni organisation : verification comportementale ignoree.';
    return;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

  select plan_code into v_plan from public.organizations where id = v_org;

  -- 1. L'application reste refusee.
  begin
    update public.organizations
    set plan_code = case when coalesce(v_plan, '') = 'enterprise' then 'free' else 'enterprise' end
    where id = v_org;
  exception when insufficient_privilege then
    v_refuse := true;
  end;

  if not v_refuse then
    raise exception 'Le garde-fou ne refuse plus l''ecriture directe du plan depuis l''application.';
  end if;

  -- 2. La synchronisation passe. Ecrire dans `subscriptions` declenche
  --    `app.sync_organization_plan`, donc l'update que le garde-fou refusait.
  delete from public.subscriptions where organization_id = v_org;

  insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
  values (v_org, 'business', 'active', now() + interval '30 days');

  if (select plan_code from public.organizations where id = v_org) is distinct from 'business' then
    raise exception 'La synchronisation du plan n''a pas eu lieu.';
  end if;

  -- 3. L'indicateur est bien retombe.
  if coalesce(current_setting('app.plan_sync', true), 'off') = 'on' then
    raise exception 'L''indicateur de synchronisation est reste arme apres l''update.';
  end if;

  -- Cette verification a modifie des donnees reelles. On les remet en etat :
  -- le bloc s'execute dans la transaction de la migration, mais compter
  -- la-dessus reviendrait a laisser un test muter la production si la
  -- migration etait un jour rejouee autrement.
  raise exception using
    errcode = 'raise_exception',
    message = 'VERIFICATION_OK';

exception
  when raise_exception then
    if sqlerrm <> 'VERIFICATION_OK' then raise; end if;
    raise notice 'Garde-fou du plan : ecriture applicative refusee, synchronisation autorisee.';
end
$$;

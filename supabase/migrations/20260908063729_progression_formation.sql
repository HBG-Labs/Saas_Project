-- =============================================================================
-- Progression de formation — enfin ailleurs que dans le navigateur
-- =============================================================================
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CE QUE CETTE TABLE CORRIGE
--
-- La progression vivait dans `localStorage`, sous la cle
-- `rezo360:tutorial-progress:v1`. L'ecran annoncait « Votre progression est
-- enregistree automatiquement », ce qui etait vrai — et trompeur. Elle
-- n'existait que dans CE navigateur :
--
--   un technicien qui commence sur le poste du depot et poursuit sur son
--   telephone repartait de zero ; vider les donnees du navigateur, ou passer
--   en navigation privee, effacait tout.
--
-- L'academie est vendue pour « rendre votre equipe autonome ». Une formation
-- dont la trace disparait au changement d'appareil ne tient pas cette
-- promesse.
--
-- STRICTEMENT PRIVEE — DECISION DU 08/09/2026
--
-- Personne d'autre que l'interesse ne lit sa progression, pas meme le
-- proprietaire de l'organisation. C'est le meme regime que le bloc-notes.
--
-- Consequence assumee : aucune vue d'equipe n'est possible. Un dirigeant ne
-- peut pas verifier qu'une formation a ete suivie. Si ce besoin apparait, il
-- se traitera par une nouvelle migration et un consentement explicite, pas en
-- relachant cette policy.
--
-- PAS D'ORGANISATION DANS LA CLE
--
-- Ces cours enseignent le PRODUIT, pas l'entreprise. Quelqu'un qui appartient
-- a deux organisations n'a aucune raison de refaire la meme formation deux
-- fois. La progression suit donc la personne, et elle seule.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.training_progress (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  course_slug        text not null check (char_length(btrim(course_slug)) between 1 and 80),
  completed_chapters text[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint training_progress_unique_par_cours unique (user_id, course_slug)
);

comment on table public.training_progress is
  'Progression personnelle dans les parcours de l''academie. Jamais partagee.';

-- L'ecran lit toute la progression d'une personne d'un coup, pour afficher les
-- pourcentages du catalogue. L'index unique ci-dessus sert deja ce parcours.

-- -----------------------------------------------------------------------------
-- Le proprietaire est impose, pas declare
-- -----------------------------------------------------------------------------
--
-- Meme raison que pour `notes` : la policy verifie `user_id = auth.uid()`, le
-- trigger le POSE. Le client n'a donc pas a connaitre son propre identifiant,
-- et la seule facon de se tromper disparait.

create or replace function app.enforce_training_progress_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is not null then
    new.user_id := v_actor;
  end if;
  return new;
end;
$$;

drop trigger if exists training_progress_enforce_owner on public.training_progress;
create trigger training_progress_enforce_owner
  before insert on public.training_progress
  for each row execute function app.enforce_training_progress_owner();

drop trigger if exists training_progress_set_updated_at on public.training_progress;
create trigger training_progress_set_updated_at
  before update on public.training_progress
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Privileges et RLS
-- -----------------------------------------------------------------------------

revoke all on public.training_progress from public, anon, authenticated;
grant select, insert, update, delete on public.training_progress to authenticated;

alter table public.training_progress enable row level security;

drop policy if exists "training_progress_select_own" on public.training_progress;
create policy "training_progress_select_own"
  on public.training_progress for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "training_progress_insert_own" on public.training_progress;
create policy "training_progress_insert_own"
  on public.training_progress for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "training_progress_update_own" on public.training_progress;
create policy "training_progress_update_own"
  on public.training_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "training_progress_delete_own" on public.training_progress;
create policy "training_progress_delete_own"
  on public.training_progress for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
--
-- Declarative ici : sans deux comptes reels sous la main, une epreuve
-- comportementale du cloisonnement se ferait dans le scenario SQL, pas dans la
-- migration. Ce qui est verifie, c'est qu'aucune des quatre portes n'a ete
-- laissee ouverte.

do $$
declare
  v_policies integer;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.training_progress'::regclass) then
    raise exception 'La RLS doit etre active sur training_progress.';
  end if;

  select count(*) into v_policies
  from pg_policy p join pg_class c on c.oid = p.polrelid
  where c.relname = 'training_progress';

  if v_policies <> 4 then
    raise exception 'training_progress doit porter 4 policies, % trouvee(s).', v_policies;
  end if;

  -- Aucune policy ne doit oublier le filtre par utilisateur : une seule
  -- suffirait a exposer la progression de toute la base.
  if exists (
    select 1 from pg_policy p join pg_class c on c.oid = p.polrelid
    where c.relname = 'training_progress'
      and coalesce(pg_get_expr(p.polqual, p.polrelid), '') not like '%auth.uid()%'
      and coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') not like '%auth.uid()%'
  ) then
    raise exception 'Une policy de training_progress ne filtre pas sur auth.uid().';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_name = 'training_progress' and grantee = 'anon'
  ) then
    raise exception 'anon ne doit avoir aucun droit sur training_progress.';
  end if;
end
$$;

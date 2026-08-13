-- =============================================================================
-- Un collègue a un nom
-- =============================================================================
--
-- LE CONSTAT
--
-- La liste des membres affiche « Membre » à la place du nom, pour tout le monde
-- sauf soi-même. `memberDisplayName` retombe sur ce libellé générique quand le
-- profil est absent — et il l'est : `profiles_select_own` réserve la lecture de
-- `profiles` à son propriétaire. La jointure `profile:profiles(...)` renvoie
-- donc `null` pour chaque collègue.
--
-- Une équipe dont on ne peut pas lire les noms n'est pas une équipe. Le même
-- défaut vide de sens l'affectation d'une mission, le choix d'un chef d'équipe
-- et la file de contrôle des comptes rendus, tous construits sur ce nom.
--
-- POURQUOI LA CORRECTION N'EST PAS « OUVRIR profiles »
--
-- `profiles` porte depuis peu le téléphone personnel, la zone d'intervention,
-- les habilitations et le matériel déclaré. Élargir la policy exposerait ces
-- données à toute l'entreprise — et, pour qui appartient à plusieurs
-- organisations, à chacune d'elles. La migration qui les a ajoutées promettait
-- l'inverse, noir sur blanc : « nul autre que l'intéressé ne les lit ».
--
-- PostgreSQL ne sait pas restreindre des COLONNES par ligne : `GRANT SELECT
-- (colonnes)` vaut pour un rôle entier, et interdirait alors à chacun de lire
-- son propre téléphone.
--
-- LA CORRECTION
--
-- Deux tables, deux régimes, parce que ce sont deux natures d'information :
--
--   `profiles`        — l'IDENTITÉ. Nom affiché, avatar. Ce qu'un collègue doit
--                       voir pour vous reconnaître sur une mission.
--   `profile_details` — la PERSONNE. Téléphone, zone, habilitations, matériel.
--                       Visible de son seul titulaire, comme auparavant.
--
-- La séparation rend la règle lisible dans le schéma lui-même : il n'y a plus à
-- se demander si telle colonne est publique à l'entreprise. La table le dit.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. La fiche personnelle déménage
-- -----------------------------------------------------------------------------
create table if not exists public.profile_details (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  phone          text,
  zone           text,
  /** `[{ label, detail, expires_at }]` — déclaratif, jamais opposable. */
  certifications jsonb not null default '[]'::jsonb,
  /** `[{ id, name, serial }]` — distinct de `equipment`, l'inventaire de l'entreprise. */
  equipments     jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists profile_details_set_updated_at on public.profile_details;
create trigger profile_details_set_updated_at
  before update on public.profile_details
  for each row execute function public.set_updated_at();

-- Reprise de ce qui a déjà été saisi. `where` sur les valeurs non vides : créer
-- une ligne vide pour chacun des douze comptes n'apporterait rien.
insert into public.profile_details (user_id, phone, zone, certifications, equipments)
select
  p.id,
  p.phone,
  p.zone,
  coalesce(p.certifications, '[]'::jsonb),
  coalesce(p.equipments, '[]'::jsonb)
from public.profiles p
where p.phone is not null
   or p.zone is not null
   or coalesce(p.certifications, '[]'::jsonb) <> '[]'::jsonb
   or coalesce(p.equipments, '[]'::jsonb) <> '[]'::jsonb
on conflict (user_id) do nothing;

alter table public.profiles
  drop column if exists phone,
  drop column if exists zone,
  drop column if exists certifications,
  drop column if exists equipments;

revoke all on public.profile_details from public, anon, authenticated;
grant select, insert, update on public.profile_details to authenticated;

alter table public.profile_details enable row level security;

-- Aucune suppression : la fiche disparaît avec le compte, par la cascade.
drop policy if exists "profile_details_select_own" on public.profile_details;
create policy "profile_details_select_own"
  on public.profile_details for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "profile_details_insert_own" on public.profile_details;
create policy "profile_details_insert_own"
  on public.profile_details for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "profile_details_update_own" on public.profile_details;
create policy "profile_details_update_own"
  on public.profile_details for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- -----------------------------------------------------------------------------
-- 2. L'identité devient visible entre collègues
-- -----------------------------------------------------------------------------
--
-- `security definer` pour la même raison que `app.my_organization_ids()` : la
-- fonction interroge `organization_members`, dont la policy interrogerait à son
-- tour `profiles`. Sans cette sortie du régime RLS, l'évaluation tournerait en
-- rond.
--
-- Les invités (`status = 'invited'`) sont inclus : ils apparaissent déjà dans la
-- liste des membres, et les y afficher sans nom reproduirait le défaut corrigé.
create or replace function app.shares_organization_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = p_user_id
      and theirs.status in ('active', 'invited')
  );
$$;

revoke all on function app.shares_organization_with(uuid) from public, anon;
grant execute on function app.shares_organization_with(uuid) to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_visible" on public.profiles;
create policy "profiles_select_visible"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select app.shares_organization_with(id))
  );

-- L'écriture, elle, ne bouge pas : `profiles_update_own` reste seule. Un
-- dirigeant voit le nom de ses employés, il ne le change pas.

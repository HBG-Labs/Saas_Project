-- =============================================================================
-- Rendre la relation membre → profil visible par PostgREST
-- =============================================================================
--
-- LE CONSTAT, MESURÉ
--
-- Sept requêtes de l'application échouaient, toutes avec le même message :
--
--   PGRST200 — Could not find a relationship between 'organization_members'
--              and 'profiles' in the schema cache
--
-- Elles couvrent l'essentiel du module professionnel : liste des membres, liste
-- et détail des missions, file de contrôle, détail d'équipe, historique client,
-- parc matériel. Autrement dit, presque tous les écrans où l'on affiche QUI a
-- fait quoi.
--
-- POURQUOI
--
-- `organization_members.user_id` référence `auth.users(id)`. `profiles.id`
-- référence lui aussi `auth.users(id)`. Les deux tables se rejoignent donc par
-- un tiers, et non directement — PostgREST, qui déduit ses jointures des clés
-- étrangères déclarées, ne peut pas inventer ce chemin. La syntaxe
-- `profile:profiles(...)` était refusée à chaque appel.
--
-- L'erreur était invisible : chaque fonction d'accès l'attrapait pour retomber
-- sur des données de démonstration en `localStorage`. L'application paraissait
-- fonctionner alors qu'aucune de ces lectures n'aboutissait.
--
-- LA CORRECTION
--
-- Une seconde clé étrangère sur la même colonne, vers `profiles`. Ce n'est pas
-- une redondance décorative : elle EST vraie. Le trigger `handle_new_user` crée
-- un profil pour chaque compte, et la migration de backfill du 9 août a comblé
-- les comptes antérieurs — tout `user_id` d'un membership a donc son profil.
--
-- L'alternative aurait été de retirer `profiles` des requêtes et de charger les
-- noms séparément : une requête de plus par écran, et un affichage en deux
-- temps. Déclarer le lien qui existe déjà est plus simple et plus honnête.
--
-- Aucune donnée n'est modifiée, aucune policy touchée. `profiles` reste protégée
-- par `profiles_select_own` : la jointure ne rend visible que ce que cette
-- policy autorise déjà — d'où les `profile: null` que l'interface sait afficher,
-- en retombant sur le poste occupé.
-- =============================================================================

-- Contrôle préalable : la contrainte échouerait sur un membership orphelin, et
-- le message de Postgres ne dirait pas lequel. Autant nommer le problème.
do $$
declare
  v_orphans integer;
begin
  select count(*) into v_orphans
  from public.organization_members m
  where not exists (select 1 from public.profiles p where p.id = m.user_id);

  if v_orphans > 0 then
    raise exception
      '% appartenance(s) référencent un utilisateur sans profil. Exécutez d''abord le backfill de 20260809100000_profile_backfill_and_hardening.sql.',
      v_orphans;
  end if;
end
$$;

alter table public.organization_members
  drop constraint if exists organization_members_user_id_profiles_fkey;

alter table public.organization_members
  add constraint organization_members_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

comment on constraint organization_members_user_id_profiles_fkey on public.organization_members is
  'Double la clé vers auth.users pour rendre la jointure vers profiles explorable par PostgREST (embed `profile:profiles(...)`).';

-- Le cache de schéma de PostgREST ne se recharge pas de lui-même dans tous les
-- contextes de migration : sans ce signal, la relation resterait introuvable
-- jusqu'au prochain redémarrage.
notify pgrst, 'reload schema';

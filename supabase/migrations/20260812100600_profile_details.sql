-- =============================================================================
-- Fiche professionnelle personnelle
-- =============================================================================
--
-- LE CONSTAT
--
-- L'écran Profil porte bien plus qu'un nom : téléphone, zone d'intervention,
-- habilitations électriques et CACES avec leurs échéances, et la liste des
-- appareils personnellement confiés. Tout cela vivait dans
-- `nexoratech_user_profile_custom` — le navigateur du poste utilisé ce jour-là.
--
-- Une habilitation périmée interdit une intervention. Sa date ne peut pas
-- dépendre d'un cache navigateur.
--
-- OÙ CHAQUE INFORMATION APPARTIENT
--
-- `job_title` et `phone` existent DÉJÀ sur `organization_members` : le poste
-- occupé et le numéro professionnel dépendent de l'entreprise, et une même
-- personne peut être « chef d'équipe » ici et « technicien » ailleurs. Ils ne
-- sont donc pas dupliqués ici.
--
-- Ce qui suit est attaché à la PERSONNE et la suit d'une entreprise à l'autre :
-- son téléphone personnel, sa zone, ses habilitations. `profiles` est protégée
-- par `profiles_select_own` / `profiles_update_own` : nul autre que l'intéressé
-- ne les lit ni ne les modifie, pas même un propriétaire d'organisation.
--
-- POURQUOI DU JSONB POUR LES HABILITATIONS
--
-- Les intitulés varient par métier — H0V/B2V en électricité, CACES R486 en
-- levage, AIPR en travaux publics — et la liste s'allongera. Une colonne par
-- habilitation imposerait une migration à chaque nouveau métier couvert. Aucune
-- requête ne filtre sur ce contenu : il est lu et réaffiché tel quel.
-- =============================================================================

alter table public.profiles
  add column if not exists phone          text,
  add column if not exists zone           text,
  add column if not exists certifications jsonb not null default '[]'::jsonb,
  add column if not exists equipments     jsonb not null default '[]'::jsonb;

comment on column public.profiles.certifications is
  'Habilitations déclarées : [{ label, detail, expires_at }]. Déclaratif, non opposable.';

comment on column public.profiles.equipments is
  'Matériel personnellement confié, tel que déclaré : [{ id, name, serial }]. Distinct de la table `equipment`, qui est l''inventaire de l''entreprise.';

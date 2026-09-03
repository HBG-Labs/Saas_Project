-- =============================================================================
-- L'avatar devient un identifiant de bibliothèque, plus une URL
-- =============================================================================
--
-- CE QUE CETTE MIGRATION CHANGE, ET POURQUOI MAINTENANT
--
-- `profiles.avatar_url` promettait une adresse d'image. Ce n'est plus ce que
-- l'application écrit : le choix se réduit désormais à un identifiant de
-- bibliothèque (`avatar-01` … `avatar-50`), résolu côté client vers un SVG
-- statique. Garder le nom `avatar_url` aurait laissé la colonne mentir sur ce
-- qu'elle contient — exactement le genre d'écart entre l'annoncé et le réel
-- qu'on a corrigé ailleurs cette semaine sur ce projet.
--
-- Le renommage est SANS RISQUE aujourd'hui : mesuré, les 13 profils existants
-- ont tous `avatar_url is null`. Aucune ancienne valeur ne survit au
-- changement de nom ; il n'y a rien à convertir, seulement à renommer. Attendre
-- aurait transformé ce même renommage en migration de données.
--
-- CE QUI NE CHANGE PAS
--
-- Les policies existantes couvrent déjà l'usage : `profiles_select_visible`
-- (soi-même, ou un collègue de la même organisation) et `profiles_update_own`
-- (soi-même exclusivement). Aucune n'est réécrite ni contournée.
-- =============================================================================

alter table public.profiles rename column avatar_url to avatar_id;

comment on column public.profiles.avatar_id is
  'Identifiant dans la bibliotheque de 50 avatars (avatar-01 a avatar-50), resolu cote client vers /avatars/<id>.svg. Jamais une URL.';

-- -----------------------------------------------------------------------------
-- Une forme, pas une liste
-- -----------------------------------------------------------------------------
--
-- Une contrainte qui énumérerait les 50 identifiants exigerait une migration à
-- chaque évolution de la bibliothèque — pour une garantie que le format suffit
-- déjà à donner. `avatar-` suivi de deux chiffres filtre la corruption et
-- l'injection de gabarit (`javascript:`, une URL complète, un chemin) sans
-- figer le catalogue dans le schéma.
alter table public.profiles
  add constraint profiles_avatar_id_format
  check (avatar_id is null or avatar_id ~ '^avatar-[0-9]{2}$');
